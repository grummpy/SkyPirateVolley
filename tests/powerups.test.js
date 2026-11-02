import assert from 'node:assert/strict';
import test from 'node:test';
import { SHIP, createMatch, planVolley, step } from '../src/core/game.js';
import { humans, inputs, skipToRally } from './helpers.js';

function rally() {
  const state = createMatch({
    seed: 21,
    slots: humans(),
    pointsToWin: 25,
    gamesToWin: 3,
  });
  skipToRally(state);
  state.phase = 'rally';
  state.ball.active = true;
  state.ball.vx = 0;
  state.ball.vy = 0;
  return state;
}

test('charge, tailwind, and storm keg scale cannon speed', () => {
  const tap = planVolley(0, 1, -0.25, null);
  const full = planVolley(1, 1, -0.25, null);
  const wind = planVolley(1, 1, -0.25, 'tailwind');
  const keg = planVolley(1, 1, -0.25, 'keg');
  assert.ok(full.speed > tap.speed + 150);
  assert.ok(wind.speed > full.speed * 1.4);
  assert.ok(keg.speed > full.speed * 1.15);
});

test('releasing a charged cannon bats the ball harder than a tap', () => {
  function fire(charge) {
    const state = rally();
    const ship = state.ships[0];
    state.ball.x = ship.x + 36;
    state.ball.y = ship.y - 8;
    ship.actionHeld = true;
    ship.charge = charge;
    step(state, inputs(0, { action: false, x: 1, y: -0.35 }));
    return Math.hypot(state.ball.vx, state.ball.vy);
  }
  assert.ok(fire(1) > fire(0) + 80);
});

test('tailwind is collected and spent on the next shot', () => {
  const state = rally();
  const ship = state.ships[0];
  state.powerup = { kind: 'tailwind', x: ship.x, y: ship.y, r: 16 };
  state.ball.x = 400;
  state.ball.y = 160;
  step(state, inputs(0, {}));
  assert.equal(ship.buff, 'tailwind');
  assert.equal(state.powerup, null);
  assert.ok(state.events.includes('pickup'));

  state.ball.x = ship.x + 30;
  state.ball.y = ship.y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  ship.actionHeld = true;
  ship.charge = 1;
  step(state, inputs(0, { action: false, x: 1, y: -0.2 }));
  assert.equal(ship.buff, null);
  assert.ok(state.events.includes('powerhit') || state.events.includes('hit'));
});

test('an extra-touch pickup lets a side survive a fourth cannon', () => {
  const state = rally();
  const ship = state.ships[0];
  state.bonusTouches.left = 1;
  state.possessing = 'left';
  state.touches.left = 3;
  state.ball.x = ship.x + 26;
  state.ball.y = ship.y;
  ship.actionHeld = true;
  ship.charge = 0.2;
  step(state, inputs(0, { action: false, x: 0.2, y: -1 }));
  assert.equal(state.score.right, 0);
  assert.equal(state.touches.left, 4);
  assert.equal(state.phase, 'rally');
});

test('a lifeboat restores a life in the free-for-all', () => {
  const state = createMatch({ mode: 'ffa', seed: 2, slots: humans(), lives: 7 });
  skipToRally(state);
  state.phase = 'rally';
  state.ball.active = true;
  state.ball.x = 400;
  state.ball.y = 140;
  state.ball.vx = 0;
  state.ball.vy = 0;
  const ship = state.ships[0];
  ship.lives = 3;
  state.powerup = { kind: 'lifeboat', x: ship.x, y: ship.y, r: 16 };
  step(state, inputs(0, {}));
  assert.equal(ship.lives, 4);
  assert.ok(ship.lives <= state.maxLives);
});

test('spike sends the ball downward from above the net, boost dashes below it', () => {
  const spike = rally();
  const striker = spike.ships[0];
  striker.y = 150;
  spike.ball.x = striker.x + 16;
  spike.ball.y = striker.y;
  step(spike, inputs(0, { secondary: true }));
  assert.ok(spike.events.includes('spike'));
  assert.ok(spike.ball.vy > 400, `vy ${spike.ball.vy}`);
  assert.ok(!spike.events.includes('boost'));

  const dash = rally();
  const ship = dash.ships[0];
  const start = ship.x;
  ship.y = 460;
  for (let i = 0; i < 8; i += 1) {
    step(dash, inputs(0, { x: -1, secondary: true }));
  }
  assert.ok(start - ship.x > 70, `dashed ${start - ship.x}`);
  assert.ok(start - ship.x < SHIP.boostSpeed * 8 * (1 / 60) + 2);
  assert.ok(ship.boostCooldown > 0);
});

test('powerups and wind are deterministic for a seed', () => {
  const a = createMatch({ seed: 77, slots: humans() });
  const b = createMatch({ seed: 77, slots: humans() });
  assert.equal(a.wind, b.wind);
  assert.deepEqual(a.powerup, b.powerup);
  assert.notEqual(a.wind, createMatch({ seed: 78, slots: humans() }).wind);
});
