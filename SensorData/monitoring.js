// monitoring.js  (monitoringScript)
import { valueToCC } from './transformationMapping.js';
import { sendCC } from './midi-setup.js';
import { builtInTransformations, applyTransformation, registerCustomTransformation, getAllTransformations } from './transformationSelector.js';
import { calculateDerivedValues, calculateTouchPolygonData } from './dataCalculations.js';

export const monitorState = {
  monitorEnabled: false,
  monitorPaused: false,
  monitorGroup: null,
  selectedMetric: null,
  monitorHistory: {},
};

export let assignMappings = [];

const elements = {
  monitorPanel: document.getElementById('monitorPanel'),
  monitorControls: document.getElementById('monitorControls'),
  monitorTabBar: document.getElementById('monitorTabBar'),
  monitorStats: document.getElementById('monitorStats'),
  monitorGraphArea: document.getElementById('monitorGraphArea'),
  monitorBtn: document.getElementById('monitorBtn'),
};

const assignControls = document.getElementById('assignControls');
const assignSettingContainer = document.createElement('div');
assignSettingContainer.style.marginTop = '8px';
assignSettingContainer.style.display = 'flex';
assignSettingContainer.style.gap = '8px';
assignSettingContainer.style.flexWrap = 'wrap';
if (assignControls) assignControls.appendChild(assignSettingContainer);

let animationFrame = null;

function limitArray(arr, max = 100) {
  while (arr.length > max) arr.shift();
}

export function groupHasData(groupName) {
  const group = monitorState.monitorHistory[groupName];
  if (!group) return false;
  return Object.values(group).some((arr) => Array.isArray(arr) && arr.length > 0);
}

export function getGroupMetrics(groupName) {
  const group = monitorState.monitorHistory[groupName];
  return group ? Object.keys(group).filter(k => Array.isArray(group[k])) : [];
}

export function addMonitorEntry(address, values) {
  if (!monitorState.monitorEnabled || monitorState.monitorPaused) return;

  const groupName = address.replace(/^\//, '') || 'root';
  if (!monitorState.monitorHistory[groupName]) {
    monitorState.monitorHistory[groupName] = {};
  }

  // Add raw values
  Object.entries(values).forEach(([k, v]) => {
    if (typeof v === 'number') {
      if (!monitorState.monitorHistory[groupName][k]) {
        monitorState.monitorHistory[groupName][k] = [];
      }
      monitorState.monitorHistory[groupName][k].push(v);
      limitArray(monitorState.monitorHistory[groupName][k]);
    }
  });

  // Calculate and add derived values
  const derived = calculateDerivedValues(groupName, address, values);
  Object.entries(derived).forEach(([k, v]) => {
    if (typeof v === 'number' && !k.startsWith('_')) {
      if (!monitorState.monitorHistory[groupName][k]) {
        monitorState.monitorHistory[groupName][k] = [];
      }
      monitorState.monitorHistory[groupName][k].push(v);
      limitArray(monitorState.monitorHistory[groupName][k]);
    }
  });

  // Calculate touch polygon data if we have touch points
  if (address.startsWith('/touch')) {
    // Collect all current touch points
    const touchGroupName = 'touch';
    const touchData = monitorState.monitorHistory[touchGroupName];
    if (touchData) {
      const touchPoints = [];
      const idSet = new Set();
      
      // Gather x,y pairs by ID
      Object.keys(touchData).forEach(k => {
        const match = k.match(/^x(\d+)$/) || k.match(/^y(\d+)$/);
        if (match) {
          const id = match[1];
          idSet.add(id);
        }
      });

      idSet.forEach(id => {
        const x = touchData[`x${id}`];
        const y = touchData[`y${id}`];
        if (x && x.length > 0 && y && y.length > 0) {
          touchPoints.push([x[x.length - 1], y[y.length - 1]]);
        }
      });

      if (touchPoints.length > 0) {
        const polygonData = calculateTouchPolygonData(touchPoints);
        Object.entries(polygonData).forEach(([k, v]) => {
          if (typeof v === 'number') {
            if (!monitorState.monitorHistory[touchGroupName][k]) {
              monitorState.monitorHistory[touchGroupName][k] = [];
            }
            monitorState.monitorHistory[touchGroupName][k].push(v);
            limitArray(monitorState.monitorHistory[touchGroupName][k]);
          }
        });
      }
    }
  }

  // Apply mappings with multi-arg support
  assignMappings.forEach(mapping => {
    const sourceData = monitorState.monitorHistory[mapping.groupName];
    if (!sourceData) return;

    const args = {};
    
    // Build arguments from specified sources
    if (mapping.argumentMapping) {
      Object.entries(mapping.argumentMapping).forEach(([argName, source]) => {
        if (source.group && source.metric) {
          const metricData = monitorState.monitorHistory[source.group]?.[source.metric];
          if (metricData && metricData.length > 0) {
            args[argName] = metricData[metricData.length - 1];
          }
        }
      });
    } else {
      // Fallback: use primary metric
      const metricData = sourceData[mapping.metric];
      if (metricData && metricData.length > 0) {
        args.value = metricData[metricData.length - 1];
      }
    }

    const ccValue = applyTransformation(mapping.transformationKey || 'valueToCC', args);
    sendCC(mapping.cc, ccValue);
  });

  if (!monitorState.monitorGroup || !groupHasData(monitorState.monitorGroup)) {
    monitorState.monitorGroup = groupName;
  }

  renderMonitor();
  renderAssignSettingUI();
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
      const x = margin + (i / (100 - 1)) * plotW;
      const y = margin + plotH - ((v - min) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

export function renderMonitor() {
  if (!elements.monitorPanel) return;
  if (!monitorState.monitorEnabled) {
    elements.monitorPanel.style.display = 'none';
    return;
  }
  elements.monitorPanel.style.display = 'block';

  if (elements.monitorControls) {
    elements.monitorControls.innerHTML = '';
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = monitorState.monitorPaused ? 'Resume' : 'Pause';
    pauseBtn.style.padding = '6px 12px';
    pauseBtn.style.color = '#fff';
    pauseBtn.style.border = '2px solid #00ccff';
    pauseBtn.style.background = monitorState.monitorPaused ? '#00ccff' : '#222';
    pauseBtn.style.color = monitorState.monitorPaused ? '#000' : '#00ccff';
    pauseBtn.style.borderRadius = '6px';
    pauseBtn.style.cursor = 'pointer';
    pauseBtn.style.fontWeight = 'bold';
    pauseBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      monitorState.monitorPaused = !monitorState.monitorPaused;
      pauseBtn.textContent = monitorState.monitorPaused ? 'Resume' : 'Pause';
      pauseBtn.style.background = monitorState.monitorPaused ? '#00ccff' : '#222';
      pauseBtn.style.color = monitorState.monitorPaused ? '#000' : '#00ccff';
      // Force immediate render to reflect pause state
      monitorDirty = true;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      renderMonitor();
    };
    elements.monitorControls.appendChild(pauseBtn);

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
      Object.keys(monitorState.monitorHistory).forEach((k) => delete monitorState.monitorHistory[k]);
      monitorState.monitorGroup = null;
      monitorState.selectedMetric = null;
      renderAssignSettingUI();
      monitorDirty = true;
      renderMonitor();
    };
    elements.monitorControls.appendChild(clearBtn);

    if (monitorState.monitorGroup) {
      const metrics = monitorState.monitorHistory[monitorState.monitorGroup] ? Object.keys(monitorState.monitorHistory[monitorState.monitorGroup]) : [];
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
        metricSelect.value = monitorState.selectedMetric ?? 'all';
        metricSelect.onchange = () => {
          monitorState.selectedMetric = metricSelect.value === 'all' ? null : metricSelect.value;
          triggerMonitorUpdate();
        };
        elements.monitorControls.appendChild(metricSelect);
      }
    }
  }

  if (elements.monitorTabBar) {
    elements.monitorTabBar.innerHTML = '';
    const groups = Object.keys(monitorState.monitorHistory).filter(g => groupHasData(g));
    if (groups.length === 0) {
      monitorState.monitorGroup = null;
    }

    groups.forEach((g) => {
      const btn = document.createElement('button');
      btn.textContent = g;
      btn.style.background = g === monitorState.monitorGroup ? '#00ccff' : '#222';
      btn.style.color = '#fff';
      btn.style.border = '1px solid #00ccff';
      btn.style.borderRadius = '6px';
      btn.style.padding = '5px 10px';
      btn.style.cursor = 'pointer';
      btn.onclick = () => selectMonitorGroup(g);
      btn.onmouseover = () => { btn.style.background = '#00aadd'; };
      btn.onmouseout = () => { btn.style.background = g === monitorState.monitorGroup ? '#00ccff' : '#222'; };
      elements.monitorTabBar.appendChild(btn);
    });
  }

  if (!elements.monitorGraphArea) return;

  if (!monitorState.monitorGroup || !groupHasData(monitorState.monitorGroup)) {
    const nextGroup = Object.keys(monitorState.monitorHistory).find(groupHasData);
    monitorState.monitorGroup = nextGroup || null;
  }

  // Build summary text + chart
  elements.monitorGraphArea.innerHTML = '';
  if (elements.monitorStats) elements.monitorStats.innerHTML = '';

  const dataSpec = monitorState.monitorHistory[monitorState.monitorGroup];
  if (!dataSpec) {
    elements.monitorGraphArea.textContent = 'No data yet.';
    return;
  }

  let keys = Object.keys(dataSpec);
  if (monitorState.selectedMetric) {
    keys = keys.includes(monitorState.selectedMetric) ? [monitorState.selectedMetric] : [];
  }
  if (keys.length === 0) {
    elements.monitorGraphArea.textContent = 'No data yet.';
    return;
  }

  if (elements.monitorStats) {
    elements.monitorStats.innerHTML = '';
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
      elements.monitorStats.appendChild(statItem);
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
  elements.monitorGraphArea.appendChild(legend);

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 280;
  canvas.style.width = '100%';
  canvas.style.maxHeight = '280px';
  canvas.style.background = '#101010';
  canvas.style.border = '2px solid #00aaff';
  canvas.style.borderRadius = '6px';
  elements.monitorGraphArea.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const series = keys.map((k) => dataSpec[k]);
  const colors = keys.map((_, i) => lineColors[i % lineColors.length]);
  drawLineChart(ctx, series, colors);
}

function computeStats(values) {
  if (!values || values.length === 0) return { min: null, max: null, avg: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
  return { min, max, avg };
}

function selectMonitorGroup(group) {
  monitorState.monitorGroup = group;
  monitorDirty = true;
  scheduleMonitorRender();
}

function scheduleMonitorRender() {
  if (animationFrame) return;
  if (!monitorState.monitorEnabled) return;
  animationFrame = requestAnimationFrame(() => {
    animationFrame = null;
    renderMonitor();
  });
}

function triggerMonitorUpdate() {
  monitorDirty = true;
  scheduleMonitorRender();
}

let monitorDirty = false;

export function renderAssignSettingUI() {
  if (!assignSettingContainer) return;
  assignSettingContainer.innerHTML = '';

  const currentGroups = Object.keys(monitorState.monitorHistory).filter(g => groupHasData(g));

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
    const selectedData = monitorState.monitorHistory[groupSelect.value] || {};
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

  const transformSelect = document.createElement('select');
  transformSelect.style.padding = '4px 7px';
  transformSelect.style.background = '#111';
  transformSelect.style.border = '1px solid #00ccff';
  transformSelect.style.color = '#fff';
  transformSelect.style.marginRight = '6px';
  const allTransforms = getAllTransformations();
  Object.entries(allTransforms).forEach(([key, transform]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = transform.name;
    transformSelect.appendChild(opt);
  });
  transformSelect.value = 'valueToCC';

  // Container for argument mapping selectors (hidden until needed)
  const argMappingContainer = document.createElement('div');
  argMappingContainer.style.display = 'none';
  argMappingContainer.style.marginTop = '8px';
  argMappingContainer.style.padding = '8px';
  argMappingContainer.style.background = '#0a0a0a';
  argMappingContainer.style.border = '1px solid #00aaff';
  argMappingContainer.style.borderRadius = '4px';

  function updateArgMapping() {
    argMappingContainer.innerHTML = '';
    const transform = getAllTransformations()[transformSelect.value];
    if (!transform || !transform.args || transform.args.length <= 1) {
      argMappingContainer.style.display = 'none';
      return;
    }

    argMappingContainer.style.display = 'block';
    const label = document.createElement('div');
    label.textContent = 'Map data sources to arguments:';
    label.style.marginBottom = '8px';
    label.style.fontSize = '0.9rem';
    label.style.color = '#aaa';
    argMappingContainer.appendChild(label);

    transform.args.forEach(argName => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.marginBottom = '6px';
      row.style.alignItems = 'center';

      const argLabel = document.createElement('label');
      argLabel.textContent = `${argName}:`;
      argLabel.style.minWidth = '80px';
      argLabel.style.fontSize = '0.9rem';
      row.appendChild(argLabel);

      const groupSel = document.createElement('select');
      groupSel.style.padding = '4px 7px';
      groupSel.style.background = '#111';
      groupSel.style.border = '1px solid #00ccff';
      groupSel.style.color = '#fff';
      groupSel.style.fontSize = '0.85rem';
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = 'Select group';
      groupSel.appendChild(defOpt);

      const metricSel = document.createElement('select');
      metricSel.style.padding = '4px 7px';
      metricSel.style.background = '#111';
      metricSel.style.border = '1px solid #00ccff';
      metricSel.style.color = '#fff';
      metricSel.style.fontSize = '0.85rem';
      metricSel.disabled = true;

      currentGroups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        groupSel.appendChild(opt);
      });

      groupSel.addEventListener('change', () => {
        metricSel.innerHTML = '';
        if (!groupSel.value) {
          metricSel.disabled = true;
          return;
        }
        const gData = monitorState.monitorHistory[groupSel.value] || {};
        const metrics = Object.keys(gData).filter(k => Array.isArray(gData[k]));
        metrics.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          metricSel.appendChild(opt);
        });
        metricSel.disabled = metrics.length === 0;

        // Store reference
        metricSel.dataset.argName = argName;
        metricSel.dataset.groupName = groupSel.value;
      });

      row.appendChild(groupSel);
      row.appendChild(metricSel);
      argMappingContainer.appendChild(row);
    });
  }

  transformSelect.addEventListener('change', updateArgMapping);

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
    const transformKey = transformSelect.value;
    if (!group || !metric || !Number.isInteger(cc) || cc < 1 || cc > 127) return;

    // Collect argument mappings
    const argumentMapping = {};
    const argSelects = argMappingContainer.querySelectorAll('select[data-arg-name]');
    argSelects.forEach(sel => {
      if (sel.dataset.argName && sel.dataset.groupName && sel.value) {
        argumentMapping[sel.dataset.argName] = {
          group: sel.dataset.groupName,
          metric: sel.value,
        };
      }
    });

    assignMappings.push({
      groupName: group,
      metric,
      cc,
      transformationKey: transformKey,
      argumentMapping: Object.keys(argumentMapping).length > 0 ? argumentMapping : undefined,
    });
    groupSelect.value = '';
    metricSelect.innerHTML = '';
    metricSelect.disabled = true;
    metricSelect.appendChild(defaultMetricOpt);
    ccInput.value = '';
    transformSelect.value = 'valueToCC';
    updateArgMapping();
    renderAssignMappingList();
  });

  assignSettingContainer.appendChild(groupSelect);
  assignSettingContainer.appendChild(metricSelect);
  assignSettingContainer.appendChild(ccInput);
  assignSettingContainer.appendChild(transformSelect);
  assignSettingContainer.appendChild(argMappingContainer);
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

  // Mappings info and buttons
  const mappingsContainer = document.createElement('div');
  mappingsContainer.style.display = 'flex';
  mappingsContainer.style.flexDirection = 'column';
  mappingsContainer.style.gap = '8px';
  mappingsContainer.style.width = '100%';

  assignMappings.forEach((m, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = '8px';
    row.style.color = '#ddd';
    row.style.marginBottom = '8px';
    
    const infoDiv = document.createElement('div');
    infoDiv.style.flex = '1';

    const mainLabel = document.createElement('div');
    mainLabel.textContent = `${m.groupName}:${m.metric} → CC${m.cc}`;
    mainLabel.style.fontWeight = 'bold';
    infoDiv.appendChild(mainLabel);

    if (m.argumentMapping) {
      const argsDiv = document.createElement('div');
      argsDiv.style.fontSize = '0.8rem';
      argsDiv.style.opacity = '0.7';
      argsDiv.style.marginTop = '4px';
      const argTexts = Object.entries(m.argumentMapping).map(([argName, source]) => 
        `${argName}=${source.group}:${source.metric}`
      );
      argsDiv.textContent = `Args: ${argTexts.join(', ')}`;
      infoDiv.appendChild(argsDiv);
    }

    row.appendChild(infoDiv);

    const transformSelect = document.createElement('select');
    transformSelect.style.padding = '4px 7px';
    transformSelect.style.background = '#111';
    transformSelect.style.border = '1px solid #00ccff';
    transformSelect.style.color = '#fff';
    transformSelect.style.fontSize = '0.85rem';
    const allTransforms = getAllTransformations();
    Object.entries(allTransforms).forEach(([key, transform]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = transform.name;
      transformSelect.appendChild(opt);
    });
    transformSelect.value = m.transformationKey || 'valueToCC';
    transformSelect.addEventListener('change', () => {
      m.transformationKey = transformSelect.value;
    });
    row.appendChild(transformSelect);
    
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test';
    testBtn.style.padding = '4px 8px';
    testBtn.style.border = '1px solid #00ccff';
    testBtn.style.background = '#222';
    testBtn.style.color = '#00ccff';
    testBtn.style.cursor = 'pointer';
    testBtn.style.fontSize = '0.85rem';
    testBtn.addEventListener('click', () => {
      const testArgs = {};
      if (m.argumentMapping) {
        Object.entries(m.argumentMapping).forEach(([argName, source]) => {
          testArgs[argName] = 0.5; // Test with 0.5
        });
      } else {
        testArgs.value = 0.5;
      }
      const ccValue = applyTransformation(m.transformationKey || 'valueToCC', testArgs);
      sendCC(m.cc, ccValue);
    });
    row.appendChild(testBtn);

    const del = document.createElement('button');
    del.textContent = 'x';
    del.style.padding = '0 6px';
    del.style.border = '1px solid #ff4444';
    del.style.background = '#221111';
    del.style.color = '#ff4444';
    del.style.cursor = 'pointer';
    del.onclick = () => { assignMappings.splice(idx, 1); renderAssignMappingList(); };
    row.appendChild(del);
    mappingsContainer.appendChild(row);
  });

  list.appendChild(mappingsContainer);
}

export function setupMonitorButton() {
  if (!elements.monitorBtn) return;
  elements.monitorBtn.addEventListener('click', () => {
    monitorState.monitorEnabled = !monitorState.monitorEnabled;
    elements.monitorBtn.textContent = monitorState.monitorEnabled ? 'Monitoring ON' : 'Monitor';
    monitorDirty = true;
    renderMonitor();
  });
}
