import { catchCall } from './getPokemon.js';

// Add WebSocket bridge for address collection and logging
const ws = new WebSocket('ws://localhost:8765'); // Change address as needed
ws.onopen = () => {
  console.log('Connected to sensor receiver WebSocket');
};

// ---- Utility functions ----
// 
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    // Accelerometer -> Force
    if (data.address === '/accelerometer') {
      const ax = (typeof data.x === 'number') ? data.x : (Array.isArray(data.args) ? data.args[0] : undefined);
      const ay = (typeof data.y === 'number') ? data.y : (Array.isArray(data.args) ? data.args[1] : undefined);
      const az = (typeof data.z === 'number') ? data.z : (Array.isArray(data.args) ? data.args[2] : undefined);
      if ([ax, ay, az].every(v => typeof v === 'number')) {
        const force = Math.sqrt(ax*ax + ay*ay + az*az);
        console.log("Force:", force.toFixed(2));
        if(force > 50){
          catchCall();
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

