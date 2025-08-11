let midiOutput = null;
let midiAccessGlobal = null;

// Elements (optional, if present in the page)
const outputSelect = document.getElementById('midiOutputs');
const refreshBtn = document.getElementById('refreshMidi');
const statusEl = document.getElementById('midiStatus');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// ---- MIDI setup ----
if (navigator.requestMIDIAccess) {
  navigator.requestMIDIAccess({ sysex: false }).then(midiSuccess, midiFailure);
} else {
  alert("Web MIDI API not supported in this browser.");
}

function populateOutputs() {
  if (!outputSelect || !midiAccessGlobal) return;
  outputSelect.innerHTML = '';

  const outputs = Array.from(midiAccessGlobal.outputs.values());
  const preferredNames = [/loopmidi/i, /loopback/i, /virtual/i];

  outputs.forEach((out) => {
    const opt = document.createElement('option');
    opt.value = out.id;
    opt.textContent = `${out.name} (${out.manufacturer || 'Unknown'})`;
    outputSelect.appendChild(opt);
  });

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

function midiSuccess(midiAccess) {
  midiAccessGlobal = midiAccess;
  midiAccess.onstatechange = () => populateOutputs();
  populateOutputs();
}

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

// ---- Helpers for CC mapping ----
function clampCC(v) {
  if (v == null || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(127, Math.round(v)));
}

function mapUnitToCC(v) { // 0..1 -> 0..127
  if (v == null) return 0;
  return clampCC(v * 127);
}

function mapNeg1To1ToCC(v) { // -1..1 -> 0..127
  if (v == null) return 0;
  return clampCC(((v + 1) / 2) * 127);
}

function mapMagToCC(mag, minUT = 0, maxUT = 100) { // uT -> 0..127
  if (mag == null) return 0;
  const lo = Math.min(minUT, maxUT);
  const hi = Math.max(minUT, maxUT);
  const t = hi > lo ? (mag - lo) / (hi - lo) : 0;
  return clampCC(Math.max(0, Math.min(1, t)) * 127);
}

// Compute polygon area from touch points (array of [x,y])
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

// ---- MIDI send helper (channel 1) ----
function sendCC(cc, value) {
  if (midiOutput) {
    midiOutput.send([0xB0, cc & 0x7F, value & 0x7F]);
  }
}

// ---- Touch state for area ----
const touchPoints = new Map(); // id -> [x,y]

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
      // Missing coords => consider this as touch ended for that id
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

    // Touch events -> update state and send CC2 (area)
    if (typeof data.address === 'string' && data.address.startsWith('/touch')) {
      updateTouchFromMessage(data);
      const points = Array.from(touchPoints.values());
      const area = computeTouchArea(points);
      sendCC(1, mapUnitToCC(area));
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

    // Other messages ignored or could be logged if needed
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
