import { catchCall } from './getPokemon.js';

// Map a value from one range to another between 0 and 1
function mapping(min,max,value){
  return (value - min) * (1 - 0) / (max - min) + 0;
}

//Easing function for smooth transitions
function easeInOutQuad(t) {
  return t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
}

function bellCurve(t) {
  return Math.exp(-((t - 0.5) ** 2) / (2 * 0.1 ** 2));
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function easeInExpo(x) {
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
}

// Add WebSocket bridge for address collection and logging
const ws = new WebSocket('ws://localhost:8765'); // Change address as needed
ws.onopen = () => {
  console.log('Connected to sensor receiver WebSocket');
};

// ---- Utility functions ----
// 
let forceTimer = null;
let forceStartTime = null;
let forceActive = false;
const FORCE_THRESHOLD = 20;
const FORCE_DURATION = 400; // ms

// Add canvas overlay for force circle
const imageEl = document.getElementById('imageEl');
let forceCircleCanvas = document.createElement('canvas');
forceCircleCanvas.style.position = 'absolute';
forceCircleCanvas.style.pointerEvents = 'none';
forceCircleCanvas.width = 400;
forceCircleCanvas.height = 400;
forceCircleCanvas.style.left = '0px';
forceCircleCanvas.style.top = '0px';
document.body.appendChild(forceCircleCanvas);
let ctx = forceCircleCanvas.getContext('2d');

let currentRadius = 20;
let targetRadius = 180;
let animationFrame = null;

function animateForceCircle() {
  if (Math.abs(currentRadius - targetRadius) > 0.5) {
    currentRadius += (targetRadius - currentRadius) * 0.09; // interpolation factor
    drawForceCircle(currentRadius);
    animationFrame = requestAnimationFrame(animateForceCircle);
  } else {
    currentRadius = targetRadius;
    drawForceCircle(currentRadius);
    animationFrame = null;
  }
}

function drawForceCircle(radius) {
  ctx.clearRect(0, 0, forceCircleCanvas.width, forceCircleCanvas.height);
  // Draw threshold circle proportional to force scale
  const minRadius = 20;
  const maxRadius = 180;
  const thresholdRatio = FORCE_THRESHOLD / 100; // 0..1
  const thresholdRadius = minRadius + (maxRadius - minRadius) * thresholdRatio;
  ctx.save();
  ctx.beginPath();
  ctx.arc(forceCircleCanvas.width/2, forceCircleCanvas.height/2, thresholdRadius, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Draw animated force circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(forceCircleCanvas.width/2, forceCircleCanvas.height/2, radius, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 4;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function updateForceCircle(force) {
  // Center canvas on imageEl
  const rect = imageEl.getBoundingClientRect();
  forceCircleCanvas.style.left = `${rect.left + window.scrollX + rect.width/2 - forceCircleCanvas.width/2}px`;
  forceCircleCanvas.style.top = `${rect.top + window.scrollY + rect.height/2 - forceCircleCanvas.height/2}px`;
  targetRadius = 20 + force * 1.6;
  if (!animationFrame) animateForceCircle();
}

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    // Accelerometer -> Force
    if (data.address === '/accelerometer') {
      const ax = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      const ay = (typeof data.y === 'number') ? data.y : (Array.isArray(data.args) ? data.args[1] : undefined);
      const az = (typeof data.z === 'number') ? data.z : (Array.isArray(data.args) ? data.args[2] : undefined);
      if ([ax, ay, az].every(v => typeof v === 'number')) {
        let force = Math.sqrt(ax*ax + ay*ay + az*az);
        force = mapping(9,90,force); // Map to 0-1 range
        force = bellCurve(force);
        force = Math.min(Math.max(force * 100, 0), 100); // Scale to 0-100 and clamp
        console.log("Force:", force.toFixed(2));
        updateForceCircle(force);
        if (force >= FORCE_THRESHOLD) {
          if (!forceActive) {
            forceActive = true;
            forceStartTime = Date.now();
            forceTimer = setTimeout(() => {
              catchCall();
              forceActive = false;
              forceTimer = null;
              forceStartTime = null;
            }, FORCE_DURATION);
          }
        } else {
          if (forceActive) {
            // Cancel timer if force drops below threshold
            clearTimeout(forceTimer);
            forceActive = false;
            forceTimer = null;
            forceStartTime = null;
          }
        }
      }
    }

    // Rotation vector -> (use x component -1..1)
    if (data.address === '/rotationvector') {
      const x = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      if (typeof x === 'number') {
      console.log("Rotation vector x:", x);
      }
      return;
    }

    // Touch events
    if (typeof data.address === 'string' && data.address.startsWith('/touch')) {
      console.log("Touch data:", data);
      return;
    }

    // Inclination
    if (data.address === '/inclination') {
      const v = (typeof data.value === 'number') ? data.value : (Array.isArray(data.args) ? data.args[0] : undefined);
      if (typeof v === 'number') {
        console.log("Inclination:", v);
      }
      return;
    }

    // Magnetic field
    if (data.address === '/magneticfield') {
      const mx = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      const my = (typeof data.y === 'number') ? data.y : (Array.isArray(data.args) ? data.args[1] : undefined);
      const mz = (typeof data.z === 'number') ? data.z : (Array.isArray(data.args) ? data.args[2] : undefined);
      if ([mx, my, mz].every(v => typeof v === 'number')) {
        console.log("Magnetic field:", mx, my, mz);
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

