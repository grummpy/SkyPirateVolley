import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD, createMatch, inReach, step } from '../src/core/game.js';
import { humans, inputs, skipToRally } from './helpers.js';

function live(seed = 4) {
  const state = createMatch({ seed, slots: humans(), pointsToWin: 25, gamesToWin: 3 });
  skipToRally(state);
  for (const ship of state.ships) ship.human = true;
  state.phase = 'rally';
  state.ball.active = true;
  return state;
}

test('the cannonball bounces off the side wall', () => {
  const state = live();
  state.ball.x = WORLD.left + state.ball.radius + 1;
  state.ball.y = 300;
  state.ball.vx = -700;
  state.ball.vy = 0;
  for (let i = 0; i < 8; i += 1) step(state, inputs(0, {}));
  assert.ok(state.ball.vx > 0, `vx ${state.ball.vx}`);
  assert.ok(state.ball.x >= WORLD.left);
  assert.equal(state.score.left + state.score.right, 0);
});

test('hitting the cloud net is a fault for the last hitter', () => {
  const state = live();
  state.ball.x = WORLD.netX;
  state.ball.y = (WORLD.netTop + WORLD.netBot) / 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.lastHitter = 0;
  step(state, inputs(0, {}));
  assert.equal(state.score.right, 1);
  assert.equal(state.score.left, 0);
  assert.equal(state.phase, 'point');
  assert.match(state.banner.reason, /net/);
});

test('a serve into the net faults the serving side', () => {
  const state = live();
  state.ball.x = WORLD.netX;
  state.ball.y = (WORLD.netTop + WORLD.netBot) / 2;
  state.ball.vx = 40;
  state.ball.vy = 0;
  state.lastHitter = -1;
  state.servingTeam = 'right';
  step(state, inputs(0, {}));
  assert.equal(state.score.left, 1);
});

test('overlapping the hull pushes the ball out without counting a touch', () => {
  const state = live();
  const ship = state.ships[0];
  state.ball.x = ship.x;
  state.ball.y = ship.y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.touches.left = 0;
  step(state, inputs(0, {}));
  const dist = Math.hypot(state.ball.x - ship.x, state.ball.y - ship.y);
  assert.ok(dist >= ship.radius + state.ball.radius - 0.1);
  assert.equal(state.touches.left, 0);
  assert.equal(state.score.right, 0);
});

test('a cannon only connects inside its reach', () => {
  const state = live();
  const ship = state.ships[0];
  state.ball.x = ship.x + 260;
  state.ball.y = ship.y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  assert.equal(inReach(ship, state.ball), false);
  ship.actionHeld = true;
  ship.charge = 1;
  step(state, inputs(0, { action: false, x: 1, y: -0.4 }));
  assert.equal(state.lastHitter, -1);
  assert.equal(state.phase, 'rally');
  assert.ok(Math.hypot(state.ball.vx, state.ball.vy) < 80);
});
