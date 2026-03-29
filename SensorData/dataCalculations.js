// dataCalculations.js
// Compute derived values from raw sensor data

export function calculateDerivedValues(groupName, address, values) {
  const derived = {};

  // Touch calculations: if we have x and y, calculate magnitude and angle
  if (address.startsWith('/touch') && typeof values.x === 'number' && typeof values.y === 'number') {
    derived.magnitude = Math.sqrt(values.x * values.x + values.y * values.y);
    derived.angle = Math.atan2(values.y, values.x); // angle in radians
    derived.angleDeg = (derived.angle * 180) / Math.PI; // angle in degrees
    // Store touch points for polygon calcs later
    derived._touchPoint = [values.x, values.y];
  }

  // Magnetic field: calculate magnitude from x,y,z
  if (address === '/magneticfield' && typeof values.x === 'number' && typeof values.y === 'number' && typeof values.z === 'number') {
    derived.magnitude = Math.sqrt(values.x * values.x + values.y * values.y + values.z * values.z);
  }

  // Rotation vector: calculate magnitude from x,y,z,w
  if (address === '/rotationvector') {
    if (typeof values.x === 'number' && typeof values.y === 'number' && typeof values.z === 'number') {
      derived.magnitude = Math.sqrt(values.x * values.x + values.y * values.y + values.z * values.z);
    }
    if (typeof values.x === 'number' && typeof values.y === 'number') {
      derived.angle = Math.atan2(values.y, values.x); // angle in radians
      derived.angleDeg = (derived.angle * 180) / Math.PI; // angle in degrees
    }
  }

  // General: if we have x and y, calculate distance from origin
  if (typeof values.x === 'number' && typeof values.y === 'number' && !derived.magnitude) {
    derived.distance = Math.sqrt(values.x * values.x + values.y * values.y);
  }

  return derived;
}

export function calculateTouchPolygonData(touchPoints) {
  if (!Array.isArray(touchPoints) || touchPoints.length < 2) {
    return {};
  }

  const derived = {};

  // Area
  if (touchPoints.length >= 3) {
    const n = touchPoints.length;
    let cx = 0, cy = 0;
    for (const [x, y] of touchPoints) {
      cx += x;
      cy += y;
    }
    cx /= n;
    cy /= n;

    const pts = touchPoints.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    let area2 = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      area2 += x1 * y2 - x2 * y1;
    }
    derived.polygonArea = Math.abs(area2) * 0.5;

    // Angle
    let Sxx = 0, Sxy = 0, Syy = 0;
    for (const [x, y] of touchPoints) {
      const dx = x - cx, dy = y - cy;
      Sxx += dx * dx;
      Sxy += dx * dy;
      Syy += dy * dy;
    }
    derived.polygonAngle = 0.5 * Math.atan2(2 * Sxy, Sxx - Syy);
    derived.polygonAngleDeg = (derived.polygonAngle * 180) / Math.PI;
  }

  // Centroid
  let cx = 0, cy = 0;
  for (const [x, y] of touchPoints) {
    cx += x;
    cy += y;
  }
  cx /= touchPoints.length;
  cy /= touchPoints.length;
  derived.centroidX = cx;
  derived.centroidY = cy;

  // Bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of touchPoints) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  derived.width = maxX - minX;
  derived.height = maxY - minY;

  return derived;
}

export function calculatePairwiseTouchData(touchPoints, touchIds) {
  const derived = {};
  const ids = Object.keys(touchIds).map(Number).sort();

  // Pairwise distances and angles
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const id1 = ids[i], id2 = ids[j];
      const point1 = touchPoints[id1];
      const point2 = touchPoints[id2];
      if (point1 && point2) {
        const [x1, y1] = point1;
        const [x2, y2] = point2;
        const dx = x2 - x1, dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        derived[`distance_${id1}_${id2}`] = distance;
        derived[`angle_${id1}_${id2}`] = angle;
        derived[`angle_deg_${id1}_${id2}`] = (angle * 180) / Math.PI;
      }
    }
  }

  // Triplet areas
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let k = j + 1; k < ids.length; k++) {
        const id1 = ids[i], id2 = ids[j], id3 = ids[k];
        const point1 = touchPoints[id1];
        const point2 = touchPoints[id2];
        const point3 = touchPoints[id3];
        if (point1 && point2 && point3) {
          const [x1, y1] = point1;
          const [x2, y2] = point2;
          const [x3, y3] = point3;
          // Area of triangle using shoelace formula
          const area = Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
          derived[`area_${id1}_${id2}_${id3}`] = area;
        }
      }
    }
  }

  return derived;
}
