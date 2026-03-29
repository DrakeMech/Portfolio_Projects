// transformationMapping.js  (TransformationMapping)

export function clampCC(v) {
  if (v == null || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(127, Math.round(v)));
}

export function mapUnitToCC(v) {
  if (v == null) return 0;
  return clampCC(v * 127);
}

export function mapNeg1To1ToCC(v) {
  if (v == null) return 0;
  return clampCC(((v + 1) / 2) * 127);
}

export function mapMagToCC(mag, minUT = 0, maxUT = 100) {
  if (mag == null) return 0;
  const lo = Math.min(minUT, maxUT);
  const hi = Math.max(minUT, maxUT);
  const t = hi > lo ? (mag - lo) / (hi - lo) : 0;
  return clampCC(Math.max(0, Math.min(1, t)) * 127);
}

export function mapAngleToCC(angleRad, span = 'half') {
  if (typeof angleRad !== 'number') return 0;
  if (span === 'full') {
    const t = (angleRad + Math.PI) / (2 * Math.PI); // [-PI,PI] -> [0,1]
    return clampCC(t * 127);
  } else {
    const t = (angleRad + Math.PI / 2) / Math.PI;   // [-PI/2,PI/2] -> [0,1]
    return clampCC(t * 127);
  }
}

export function valueToCC(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v >= -1 && v <= 1) return mapNeg1To1ToCC(v);
  if (v >= 0 && v <= 1) return mapUnitToCC(v);
  return mapNeg1To1ToCC(Math.max(-1, Math.min(1, v)));
}
