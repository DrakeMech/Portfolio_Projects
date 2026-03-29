// transformation-editor.js
import { registerCustomTransformation } from './transformationSelector.js';

export function setupTransformationEditor() {
  const applyBtn = document.getElementById('applyTransformCode');
  const codeTextarea = document.getElementById('customTransformCode');
  const statusEl = document.getElementById('transformationStatus');

  if (!applyBtn) return;

  applyBtn.addEventListener('click', () => {
    const code = codeTextarea.value;
    if (!code.trim()) {
      if (statusEl) statusEl.textContent = 'No code to load.';
      return;
    }

    try {
      // Parse custom transformation functions from code
      const functionRegex = /export\s+function\s+(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/g;
      let match;
      let count = 0;

      while ((match = functionRegex.exec(code)) !== null) {
        const functionName = match[1];
        const paramsString = match[2];
        const functionBody = match[3];
        
        // Parse parameter names
        const params = paramsString.split(',').map(p => p.trim()).filter(p => p);
        
        // Create function from the code
        const fn = new Function(...params, functionBody);
        
        registerCustomTransformation(functionName, function(...args) {
          try {
            return fn(...args);
          } catch (e) {
            console.error(`Error in ${functionName}:`, e);
            return 0;
          }
        }, params);

        count++;
      }

      if (count > 0) {
        if (statusEl) {
          statusEl.textContent = `✓ Loaded ${count} custom transformation(s)`;
          statusEl.style.color = '#00ff00';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = 'No transformations found. Check syntax.';
          statusEl.style.color = '#ffaa00';
        }
      }
    } catch (e) {
      console.error('Transformation code error:', e);
      if (statusEl) {
        statusEl.textContent = `Error: ${e.message}`;
        statusEl.style.color = '#ff4444';
      }
    }
  });
}
