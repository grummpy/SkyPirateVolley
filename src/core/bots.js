import { BALL, SHIP, WORLD } from './constants.js';

function steer(ship, target) {
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  const slop = 8;
  return {
    x: Math.abs(dx) < slop ? 0 : Math.sign(dx),
    y: Math.abs(dy) < slop ? 0 : Math.sign(dy),
    action: false,
    secondary: false,
    pause: false,
  };
}

function normalize(x, y) {
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}

function pointInZone(x, y, zone, pad = 0) {
  return x >= zone.x0 - pad && x <= zone.x1 + pad && y >= zone.y0 - pad && y <= zone.y1 + pad;
}

function chooseAim(state, ship) {
  const dir = ship.x < WORLD.netX ? 1 : -1;
  if (state.mode === '2v2') {
    const wobble = ((state.tick % 11) - 5) / 40;
    return normalize(dir * (0.9 + wobble), -0.38);
  }
  if (state.mode === 'ffa') {
    let best = null;
    let bestD = -1;
    for (const other of state.ships) {
      if (!other.participating || !other.alive || other.id === ship.id) continue;
      const d = Math.hypot(other.home.x - ship.x, other.home.y - ship.y);
      if (d > bestD) {
        bestD = d;
        best = other.home;
      }
    }
    const tx = best ? best.x : WORLD.netX + dir * 180;
    const ty = best ? best.y : ship.y;
    return normalize(tx - ship.x, ty - ship.y - 120);
  }
  return normalize(dir, -0.45);
}

function isReceiver(state, index) {
  const ship = state.ships[index];
  const ball = state.ball;
  if (state.mode === 'ffa') {
    const leadX = ball.x + ball.vx * 0.2;
    const leadY = ball.y + ball.vy * 0.2;
    return pointInZone(ball.x, ball.y, ship.zone, 36) || pointInZone(leadX, leadY, ship.zone, 8);
  }
  const onSide = ship.team === 'left' ? ball.x < WORLD.netX + 48 : ball.x > WORLD.netX - 48;
  if (!onSide) return false;
  const mate = state.ships[index ^ 1];
  if (!mate || !mate.participating || !mate.alive) return true;
  const myD = Math.hypot(ship.x - ball.x, ship.y - ball.y);
  const mateD = Math.hypot(mate.x - ball.x, mate.y - ball.y);
  return myD <= mateD;
}

/** Decide one frame of input for a bot-controlled ship. */
export function botAction(state, index) {
  const ship = state.ships[index];
  const none = { x: 0, y: 0, action: false, secondary: false, pause: false };
  if (!ship || !ship.participating || !ship.alive) return none;

  const ball = state.ball;
  if (!ball.active || state.phase !== 'rally') return steer(ship, ship.home);

  const receiver = isReceiver(state, index);
  const lead = {
    x: ball.x + ball.vx * 0.16,
    y: ball.y + 36,
  };
  // Stay under the cloud net and meet the ball as it falls.
  const roof = WORLD.netTop + 70;
  if (lead.y < roof) lead.y = roof;
  const target = receiver
    ? {
        x: Math.max(ship.zone.x0, Math.min(ship.zone.x1, lead.x)),
        y: Math.max(ship.zone.y0, Math.min(ship.zone.y1, lead.y)),
      }
    : ship.home;
  const action = steer(ship, target);
  const d = Math.hypot(ball.x - ship.x, ball.y - ship.y);
  const reach = SHIP.reach + BALL.radius - 4;
  const inRange = d <= reach;
  const falling = ball.vy > 20;

  const roomToSpike = Math.abs(ship.x - WORLD.netX) > 170 && ship.y < WORLD.netTop - 36;
  if (receiver && roomToSpike && inRange && ball.y <= ship.y + 8 && ball.y < WORLD.netTop) {
    action.secondary = true;
    action.action = false;
    return action;
  }

  if (receiver && inRange && falling) {
    if (!ship.actionHeld || (ship.charge < 0.22 && d > 34)) {
      action.action = true;
    } else {
      const aim = chooseAim(state, ship);
      action.x = aim.x;
      action.y = aim.y;
      action.action = false;
    }
    return action;
  }

  if (receiver && falling && d < reach + 90) {
    action.action = true;
    return action;
  }

  const gap = Math.hypot(target.x - ship.x, target.y - ship.y);
  if (receiver && !inRange && gap > 170 && ship.boostCooldown <= 0 && falling) {
    action.secondary = true;
  }
  return action;
}
