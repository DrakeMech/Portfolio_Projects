
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
 * Map light sensor value (0..1200) to 0..1
 * @param {number} v
 * @returns {number}
 */
function mapLightToUnit(v) {
  if (v == null) return 0;
  return Math.max(0, Math.min(1, v / 1200));
}

/**
 * Map light sensor value (0..1200) to 0..127
 * @param {number} v
 * @returns {number}
 */
function mapLightToCC(v) {
  return clampCC(mapLightToUnit(v) * 127);
}


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

// ---- WebSocket bridge ----
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('Connected to sensor receiver WebSocket');
};


ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    // Light sensor -> CC1 and update #light element
    if (data.address === '/light') {
      const x = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      if (typeof x === 'number') {
        const ccValue = mapLightToCC(x);
        sendCC(1, ccValue);

        // Map to 0..1 for contrast
        const unitValue = mapLightToUnit(x);
        const bg = Math.round(unitValue * 255); // 0=black, 1=white
        const fg = 255 - bg; // contrast
        const lightEl = document.getElementById('light');
        if (lightEl) {
          lightEl.style.backgroundColor = `rgb(${bg},${bg},${bg})`;
          lightEl.style.color = `rgb(${fg},${fg},${fg})`;
        }
      } else {
        console.log(`This is not a proper value, map the values accordingly! Value: ${x}`)
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
