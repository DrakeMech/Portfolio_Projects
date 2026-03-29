// midi-setup.js

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

/** @type {MidiOutput|null} */
export let midiOutput = null;
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

// ---- MIDI send ----
export function sendCC(cc, value) {
  if (midiOutput) {
    const msg = [0xB0, cc & 0x7F, value & 0x7F];
    midiOutput.send(msg);
    // Log parsed MIDI message
    const parsed = parse(new Uint8Array(msg));
    if (parsed) {
      console.log('Parsed MIDI:', parsed);
    }
  }
}