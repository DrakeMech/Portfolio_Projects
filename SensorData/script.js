
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
let dataAssignContainer = null;
let assignMappings = [];

function updateGroupAssignHelpers() {
  // Deprecated in current simplified mode. Use renderAssignSettingUI() instead.
}

if (assignControls) {
  assignControls.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cc]');
    if (!btn) return;
    const cc = parseInt(btn.dataset.cc, 10);
    if (Number.isFinite(cc)) {
      sendCC(cc, 127);
    }
  });
  // UI init deferred until monitorHistory initialization.
}

const assignSettingContainer = document.createElement('div');
assignSettingContainer.style.marginTop = '8px';
assignSettingContainer.style.display = 'flex';
assignSettingContainer.style.gap = '8px';
assignSettingContainer.style.flexWrap = 'wrap';
if (assignControls) assignControls.appendChild(assignSettingContainer);

function renderAssignSettingUI() {
  if (!assignSettingContainer) return;
  assignSettingContainer.innerHTML = '';

  const currentGroups = Object.keys(monitorHistory).filter(g => groupHasData(g));

  const groupSelect = document.createElement('select');
  groupSelect.style.padding = '4px 7px';
  groupSelect.style.background = '#111';
  groupSelect.style.border = '1px solid #00ccff';
  groupSelect.style.color = '#fff';
  groupSelect.style.marginRight = '6px';

  const defaultGroupOpt = document.createElement('option');
  defaultGroupOpt.value = '';
  defaultGroupOpt.textContent = 'Select group';
  groupSelect.appendChild(defaultGroupOpt);

  currentGroups.forEach((group) => {
    const opt = document.createElement('option');
    opt.value = group;
    opt.textContent = group;
    groupSelect.appendChild(opt);
  });

  const metricSelect = document.createElement('select');
  metricSelect.style.padding = '4px 7px';
  metricSelect.style.background = '#111';
  metricSelect.style.border = '1px solid #00ccff';
  metricSelect.style.color = '#fff';
  metricSelect.style.marginRight = '6px';
  metricSelect.disabled = true;

  const defaultMetricOpt = document.createElement('option');
  defaultMetricOpt.value = '';
  defaultMetricOpt.textContent = 'Select metric';
  metricSelect.appendChild(defaultMetricOpt);

  groupSelect.addEventListener('change', () => {
    metricSelect.innerHTML = '';
    const defaultMetricOpt2 = document.createElement('option');
    defaultMetricOpt2.value = '';
    defaultMetricOpt2.textContent = 'Select metric';
    metricSelect.appendChild(defaultMetricOpt2);
    if (!groupSelect.value) {
      metricSelect.disabled = true;
      return;
    }
    const selectedData = monitorHistory[groupSelect.value] || {};
    const metrics = Object.keys(selectedData).filter(k => Array.isArray(selectedData[k]));
    metrics.forEach((metric) => {
      const opt = document.createElement('option');
      opt.value = metric;
      opt.textContent = metric;
      metricSelect.appendChild(opt);
    });
    metricSelect.disabled = metrics.length === 0;
  });

  const ccInput = document.createElement('input');
  ccInput.type = 'number';
  ccInput.min = 1;
  ccInput.max = 127;
  ccInput.placeholder = 'CC#';
  ccInput.style.width = '5rem';
  ccInput.style.padding = '4px 7px';
  ccInput.style.background = '#111';
  ccInput.style.border = '1px solid #00ccff';
  ccInput.style.color = '#fff';

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add mapping';
  addBtn.style.padding = '4px 7px';
  addBtn.style.border = '1px solid #00ccff';
  addBtn.style.background = '#222';
  addBtn.style.color = '#00ccff';
  addBtn.addEventListener('click', () => {
    const group = groupSelect.value;
    const metric = metricSelect.value;
    const cc = Number(ccInput.value);
    if (!group || !metric || !Number.isInteger(cc) || cc < 1 || cc > 127) return;
    assignMappings.push({ groupName: group, metric, cc });
    groupSelect.value = '';
    metricSelect.innerHTML = '';
    metricSelect.disabled = true;
    metricSelect.appendChild(defaultMetricOpt);
    ccInput.value = '';
    renderAssignMappingList();
  });

  assignSettingContainer.appendChild(groupSelect);
  assignSettingContainer.appendChild(metricSelect);
  assignSettingContainer.appendChild(ccInput);
  assignSettingContainer.appendChild(addBtn);

  const list = document.createElement('div');
  list.id = 'assignMappingList';
  list.style.width = '100%';
  list.style.marginTop = '6px';
  assignSettingContainer.appendChild(list);
  renderAssignMappingList();
}

function renderAssignMappingList() {
  const list = document.getElementById('assignMappingList');
  if (!list) return;
  list.innerHTML = '';
  if (assignMappings.length === 0) {
    const none = document.createElement('div');
    none.style.opacity = '0.7';
    none.textContent = 'No mappings configured yet.';
    list.appendChild(none);
    return;
  }
  assignMappings.forEach((m, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.color = '#ddd';
    row.textContent = `${m.groupName}:${m.metric} -> CC${m.cc}`;
    const del = document.createElement('button');
    del.textContent = 'x';
    del.style.padding = '0 6px';
    del.style.border = '1px solid #ff4444';
    del.style.background = '#221111';
    del.style.color = '#ff4444';
    del.style.cursor = 'pointer';
    del.onclick = () => { assignMappings.splice(idx, 1); renderAssignMappingList(); };
    row.appendChild(del);
    list.appendChild(row);
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


import { parse } from './midi.js';

/**
 * Send MIDI CC message (channel 1) and log parsed message
 * @param {number} cc
 * @param {number} value
 */
function sendCC(cc, value) {
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

// ---- Live Monitor ----
let monitorEnabled = false;
let monitorPaused = false;
let monitorGroup = null;
let selectedInstanceId = null;
let monitorAnimationFrame = null;
let monitorDirty = false;
const monitorMaxPoints = 100;

const monitorHistory = {};

if (assignControls) {
  renderAssignSettingUI();
}

function normalizeMonitorGroupKey(address) {
  if (typeof address !== 'string') return 'unknown';
  let key = address.trim().replace(/^\//, '').toLowerCase();
  if (!key) key = 'root';
  key = key.replace(/[\/\s]+/g, '_');
  key = key.replace(/[^a-z0-9_-]/gi, '_');
  return key;
}

function groupHasData(groupKey) {
  const data = monitorHistory[groupKey];
  if (!data) return false;
  return Object.values(data).some(arr => Array.isArray(arr) && arr.length > 0);
}

function valueToCC(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  // If value looks like -1..1, map accordingly.
  if (v >= -1 && v <= 1) return mapNeg1To1ToCC(v);
  // Otherwise assume 0..1 range.
  if (v >= 0 && v <= 1) return mapUnitToCC(v);
  // Otherwise normalize via clamping value between -1 and 1.
  return mapNeg1To1ToCC(Math.max(-1, Math.min(1, v)));
}

const groupColors = {
  inclination: '#28f5f5',
  magneticfield: '#ff55ff',
  rotationvector: '#33ccff',
  touch: '#ffcc33',
  default: '#999999',
};

const monitorBtn = document.getElementById('monitorBtn');
const monitorPanel = document.getElementById('monitorPanel');
const monitorTabBar = document.getElementById('monitorTabBar');
const monitorControls = document.getElementById('monitorControls');
const monitorStats = document.getElementById('monitorStats');
const monitorGraphArea = document.getElementById('monitorGraphArea');

function clamp01(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? Math.max(0, Math.min(1, v)) : null;
}

function limitArray(arr) {
  while (arr.length > monitorMaxPoints) arr.shift();
}

function addHistory(group, key, value) {
  if (!monitorHistory[group]) {
    monitorHistory[group] = {};
  }
  if (!monitorHistory[group][key]) {
    monitorHistory[group][key] = [];
  }
  monitorHistory[group][key].push(value);
  limitArray(monitorHistory[group][key]);
}

function drawLineChart(ctx, series, colors) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const len = Math.max(...series.map(s => s.length));
  if (len <= 1) return;
  const margin = 35;
  const plotW = w - margin * 2;
  const plotH = h - margin * 2;

  const allValues = series.flat();
  if (allValues.length === 0) return;
  
  // Auto-scale: use actual min/max from data only (like Arduino)
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max === min ? 1 : max - min;

  // Draw grid lines
  ctx.strokeStyle = '#334455';
  ctx.lineWidth = 1;
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#88ddff';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= 5; i += 1) {
    const y = margin + (plotH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(margin + plotW, y);
    ctx.stroke();
    
    // Label grid values (right-aligned)
    const gridValue = max - (range * i) / 5;
    ctx.fillText(gridValue.toFixed(3), margin - 5, y + 4);
  }

  series.forEach((values, idx) => {
    ctx.strokeStyle = colors[idx] || '#cccccc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = margin + (i / (monitorMaxPoints - 1)) * plotW;
      const y = margin + plotH - ((v - min) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw larger, more visible dots
    ctx.fillStyle = colors[idx] || '#cccccc';
    values.forEach((v, i) => {
      const x = margin + (i / (monitorMaxPoints - 1)) * plotW;
      const y = margin + plotH - ((v - min) / range) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      // Add outline for contrast
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });
}

function computeStats(values) {
  if (!values || values.length === 0) return { min: null, max: null, avg: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
  return { min, max, avg };
}

function selectMonitorGroup(group) {
  monitorGroup = group;
  monitorDirty = true;
  scheduleMonitorRender();
}

function scheduleMonitorRender() {
  if (monitorAnimationFrame) return;
  if (!monitorEnabled) return;
  monitorAnimationFrame = requestAnimationFrame(() => {
    monitorAnimationFrame = null;
    renderMonitor();
  });
}

function triggerMonitorUpdate() {
  monitorDirty = true;
  scheduleMonitorRender();
}

function renderMonitor() {
  if (!monitorPanel) return;
  if (!monitorEnabled) {
    monitorPanel.style.display = 'none';
    return;
  }
  monitorPanel.style.display = 'block';

  if (monitorControls) {
    monitorControls.innerHTML = '';
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = monitorPaused ? 'Resume' : 'Pause';
    pauseBtn.style.padding = '6px 12px';
    pauseBtn.style.color = '#fff';
    pauseBtn.style.border = '2px solid #00ccff';
    pauseBtn.style.background = monitorPaused ? '#00ccff' : '#222';
    pauseBtn.style.color = monitorPaused ? '#000' : '#00ccff';
    pauseBtn.style.borderRadius = '6px';
    pauseBtn.style.cursor = 'pointer';
    pauseBtn.style.fontWeight = 'bold';
    pauseBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      monitorPaused = !monitorPaused;
      pauseBtn.textContent = monitorPaused ? 'Resume' : 'Pause';
      pauseBtn.style.background = monitorPaused ? '#00ccff' : '#222';
      pauseBtn.style.color = monitorPaused ? '#000' : '#00ccff';
      // Force immediate render to reflect pause state
      monitorDirty = true;
      if (monitorAnimationFrame) {
        cancelAnimationFrame(monitorAnimationFrame);
        monitorAnimationFrame = null;
      }
      renderMonitor();
    };
    monitorControls.appendChild(pauseBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.padding = '6px 12px';
    clearBtn.style.color = '#00ccff';
    clearBtn.style.border = '2px solid #00ccff';
    clearBtn.style.background = '#222';
    clearBtn.style.borderRadius = '6px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.fontWeight = 'bold';
    clearBtn.onclick = () => {
      // Clear all monitored data and return to empty state
      Object.keys(monitorHistory).forEach((k) => delete monitorHistory[k]);
      monitorGroup = null;
      selectedInstanceId = null;
      renderAssignSettingUI();
      monitorDirty = true;
      renderMonitor();
    };
    monitorControls.appendChild(clearBtn);

    if (monitorGroup) {
      const metrics = monitorHistory[monitorGroup] ? Object.keys(monitorHistory[monitorGroup]) : [];
      if (metrics.length > 0) {
        const metricSelect = document.createElement('select');
        metricSelect.style.padding = '6px 10px';
        metricSelect.style.color = '#00ccff';
        metricSelect.style.background = '#111';
        metricSelect.style.border = '2px solid #00ccff';
        metricSelect.style.borderRadius = '6px';
        metricSelect.style.cursor = 'pointer';
        metricSelect.style.fontWeight = 'bold';
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'All metrics';
        metricSelect.appendChild(allOpt);
        metrics.forEach((metric) => {
          const opt = document.createElement('option');
          opt.value = metric;
          opt.textContent = metric;
          metricSelect.appendChild(opt);
        });
        metricSelect.value = selectedInstanceId ?? 'all';
        metricSelect.onchange = () => {
          selectedInstanceId = metricSelect.value === 'all' ? null : metricSelect.value;
          triggerMonitorUpdate();
        };
        monitorControls.appendChild(metricSelect);
      }
    }
  }

  if (monitorTabBar) {
    monitorTabBar.innerHTML = '';
    const groups = Object.keys(monitorHistory).filter(g => groupHasData(g));
    if (groups.length === 0) {
      monitorGroup = null;
    }

    groups.forEach((g) => {
      const btn = document.createElement('button');
      btn.textContent = g;
      btn.style.background = g === monitorGroup ? '#00ccff' : '#222';
      btn.style.color = '#fff';
      btn.style.border = '1px solid #00ccff';
      btn.style.borderRadius = '6px';
      btn.style.padding = '5px 10px';
      btn.style.cursor = 'pointer';
      btn.onclick = () => selectMonitorGroup(g);
      btn.onmouseover = () => { btn.style.background = '#00aadd'; };
      btn.onmouseout = () => { btn.style.background = g === monitorGroup ? '#00ccff' : '#222'; };
      monitorTabBar.appendChild(btn);
    });
  }

  if (!monitorGraphArea) return;

  if (!monitorGroup || !groupHasData(monitorGroup)) {
    const nextGroup = Object.keys(monitorHistory).find(groupHasData);
    monitorGroup = nextGroup || null;
  }

  // Build summary text + chart
  monitorGraphArea.innerHTML = '';
  if (monitorStats) monitorStats.innerHTML = '';


  const dataSpec = monitorHistory[monitorGroup];
  if (!dataSpec) {
    monitorGraphArea.textContent = 'No data yet.';
    return;
  }

  let keys = Object.keys(dataSpec);
  if (selectedInstanceId) {
    keys = keys.includes(selectedInstanceId) ? [selectedInstanceId] : [];
  }
  if (keys.length === 0) {
    monitorGraphArea.textContent = 'No data yet.';
    return;
  }

  if (monitorStats) {
    monitorStats.innerHTML = '';
    keys.forEach((key) => {
      const stats = computeStats(dataSpec[key]);
      const statItem = document.createElement('div');
      statItem.style.color = '#00ccff';
      statItem.style.fontSize = '0.8rem';
      statItem.style.padding = '5px 10px';
      statItem.style.border = '2px solid #00ccff';
      statItem.style.borderRadius = '8px';
      statItem.style.fontWeight = 'bold';
      statItem.style.background = '#111';
      statItem.textContent = `${key}: min=${stats.min?.toFixed(3) ?? '--'} max=${stats.max?.toFixed(3) ?? '--'} avg=${stats.avg?.toFixed(3) ?? '--'}`;
      monitorStats.appendChild(statItem);
    });
  }

  const legend = document.createElement('div');
  legend.style.display = 'flex';
  legend.style.gap = '10px';
  legend.style.flexWrap = 'wrap';
  legend.style.marginBottom = '8px';

  const lineColors = ['#66d9ff', '#ff66ff', '#6bff66', '#ffcc33'];
  keys.forEach((key, idx) => {
    const chip = document.createElement('span');
    chip.textContent = `${key}: ${dataSpec[key].at(-1)?.toFixed(3) ?? '--'}`;
    chip.style.padding = '5px 10px';
    chip.style.borderRadius = '8px';
    chip.style.background = '#1a1a1a';
    chip.style.color = lineColors[idx] || '#ccc';
    chip.style.border = `2px solid ${lineColors[idx] || '#ccc'}`;
    chip.style.fontWeight = 'bold';
    legend.appendChild(chip);
  });
  monitorGraphArea.appendChild(legend);

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 280;
  canvas.style.width = '100%';
  canvas.style.maxHeight = '280px';
  canvas.style.background = '#101010';
  canvas.style.border = '2px solid #00aaff';
  canvas.style.borderRadius = '6px';
  monitorGraphArea.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const series = keys.map((k) => dataSpec[k]);
  const colors = keys.map((_, i) => lineColors[i % lineColors.length]);
  drawLineChart(ctx, series, colors);
}

function addMonitorEntry(address, values) {
  if (!monitorEnabled) return;
  if (monitorPaused) return;

  const groupName = normalizeMonitorGroupKey(address);

  if (!monitorHistory[groupName]) {
    monitorHistory[groupName] = {};
    monitorDirty = true;
  }

  const entry = values && typeof values === 'object' ? values : {};

  Object.entries(entry).forEach(([k, v]) => {
    if (typeof v === 'number') {
      if (!monitorHistory[groupName][k]) monitorHistory[groupName][k] = [];
      monitorHistory[groupName][k].push(v);
      limitArray(monitorHistory[groupName][k]);
      // auto-mapped CC if in mapping
      assignMappings.forEach((m) => {
        if (m.groupName === groupName && m.metric === k) {
          sendCC(m.cc, valueToCC(v));
        }
      });
    }
  });

  if (!monitorGroup || !groupHasData(monitorGroup)) {
    monitorGroup = groupName;
  }

  renderAssignSettingUI();
  triggerMonitorUpdate();
}

if (monitorBtn) {
  monitorBtn.addEventListener('click', () => {
    monitorEnabled = !monitorEnabled;
    monitorBtn.textContent = monitorEnabled ? 'Monitoring ON' : 'Monitor';
    monitorDirty = true;
    renderMonitor();
  });
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

      renderAssignSettingUI();
      return;
    }

    // Rotation vector -> CC1 (use x component -1..1)
    if (data.address === '/rotationvector') {
      const x = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      const y = (typeof data.y === 'number') ? data.y : (Array.isArray(data.args) ? data.args[1] : undefined);
      const z = (typeof data.z === 'number') ? data.z : (Array.isArray(data.args) ? data.args[2] : undefined);
      const w = (typeof data.w === 'number') ? data.w : (Array.isArray(data.args) ? data.args[3] : undefined);
      if (monitorEnabled) {
        addMonitorEntry('/rotationvector', { x, y, z, w });
      }
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
      if (monitorEnabled) {
        addMonitorEntry(data.address, { id, x, y });
      }
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
      if (monitorEnabled) {
        addMonitorEntry('/inclination', { value: v });
      }
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
      if (monitorEnabled) {
        addMonitorEntry('/magneticfield', { x: mx, y: my, z: mz });
      }
      if ([mx, my, mz].every(v => typeof v === 'number')) {
        const mag = Math.sqrt(mx*mx + my*my + mz*mz);
        sendCC(3, mapMagToCC(mag));
      }
      return;
    }

    // Catch-all monitor for unknown addresses
    if (monitorEnabled && typeof data.address === 'string') {
      addMonitorEntry(data.address, {
        ...(data.args ? data.args.reduce((o, value, index) => ({ ...o, ['arg' + index]: value }), {}) : {}),
      });
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
