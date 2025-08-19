
/**
 * @typedef {Object} MidiOutput
 * @property {string} id
 * @property {string} name
 * @property {string} [manufacturer]
 * @property {(data: number[]) => void} send
 */

/**
 * @typedef {Object} MidiAccess
 * @property {Map<string, MidiOutput>} outputs
 * @property {(e: any) => void} onstatechange
 */

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

/** @type {MidiOutput|null} */
let midiOutput = null;
/** @type {MidiAccess|null} */
let midiAccessGlobal = null;

// Elements (optional, if present in the page)
const outputSelect = document.getElementById('midiOutputs');
const refreshBtn = document.getElementById('refreshMidi');
const statusEl = document.getElementById('midiStatus');


/**
 * @param {string} msg
 */
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// ---- MIDI setup ----
if (navigator.requestMIDIAccess) {
  navigator.requestMIDIAccess({ sysex: false }).then(midiSuccess, midiFailure);
} else {
  alert("Web MIDI API not supported in this browser.");
}


/**
 * Populate MIDI output select element
 */
function populateOutputs() {
  if (!outputSelect || !midiAccessGlobal) return;
  outputSelect.innerHTML = '';

  /** @type {MidiOutput[]} */
  const outputs = Array.from(midiAccessGlobal.outputs.values());
  const preferredNames = [/loopmidi/i, /loopback/i, /virtual/i];

  outputs.forEach((out) => {
    const opt = document.createElement('option');
    opt.value = out.id;
    opt.textContent = `${out.name} (${out.manufacturer || 'Unknown'})`;
    outputSelect.appendChild(opt);
  });

  /** @type {MidiOutput|null} */
  let selected = null;
  for (const pref of preferredNames) {
    selected = outputs.find(o => pref.test(`${o.name} ${o.manufacturer || ''}`));
    if (selected) break;
  }
  if (!selected) selected = outputs[0];

  if (selected) {
    outputSelect.value = selected.id;
    midiOutput = selected;
    setStatus(`Selected: ${selected.name}`);
  } else {
    setStatus('No MIDI outputs found');
  }
}


/**
 * @param {MidiAccess} midiAccess
 */
function midiSuccess(midiAccess) {
  midiAccessGlobal = midiAccess;
  midiAccess.onstatechange = () => populateOutputs();
  populateOutputs();
}


/**
 * MIDI failure handler
 */
function midiFailure() {
  alert("Failed to get MIDI access.");
}

if (outputSelect) {
  outputSelect.addEventListener('change', () => {
    const id = outputSelect.value;
    const out = midiAccessGlobal?.outputs.get(id) || null;
    midiOutput = out;
    if (out) setStatus(`Selected: ${out.name}`); else setStatus('No output');
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => populateOutputs());
}

// Assign buttons (send CC=127 for mapping)
const assignControls = document.getElementById('assignControls');
if (assignControls) {
  assignControls.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cc]');
    if (!btn) return;
    const cc = parseInt(btn.dataset.cc, 10);
    if (Number.isFinite(cc)) {
      // Fire a single 127 to map. If your DAW requires movement, uncomment the two-step pulse below.
      // sendCC(cc, 0); setTimeout(() => sendCC(cc, 127), 12);
      sendCC(cc, 127);
    }
  });
}

// ---- Helpers for CC mapping ----

/**
 * Clamp value to 0..127 for MIDI CC
 * @param {number} v
 * @returns {number}
 */
function clampCC(v) {
  if (v == null || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(127, Math.round(v)));
}


/**
 * Map 0..1 to 0..127
 * @param {number} v
 * @returns {number}
 */
function mapUnitToCC(v) {
  if (v == null) return 0;
  return clampCC(v * 127);
}


/**
 * Map -1..1 to 0..127
 * @param {number} v
 * @returns {number}
 */
function mapNeg1To1ToCC(v) {
  if (v == null) return 0;
  return clampCC(((v + 1) / 2) * 127);
}


/**
 * Map magnetic field magnitude to 0..127
 * @param {number} mag
 * @param {number} [minUT]
 * @param {number} [maxUT]
 * @returns {number}
 */
function mapMagToCC(mag, minUT = 0, maxUT = 100) {
  if (mag == null) return 0;
  const lo = Math.min(minUT, maxUT);
  const hi = Math.max(minUT, maxUT);
  const t = hi > lo ? (mag - lo) / (hi - lo) : 0;
  return clampCC(Math.max(0, Math.min(1, t)) * 127);
}

// Compute polygon area from touch points (array of [x,y])

/**
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

// Orientation of touch points relative to horizontal (x-axis).
// Uses PCA principal axis: angle in radians in [-PI/2, PI/2].

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

// Map angle (radians) to 0..127 CC.
// span = 'half' maps [-PI/2, PI/2] to 0..127 (matches PCA ambiguity).
// span = 'full' maps [-PI, PI] to 0..127 (if you use a full-range angle).

/**
 * Map angle (radians) to 0..127 CC
 * @param {number} angleRad
 * @param {'half'|'full'} [span]
 * @returns {number}
 */
function mapAngleToCC(angleRad, span = 'half') {
  if (typeof angleRad !== 'number') return 0;
  if (span === 'full') {
    const t = (angleRad + Math.PI) / (2 * Math.PI); // [-PI,PI] -> [0,1]
    return clampCC(t * 127);
  } else {
    const t = (angleRad + Math.PI / 2) / Math.PI;   // [-PI/2,PI/2] -> [0,1]
    return clampCC(t * 127);
  }
}

// ---- MIDI send ----

/**
 * Send MIDI CC message (channel 1)
 * @param {number} cc
 * @param {number} value
 */
function sendCC(cc, value) {
  if (midiOutput) {
    midiOutput.send([0xB0, cc & 0x7F, value & 0x7F]);
  }
}

// ---- Touch ----

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

// ---- WebSocket bridge ----
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('Connected to sensor receiver WebSocket');
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    // Rotation vector -> CC1 (use x component -1..1)
    if (data.address === '/rotationvector') {
      const x = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      if (typeof x === 'number') {
        sendCC(1, mapNeg1To1ToCC(Math.max(-1, Math.min(1, x))));
      }
      return;
    }

    // Touch events -> update state and send CC2 (area), compute/log angle
    if (typeof data.address === 'string' && data.address.startsWith('/touch')) {
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
      if ([mx, my, mz].every(v => typeof v === 'number')) {
        const mag = Math.sqrt(mx*mx + my*my + mz*mz);
        sendCC(3, mapMagToCC(mag));
      }
      return;
    }

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
