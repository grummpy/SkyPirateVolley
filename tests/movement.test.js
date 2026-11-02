import assert from 'node:assert/strict';
import test from 'node:test';
import { SHIP, createMatch, step } from '../src/core/game.js';
import { humans, idle, inputs, skipToRally } from './helpers.js';

test('a ship moves at its speed and stays inside its zone', () => {
  const state = createMatch({ seed: 1, slots: humans(), pointsToWin: 25, gamesToWin: 3 });
  skipToRally(state);
  const ship = state.ships[0];
  const startX = ship.x;
  const startY = ship.y;
  for (let i = 0; i < 30; i += 1) step(state, inputs(0, { y: -1 }));
  const climbed = startY - ship.y;
  assert.ok(Math.abs(climbed - SHIP.speed * 0.5) < 0.02, `climbed ${climbed}`);
  assert.equal(ship.x, startX);
  assert.ok(ship.y >= ship.zone.y0 && ship.y <= ship.zone.y1);

  for (let i = 0; i < 240; i += 1) step(state, inputs(0, { y: -1 }));
  assert.equal(ship.y, ship.zone.y0);

  for (let i = 0; i < 240; i += 1) step(state, inputs(0, { x: 1 }));
  assert.equal(ship.x, ship.zone.x1);
  assert.ok(ship.zone.x1 < 640, 'left ships cannot cross the cloud net');
});

test('the right-hand ships are clamped to their own half', () => {
  const state = createMatch({ seed: 2, slots: humans() });
  skipToRally(state);
  const ship = state.ships[2];
  for (let i = 0; i < 240; i += 1) step(state, inputs(2, { x: -1 }));
  assert.equal(ship.x, ship.zone.x0);
  assert.ok(ship.zone.x0 > 640);
});

test('paused and finished matches do not advance', () => {
  const state = createMatch({ seed: 3, slots: humans() });
  state.paused = true;
  const tick = state.tick;
  step(state, inputs(0, { x: 1 }));
  assert.equal(state.tick, tick);
  state.paused = false;
  state.phase = 'match';
  step(state, inputs(0, { x: 1 }));
  assert.equal(state.tick, tick);
  assert.equal(idle().action, false);
});
