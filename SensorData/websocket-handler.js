// websocket-handler.js
import { addMonitorEntry } from './monitoring.js';
import { sendCC } from './midi-setup.js';
import { mapUnitToCC, mapNeg1To1ToCC, mapMagToCC, mapAngleToCC } from './transformationMapping.js';

/**
 * @typedef {Object} SensorData
 * @property {string} address
 * @property {number} [id]
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [z]
 * @property {number} [value]
 * @property {Array<number>} [args]
 */

/**
 * @typedef {[number, number]} TouchPoint
 */

/** @type {Map<number, TouchPoint>} */
const touchPoints = new Map(); // id -> [x,y]

/**
 * Update touch state from sensor message
 * @param {SensorData} data
 */
function updateTouchFromMessage(data) {
  const addr = data.address || '';
  let id = null, x = undefined, y = undefined;

  // Prefer explicit fields if provided
  if (typeof data.id === 'number') id = data.id;
  if (typeof data.x === 'number') x = data.x;
  if (typeof data.y === 'number') y = data.y;

  // Fallback to parse from args and address
  if ((x === undefined || y === undefined) && Array.isArray(data.args)) {
    if (typeof data.args[0] === 'number') x = data.args[0];
    if (typeof data.args[1] === 'number') y = data.args[1];
  }
  if (id == null && typeof addr === 'string' && addr.startsWith('/touch')) {
    const suffix = addr.slice(6);
    if (/^\d+$/.test(suffix)) id = parseInt(suffix, 10);
  }

  if (id != null) {
    if (typeof x === 'number' && typeof y === 'number') {
      touchPoints.set(id, [x, y]);
    } else {
      touchPoints.delete(id);
    }
  }
}

/**
 * Compute polygon area from touch points (array of [x,y])
 * @param {TouchPoint[]} points
 * @returns {number}
 */
function computeTouchArea(points) {
  if (!points || points.length < 3) return 0;
  const n = points.length;
  let cx = 0, cy = 0;
  for (const [x, y] of points) { cx += x; cy += y; }
  cx /= n; cy /= n;
  const pts = points.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area2 += x1 * y2 - x2 * y1;
  }
  return Math.abs(area2) * 0.5; // unit square max area = 1
}

/**
 * Compute orientation of touch points relative to horizontal
 * @param {TouchPoint[]} points
 * @returns {number|null}
 */
function computeTouchAngle(points) {
  if (!points || points.length < 2) return null;
  // Centroid
  let cx = 0, cy = 0;
  for (const [x, y] of points) { cx += x; cy += y; }
  cx /= points.length; cy /= points.length;

  // Covariance terms (scale factor cancels out in atan2)
  let Sxx = 0, Sxy = 0, Syy = 0;
  for (const [x, y] of points) {
    const dx = x - cx, dy = y - cy;
    Sxx += dx * dx;
    Sxy += dx * dy;
    Syy += dy * dy;
  }

  // Principal axis angle (radians), range [-PI/2, PI/2]
  const angle = 0.5 * Math.atan2(2 * Sxy, Sxx - Syy);
  return angle;
}

/**
 * Convert radians to degrees
 * @param {number} r
 * @returns {number|null}
 */
function radToDeg(r) {
  return (typeof r === 'number') ? (r * 180 / Math.PI) : null;
}

// ---- WebSocket bridge ----
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('Connected to sensor receiver WebSocket');
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    // /data: each argument value becomes its own monitor series and own sequential CC channel
    if (data.address === '/data') {
      const payload = Array.isArray(data.args)
        ? data.args
        : Array.isArray(data.values)
          ? data.values
          : [];
      const numericValues = payload.filter(v => typeof v === 'number');
      numericValues.forEach((value, index) => {
        addMonitorEntry(`/data/${index}`, { value });
        // CC numbering sequential from 1..N (clamp to 1..127)
        const cc = Math.min(127, Math.max(1, 1 + index));
        sendCC(cc, mapUnitToCC(value));
      });

      // renderAssignSettingUI(); // This will be called in monitoring.js
      return;
    }

    // Rotation vector -> CC1 (use x component -1..1)
    if (data.address === '/rotationvector') {
      const x = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      const y = (typeof data.y === 'number') ? data.y : (Array.isArray(data.args) ? data.args[1] : undefined);
      const z = (typeof data.z === 'number') ? data.z : (Array.isArray(data.args) ? data.args[2] : undefined);
      const w = (typeof data.w === 'number') ? data.w : (Array.isArray(data.args) ? data.args[3] : undefined);
      addMonitorEntry('/rotationvector', { x, y, z, w });
      if (typeof x === 'number') {
        sendCC(1, mapNeg1To1ToCC(Math.max(-1, Math.min(1, x))));
      }
      return;
    }

    // Touch events -> update state and send CC2 (area), compute/log angle
    if (typeof data.address === 'string' && data.address.startsWith('/touch')) {
      const x = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      const y = (typeof data.y === 'number') ? data.y : (Array.isArray(data.args) ? data.args[1] : undefined);
      const id = (typeof data.id === 'number') ? data.id : (typeof data.address === 'string' ? parseInt(data.address.slice(6), 10) : undefined);
      addMonitorEntry(data.address, { id, x, y });
      updateTouchFromMessage(data);
      const points = Array.from(touchPoints.values());

      // CC2 from polygon area (0..1 -> 0..127)
      const area = computeTouchArea(points);
      sendCC(1, mapUnitToCC(area));

      // Angle for debug (PCA orientation relative to horizontal)
      const angleRad = computeTouchAngle(points);
      const angleDeg = radToDeg(angleRad);
      if (angleDeg != null) {
        console.log(`Touch polygon angle: ${angleDeg.toFixed(1)}°`);
        // If you want to send it, pick a CC (e.g., CC4):
        sendCC(4, mapAngleToCC(angleRad, 'half'));
      }
      return;
    }

    // Inclination -> CC2 (-1..1)
    if (data.address === '/inclination') {
      const v = (typeof data.value === 'number') ? data.value : (Array.isArray(data.args) ? data.args[0] : undefined);
      addMonitorEntry('/inclination', { value: v });
      if (typeof v === 'number') {
        sendCC(2, mapNeg1To1ToCC(Math.max(-1, Math.min(1, v))));
      }
      return;
    }

    // Magnetic field -> CC3 (magnitude)
    if (data.address === '/magneticfield') {
      const mx = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      const my = (typeof data.y === 'number') ? data.y : (Array.isArray(data.args) ? data.args[1] : undefined);
      const mz = (typeof data.z === 'number') ? data.z : (Array.isArray(data.args) ? data.args[2] : undefined);
      addMonitorEntry('/magneticfield', { x: mx, y: my, z: mz });
      if ([mx, my, mz].every(v => typeof v === 'number')) {
        const mag = Math.sqrt(mx*mx + my*my + mz*mz);
        sendCC(3, mapMagToCC(mag));
      }
      return;
    }

    // Catch-all monitor for unknown addresses
    addMonitorEntry(data.address, {
      ...(data.args ? data.args.reduce((o, value, index) => ({ ...o, ['arg' + index]: value }), {}) : {}),
    });

  } catch (err) {
    console.error('Invalid message:', event.data);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.warn('WebSocket connection closed');
};