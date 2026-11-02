/** Fixed-timestep and court constants. Y grows downward. */

export const DT = 1 / 60;

export const WORLD = {
  w: 1280,
  h: 720,
  floor: 652,
  ceiling: 64,
  left: 40,
  right: 1240,
  netX: 640,
  netHalfW: 36,
  netTop: 236,
  netBot: 548,
  midY: 392,
};

export const SHIP = {
  radius: 22,
  speed: 330,
  reach: 78,
  chargeTime: 0.4,
  boostSpeed: 640,
  boostFrames: 8,
  boostCooldown: 36,
};

export const BALL = {
  radius: 12,
  gravity: 820,
  maxSpeed: 1250,
  wallRestitution: 1,
  hullRestitution: 0.4,
  volleyMin: 560,
  volleyMax: 780,
  spikeSpeed: 960,
};

export const WIND_MAX = 130;

export const POWERUP_KINDS = ['tailwind', 'keg', 'lifeboat', 'extraTouch'];

export const ROSTER = [
  { name: 'Crimson Gull', short: 'Gull', color: '#d62828', trim: '#ffd6d6' },
  { name: 'Cobalt Lark', short: 'Lark', color: '#1d4e89', trim: '#d6e6ff' },
  { name: 'Verdant Squall', short: 'Squall', color: '#2a9d4a', trim: '#d9ffe4' },
  { name: 'Golden Kite', short: 'Kite', color: '#e9b423', trim: '#fff4cc' },
];

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function zoneFor(mode, index) {
  const { midY } = WORLD;
  if (mode === 'ffa') {
    const quads = [
      { x0: 70, x1: 588, y0: 88, y1: midY - 18 },
      { x0: 70, x1: 588, y0: midY + 18, y1: 628 },
      { x0: 692, x1: 1210, y0: 88, y1: midY - 18 },
      { x0: 692, x1: 1210, y0: midY + 18, y1: 628 },
    ];
    return quads[index];
  }
  if (index < 2) return { x0: 70, x1: 588, y0: 88, y1: 628 };
  return { x0: 692, x1: 1210, y0: 88, y1: 628 };
}

export function homeFor(mode, index, zone) {
  const cx = (zone.x0 + zone.x1) / 2;
  const cy = (zone.y0 + zone.y1) / 2;
  if (mode === 'ffa') return { x: cx, y: cy };
  if (index === 0) return { x: zone.x1 - 78, y: cy - 80 };
  if (index === 1) return { x: zone.x0 + 110, y: cy + 90 };
  if (index === 2) return { x: zone.x0 + 78, y: cy - 80 };
  return { x: zone.x1 - 110, y: cy + 90 };
}

export function teamOf(index) {
  return index < 2 ? 'left' : 'right';
}

export function otherTeam(team) {
  return team === 'left' ? 'right' : 'left';
}
