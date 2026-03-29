// app.js
import { setupMonitorButton, renderAssignSettingUI } from './monitoring.js';
import { midiOutput, sendCC } from './midi-setup.js';
import { setupTransformationEditor } from './transformation-editor.js';

// Assign buttons (send CC=127 for mapping)
const assignControls = document.getElementById('assignControls');

function updateGroupAssignHelpers() {
  // Deprecated in current simplified mode. Use renderAssignSettingUI() instead.
}

// Initialize
setupMonitorButton();
renderAssignSettingUI();
setupTransformationEditor();