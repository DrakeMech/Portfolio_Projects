// transformationSelector.js
import * as Transform from './transformationMapping.js';

export const builtInTransformations = {
  'mapUnitToCC': {
    name: 'Unit (0-1) → CC',
    fn: Transform.mapUnitToCC,
    args: ['value'],
  },
  'mapNeg1To1ToCC': {
    name: 'Bipolar (-1 to 1) → CC',
    fn: Transform.mapNeg1To1ToCC,
    args: ['value'],
  },
  'mapMagToCC': {
    name: 'Magnitude (0-100) → CC',
    fn: Transform.mapMagToCC,
    args: ['magnitude', 'minUT', 'maxUT'],
  },
  'mapAngleToCC_half': {
    name: 'Angle (half, -π/2 to π/2) → CC',
    fn: (v) => Transform.mapAngleToCC(v, 'half'),
    args: ['angle'],
  },
  'mapAngleToCC_full': {
    name: 'Angle (full, -π to π) → CC',
    fn: (v) => Transform.mapAngleToCC(v, 'full'),
    args: ['angle'],
  },
  'clampCC': {
    name: 'Clamp to CC (0-127)',
    fn: Transform.clampCC,
    args: ['value'],
  },
  'valueToCC': {
    name: 'Auto (intelligently map value)',
    fn: Transform.valueToCC,
    args: ['value'],
  },
  'identity': {
    name: 'Direct (no transformation)',
    fn: (v) => Math.max(0, Math.min(127, Math.round(v))),
    args: ['value'],
  },
};

export let customTransformations = {};

export function registerCustomTransformation(name, fn, argNames = ['v']) {
  if (typeof fn === 'function') {
    customTransformations[name] = { name, fn, args: argNames };
  }
}

export function getTransformation(key) {
  return builtInTransformations[key] || customTransformations[key] || builtInTransformations['valueToCC'];
}

export function getAllTransformations() {
  return { ...builtInTransformations, ...customTransformations };
}

export function applyTransformation(transformKey, args = {}) {
  const transform = getTransformation(transformKey);
  if (transform && typeof transform.fn === 'function') {
    try {
      const fnArgs = transform.args.map(argName => args[argName] ?? 0);
      return transform.fn(...fnArgs);
    } catch (e) {
      console.error(`Transformation error (${transformKey}):`, e);
      return 0;
    }
  }
  return 0;
}
