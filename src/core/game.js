import { botAction } from './bots.js';
import {
  BALL,
  DT,
  POWERUP_KINDS,
  ROSTER,
  SHIP,
  WIND_MAX,
  WORLD,
  clamp,
  homeFor,
  otherTeam,
  teamOf,
  zoneFor,
} from './constants.js';
import { makeRng } from './rng.js';

export { BALL, DT, ROSTER, SHIP, WORLD, POWERUP_KINDS };

const SERVE_VX = 300;
const SERVE_VY = -560;

function idleInput() {
  return { x: 0, y: 0, action: false, secondary: false, pause: false };
}

function sanitize(raw) {
  if (!raw) return idleInput();
  return {
    x: clamp(Number(raw.x) || 0, -1, 1),
    y: clamp(Number(raw.y) || 0, -1, 1),
    action: !!raw.action,
    secondary: !!raw.secondary,
    pause: !!raw.pause,
  };
}

export function inReach(ship, ball) {
  const dx = ship.x - ball.x;
  const dy = ship.y - ball.y;
  const reach = SHIP.reach + ball.radius;
  return dx * dx + dy * dy <= reach * reach;
}

function clampShip(ship) {
  ship.x = clamp(ship.x, ship.zone.x0, ship.zone.x1);
  ship.y = clamp(ship.y, ship.zone.y0, ship.zone.y1);
}

function makeShip(index, mode, slot, lives) {
  const roster = ROSTER[index];
  const zone = zoneFor(mode, index);
  const home = homeFor(mode, index, zone);
  const participating = slot !== 'off';
  return {
    id: index,
    name: roster.name,
    short: roster.short,
    color: roster.color,
    trim: roster.trim,
    team: teamOf(index),
    zone,
    home: { ...home },
    x: home.x,
    y: home.y,
    vx: 0,
    vy: 0,
    radius: SHIP.radius,
    facing: index < 2 ? 1 : -1,
    human: slot === 'human',
    participating,
    alive: participating,
    lives: participating ? lives : 0,
    points: 0,
    charge: 0,
    actionHeld: false,
    secondaryHeld: false,
    boostFrames: 0,
    boostCooldown: 0,
    buff: null,
    lastAim: { x: index < 2 ? 1 : -1, y: -0.6 },
  };
}

function nextParticipating(state, from) {
  for (let k = 1; k <= 4; k += 1) {
    const i = (from + k) % 4;
    const ship = state.ships[i];
    if (ship.participating && ship.alive) return i;
  }
  return from;
}

function ensureServer(state) {
  const ship = state.ships[state.serverIndex];
  if (!ship || !ship.participating || !ship.alive) {
    state.serverIndex = nextParticipating(state, state.serverIndex);
  }
}

function spawnPowerup(state) {
  const rng = state.rng;
  if (rng.next() > 0.72) {
    state.powerup = null;
    return;
  }
  const kind = POWERUP_KINDS[Math.floor(rng.next() * POWERUP_KINDS.length)];
  let x = WORLD.netX;
  let y = 300;
  for (let i = 0; i < 6; i += 1) {
    x = 150 + rng.next() * (WORLD.w - 300);
    y = 120 + rng.next() * 460;
    if (Math.abs(x - WORLD.netX) > 100) break;
  }
  state.powerup = { kind, x, y, r: 16 };
}

function beginRally(state) {
  ensureServer(state);
  state.phase = 'countdown';
  state.countdown = 3;
  state.countdownTicks = 60;
  state.rally += 1;
  state.rallyTicks = 0;
  state.touches = { left: 0, right: 0 };
  state.bonusTouches = { left: 0, right: 0 };
  state.possessing = null;
  state.lastHitter = -1;
  state.wind = (state.rng.next() * 2 - 1) * WIND_MAX;
  const server = state.ships[state.serverIndex];
  state.servingTeam = server.team;
  state.ball.active = false;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.x = server.x;
  state.ball.y = Math.min(server.y - 40, WORLD.netTop - 28);
  state.ball.prevX = state.ball.x;
  state.ball.prevY = state.ball.y;
  spawnPowerup(state);
  for (const ship of state.ships) {
    ship.charge = 0;
    ship.buff = null;
    ship.boostFrames = 0;
  }
  state.events.push('countdown');
}

function launchServe(state) {
  ensureServer(state);
  const server = state.ships[state.serverIndex];
  const dir = server.x < WORLD.netX ? 1 : -1;
  const spread = (state.rng.next() * 2 - 1) * 36;
  state.ball.x = server.x + dir * 18;
  state.ball.y = Math.min(server.y - 46, WORLD.netTop - 36);
  state.ball.vx = dir * SERVE_VX + spread;
  state.ball.vy = SERVE_VY;
  state.ball.active = true;
  state.ball.prevX = state.ball.x;
  state.ball.prevY = state.ball.y;
  state.servingTeam = server.team;
  state.phase = 'rally';
  state.countdown = 0;
}

export function createMatch(options = {}) {
  const mode = options.mode === 'ffa' ? 'ffa' : '2v2';
  const slots = options.slots || ['bot', 'bot', 'bot', 'bot'];
  const lives = options.lives ?? 7;
  const seed = options.seed ?? 1;
  const ships = [0, 1, 2, 3].map((i) => makeShip(i, mode, slots[i] || 'bot', lives));
  const state = {
    mode,
    seed,
    rng: makeRng(seed),
    phase: 'countdown',
    ships,
    ball: {
      x: WORLD.netX,
      y: 180,
      vx: 0,
      vy: 0,
      prevX: WORLD.netX,
      prevY: 180,
      active: false,
      radius: BALL.radius,
    },
    score: { left: 0, right: 0 },
    games: { left: 0, right: 0 },
    gameNumber: 1,
    pointsToWin: options.pointsToWin ?? 11,
    gamesToWin: options.gamesToWin ?? 2,
    maxLives: lives,
    serverIndex: ships.findIndex((s) => s.participating && s.alive),
    wind: 0,
    touches: { left: 0, right: 0 },
    bonusTouches: { left: 0, right: 0 },
    possessing: null,
    lastHitter: -1,
    powerup: null,
    banner: null,
    countdown: 3,
    countdownTicks: 60,
    pointTimer: 0,
    matchWinner: null,
    elimOrder: [],
    events: [],
    tick: 0,
    rally: 0,
    rallyTicks: 0,
    paused: false,
    servingTeam: 'left',
  };
  if (state.serverIndex < 0) state.serverIndex = 0;
  beginRally(state);
  return state;
}

function creditTeam(state, team) {
  let id = state.lastHitter;
  if (id < 0 || state.ships[id].team !== team || !state.ships[id].participating) {
    id = state.ships.findIndex((s) => s.team === team && s.participating);
  }
  if (id >= 0) state.ships[id].points += 1;
}

export function gameIsWon(scoreA, scoreB, target) {
  const hi = Math.max(scoreA, scoreB);
  return hi >= target && Math.abs(scoreA - scoreB) >= 2;
}

function scoreTeam(state, team, reason) {
  if (state.phase === 'match') return;
  state.score[team] += 1;
  creditTeam(state, team);
  state.ball.active = false;
  state.events.push('score');
  const mine = state.score[team];
  const theirs = state.score[otherTeam(team)];
  const wonGame = gameIsWon(mine, theirs, state.pointsToWin) && mine > theirs;
  if (wonGame) {
    state.games[team] += 1;
    state.events.push('game');
    const wonMatch = state.games[team] >= state.gamesToWin;
    state.phase = wonMatch ? 'match' : 'game';
    state.matchWinner = wonMatch ? team : null;
    if (wonMatch) state.events.push('match');
    state.pointTimer = wonMatch ? 1e9 : 150;
    const sideName = team === 'left' ? 'PORT' : 'STARBOARD';
    state.banner = {
      title: wonMatch ? `${sideName} WINS THE MATCH` : `${sideName} WINS THE GAME`,
      reason,
      timer: state.pointTimer,
    };
  } else {
    state.phase = 'point';
    state.pointTimer = 80;
    state.banner = {
      title: team === 'left' ? 'PORT SCORES' : 'STARBOARD SCORES',
      reason,
      timer: 80,
    };
  }
  state.serverIndex = nextParticipating(state, state.serverIndex);
}

function loseLife(state, index, reason) {
  const ship = state.ships[index];
  if (!ship || !ship.participating || !ship.alive || state.phase === 'match') return;
  ship.lives -= 1;
  state.ball.active = false;
  state.events.push('score');
  if (state.lastHitter >= 0 && state.lastHitter !== index && state.ships[state.lastHitter].alive) {
    state.ships[state.lastHitter].points += 1;
  }
  if (ship.lives <= 0) {
    ship.alive = false;
    ship.lives = 0;
    state.elimOrder.push(index);
    state.events.push('ko');
    state.banner = { title: `${ship.name} IS DOWN`, reason, timer: 100 };
  } else {
    state.banner = { title: `${ship.name} LOSES A LIFE`, reason, timer: 80 };
  }
  const alive = state.ships.filter((s) => s.participating && s.alive);
  if (alive.length <= 1) {
    state.phase = 'match';
    state.matchWinner = alive[0] ? alive[0].id : null;
    state.events.push('match');
    state.pointTimer = 1e9;
    state.banner = {
      title: alive[0] ? `${alive[0].name} WINS` : 'NO SHIP LEFT',
      reason: 'last ship flying',
      timer: 1e9,
    };
  } else {
    state.phase = 'point';
    state.pointTimer = ship.lives <= 0 ? 100 : 80;
  }
  state.serverIndex = nextParticipating(state, state.serverIndex);
}

function aimVector(x, y, facing) {
  if (Math.hypot(x, y) < 0.2) return { x: facing || 1, y: 0 };
  const n = Math.hypot(x, y);
  return { x: x / n, y: y / n };
}

function volleyDirection(ship, input) {
  let x = input.x;
  let y = input.y;
  if (Math.hypot(x, y) < 0.2) {
    const dir = ship.x < WORLD.netX ? 1 : -1;
    x = dir * 0.5;
    y = -0.86;
  }
  const n = Math.hypot(x, y);
  return { x: x / n, y: y / n };
}

function shotSpeed(charge, buff) {
  const t = clamp(charge, 0, 1);
  let speed = BALL.volleyMin + (BALL.volleyMax - BALL.volleyMin) * t;
  if (buff === 'tailwind') speed *= 1.45;
  if (buff === 'keg') speed *= 1.2;
  return speed;
}

export function planVolley(charge, aimX, aimY, buff, facing = 1) {
  const dir = Math.hypot(aimX, aimY) < 0.2
    ? volleyDirection({ x: facing > 0 ? 0 : WORLD.w, facing }, { x: 0, y: 0 })
    : volleyDirection({ x: WORLD.netX, facing }, { x: aimX, y: aimY });
  const speed = shotSpeed(charge, buff);
  return { vx: dir.x * speed, vy: dir.y * speed, speed };
}

function placeBallOutside(ball, ship) {
  const n = Math.hypot(ball.vx, ball.vy) || 1;
  const nx = ball.vx / n;
  const ny = ball.vy / n;
  ball.x = ship.x + nx * (ship.radius + ball.radius + 4);
  ball.y = ship.y + ny * (ship.radius + ball.radius + 4);
}

function applyHit(state, ship, pick) {
  const team = ship.team;
  if (state.mode === '2v2') {
    let next = state.touches[team];
    if (state.possessing !== team) next = 0;
    next += 1;
    const max = 3 + (state.bonusTouches[team] || 0);
    if (next > max) {
      scoreTeam(state, otherTeam(team), 'too many touches');
      return;
    }
    state.touches[team] = next;
    state.touches[otherTeam(team)] = 0;
    state.possessing = team;
  } else {
    state.possessing = team;
  }
  state.lastHitter = ship.id;

  if (pick.kind === 'spike') {
    const dirX = ship.x < WORLD.netX ? 0.78 : -0.78;
    const dirY = 0.55;
    const n = Math.hypot(dirX, dirY);
    let speed = BALL.spikeSpeed;
    if (ship.buff === 'tailwind') speed *= 1.35;
    state.ball.vx = (dirX / n) * speed;
    state.ball.vy = (dirY / n) * speed;
    state.events.push('spike');
  } else {
    const dir = volleyDirection(ship, pick.input);
    const speed = shotSpeed(pick.charge, ship.buff);
    state.ball.vx = dir.x * speed;
    state.ball.vy = dir.y * speed;
    state.events.push(pick.charge >= 0.66 ? 'powerhit' : 'hit');
  }
  if (ship.buff === 'tailwind' || ship.buff === 'keg') ship.buff = null;
  placeBallOutside(state.ball, ship);
  state.ball.active = true;
}

function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function resolveNet(state) {
  const ball = state.ball;
  if (ball.y < WORLD.netTop) return;
  const hit = circleRectHit(
    ball.x,
    ball.y,
    ball.radius,
    WORLD.netX - WORLD.netHalfW,
    WORLD.netTop,
    WORLD.netHalfW * 2,
    WORLD.netBot - WORLD.netTop,
  );
  if (!hit) return;
  if (state.mode === 'ffa') {
    const id = state.lastHitter >= 0 ? state.lastHitter : state.serverIndex;
    loseLife(state, id, 'hit the cloud net');
    return;
  }
  const faultTeam = state.lastHitter >= 0 ? state.ships[state.lastHitter].team : state.servingTeam;
  scoreTeam(state, otherTeam(faultTeam), 'cloud net');
}

function resolveLanding(state) {
  const ball = state.ball;
  if (state.mode === 'ffa') {
    if (ball.prevY < WORLD.midY && ball.y >= WORLD.midY) {
      const owner = ball.x < WORLD.netX ? 0 : 2;
      if (!state.ships[owner].alive) {
        const fault = state.lastHitter >= 0 ? state.lastHitter : state.serverIndex;
        loseLife(state, fault, 'sailed into an empty sky');
      } else {
        loseLife(state, owner, 'through your clouds');
      }
      return;
    }
    if (ball.y >= WORLD.floor) {
      const owner = ball.x < WORLD.netX ? 1 : 3;
      if (!state.ships[owner].alive) {
        const fault = state.lastHitter >= 0 ? state.lastHitter : state.serverIndex;
        loseLife(state, fault, 'sailed into an empty sky');
      } else {
        loseLife(state, owner, 'through your clouds');
      }
    }
    return;
  }
  if (ball.y >= WORLD.floor) {
    const side = ball.x < WORLD.netX ? 'left' : 'right';
    scoreTeam(state, otherTeam(side), 'through the clouds');
  }
}

function integrateBall(state) {
  const ball = state.ball;
  if (!ball.active) return;
  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.vy += BALL.gravity * DT;
  ball.vx += state.wind * DT;
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > BALL.maxSpeed) {
    ball.vx = (ball.vx / sp) * BALL.maxSpeed;
    ball.vy = (ball.vy / sp) * BALL.maxSpeed;
  }
  ball.x += ball.vx * DT;
  ball.y += ball.vy * DT;
  const r = ball.radius;
  if (ball.x < WORLD.left + r) {
    ball.x = WORLD.left + r;
    ball.vx = Math.abs(ball.vx) * BALL.wallRestitution;
  } else if (ball.x > WORLD.right - r) {
    ball.x = WORLD.right - r;
    ball.vx = -Math.abs(ball.vx) * BALL.wallRestitution;
  }
  if (ball.y < WORLD.ceiling + r) {
    ball.y = WORLD.ceiling + r;
    ball.vy = Math.abs(ball.vy) * BALL.wallRestitution;
  }
}

function separateHulls(state) {
  const ball = state.ball;
  if (!ball.active || state.phase !== 'rally') return;
  for (const ship of state.ships) {
    if (!ship.participating || !ship.alive) continue;
    const dx = ball.x - ship.x;
    const dy = ball.y - ship.y;
    const min = ship.radius + ball.radius;
    let d = Math.hypot(dx, dy);
    if (d === 0) d = 0.0001;
    if (d >= min) continue;
    const nx = dx / d;
    const ny = dy / d;
    ball.x = ship.x + nx * (min + 0.5);
    ball.y = ship.y + ny * (min + 0.5);
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + BALL.hullRestitution) * vn * nx;
      ball.vy -= (1 + BALL.hullRestitution) * vn * ny;
    }
  }
}

function separateShips(state) {
  const ships = state.ships.filter((s) => s.participating && s.alive);
  for (let i = 0; i < ships.length; i += 1) {
    for (let j = i + 1; j < ships.length; j += 1) {
      const a = ships[i];
      const b = ships[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      const min = a.radius + b.radius + 6;
      if (d === 0) {
        dx = 1;
        dy = 0;
        d = 1;
      }
      if (d >= min) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      clampShip(a);
      clampShip(b);
    }
  }
}

function collectPowerups(state) {
  const item = state.powerup;
  if (!item) return;
  for (const ship of state.ships) {
    if (!ship.participating || !ship.alive) continue;
    const d = Math.hypot(ship.x - item.x, ship.y - item.y);
    if (d > ship.radius + item.r) continue;
    if (item.kind === 'tailwind' || item.kind === 'keg') {
      ship.buff = item.kind;
    } else if (item.kind === 'lifeboat') {
      if (state.mode === 'ffa') ship.lives = Math.min(state.maxLives, ship.lives + 1);
      else state.touches[ship.team] = 0;
    } else if (item.kind === 'extraTouch') {
      state.bonusTouches[ship.team] = (state.bonusTouches[ship.team] || 0) + 1;
      ship.boostCooldown = 0;
    }
    state.powerup = null;
    state.events.push('pickup');
    return;
  }
}

function resolveInputs(state, actions) {
  return state.ships.map((ship, i) => {
    if (!ship.participating || !ship.alive) return idleInput();
    if (!ship.human) return botAction(state, i);
    return sanitize(actions?.[i]);
  });
}

function prepareShip(state, ship, input) {
  const intent = { input, released: false, charge: 0, spike: false };
  if (!ship.participating || !ship.alive) return intent;

  if (ship.boostCooldown > 0) ship.boostCooldown -= 1;

  if (input.action) ship.charge = Math.min(1, ship.charge + DT / SHIP.chargeTime);
  const released = ship.actionHeld && !input.action;
  const secondaryEdge = !ship.secondaryHeld && input.secondary;
  const canSwing = state.phase === 'rally' && state.ball.active;
  const spike = !!(secondaryEdge && canSwing && ship.y < WORLD.netTop && inReach(ship, state.ball));
  const boost = secondaryEdge && !spike && ship.boostCooldown <= 0;

  if (boost) {
    const dir = aimVector(input.x, input.y, ship.facing);
    ship.vx = dir.x * SHIP.boostSpeed;
    ship.vy = dir.y * SHIP.boostSpeed;
    ship.boostFrames = SHIP.boostFrames;
    ship.boostCooldown = SHIP.boostCooldown;
    state.events.push('boost');
    ship.lastAim = { x: dir.x, y: dir.y };
  }

  if (ship.boostFrames > 0) {
    ship.boostFrames -= 1;
    ship.x += ship.vx * DT;
    ship.y += ship.vy * DT;
    if (input.x) ship.facing = Math.sign(input.x);
  } else {
    const mag = Math.hypot(input.x, input.y);
    if (mag > 0.001) {
      ship.vx = (input.x / mag) * SHIP.speed;
      ship.vy = (input.y / mag) * SHIP.speed;
      if (input.x) ship.facing = Math.sign(input.x);
      ship.lastAim = { x: input.x / mag, y: input.y / mag };
    } else {
      ship.vx = 0;
      ship.vy = 0;
    }
    ship.x += ship.vx * DT;
    ship.y += ship.vy * DT;
  }
  clampShip(ship);

  intent.released = released;
  intent.charge = ship.charge;
  intent.spike = spike;
  intent.input = input;
  if (!input.action) ship.charge = 0;
  ship.actionHeld = !!input.action;
  ship.secondaryHeld = !!input.secondary;
  return intent;
}

function resolveSwings(state, intents) {
  const options = [];
  for (let i = 0; i < 4; i += 1) {
    const ship = state.ships[i];
    const intent = intents[i];
    if (!ship.participating || !ship.alive) continue;
    if (!state.ball.active || state.phase !== 'rally') continue;
    if (intent.spike && inReach(ship, state.ball)) {
      options.push({ i, kind: 'spike', dist: Math.hypot(ship.x - state.ball.x, ship.y - state.ball.y), charge: intent.charge, input: intent.input });
    } else if (intent.released && inReach(ship, state.ball)) {
      options.push({ i, kind: 'volley', dist: Math.hypot(ship.x - state.ball.x, ship.y - state.ball.y), charge: intent.charge, input: intent.input });
    }
  }
  options.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'spike' ? -1 : 1;
    return a.dist - b.dist;
  });
  if (!options.length) return;
  applyHit(state, state.ships[options[0].i], options[0]);
}

function tickCountdown(state) {
  state.countdownTicks -= 1;
  if (state.countdownTicks > 0) return;
  if (state.countdown > 1) {
    state.countdown -= 1;
    state.countdownTicks = 60;
    state.events.push('countdown');
    return;
  }
  launchServe(state);
  state.events.push('serve');
}

export function standings(state) {
  if (state.mode === '2v2') {
    const winner = state.matchWinner;
    return {
      mode: '2v2',
      winner,
      rows: [
        { label: 'Port team', detail: `${state.games.left} games · rally ${state.score.left}`, winner: winner === 'left' },
        ...state.ships.filter((s) => s.team === 'left').map((s) => ({
          label: s.name,
          detail: s.participating ? `${s.points} points credited` : 'sitting out',
          winner: false,
        })),
        { label: 'Starboard team', detail: `${state.games.right} games · rally ${state.score.right}`, winner: winner === 'right' },
        ...state.ships.filter((s) => s.team === 'right').map((s) => ({
          label: s.name,
          detail: s.participating ? `${s.points} points credited` : 'sitting out',
          winner: false,
        })),
      ],
    };
  }
  const alive = state.ships.filter((s) => s.participating && s.alive);
  const ordered = [...alive];
  for (let i = state.elimOrder.length - 1; i >= 0; i -= 1) ordered.push(state.ships[state.elimOrder[i]]);
  return {
    mode: 'ffa',
    winner: state.matchWinner,
    rows: ordered.map((s, rank) => ({
      label: `${rank + 1}. ${s.name}`,
      detail: s.alive ? `${s.lives} lives · ${s.points} KOs` : `down · ${s.points} KOs`,
      winner: s.id === state.matchWinner,
    })),
  };
}

/**
 * Advance the simulation by one 60 Hz tick.
 * Human slots use `actions`; bot slots ignore them and fly themselves.
 */
export function step(state, actions) {
  state.events = [];
  if (state.paused || state.phase === 'match') return state;
  state.tick += 1;

  const inputs = resolveInputs(state, actions);
  const intents = inputs.map((input, i) => prepareShip(state, state.ships[i], input));

  if (state.phase === 'countdown') {
    tickCountdown(state);
  } else if (state.phase === 'point' || state.phase === 'game') {
    state.pointTimer -= 1;
    if (state.banner) state.banner.timer -= 1;
    if (state.pointTimer <= 0) {
      if (state.phase === 'game') {
        state.score.left = 0;
        state.score.right = 0;
        state.gameNumber += 1;
      }
      beginRally(state);
    }
  } else if (state.phase === 'rally') {
    state.rallyTicks += 1;
    resolveSwings(state, intents);
    if (state.phase === 'rally') {
      integrateBall(state);
      separateHulls(state);
      if (state.phase === 'rally') resolveNet(state);
      if (state.phase === 'rally') resolveLanding(state);
      if (state.phase === 'rally') collectPowerups(state);
    }
  }

  if (state.phase !== 'match') separateShips(state);
  return state;
}
