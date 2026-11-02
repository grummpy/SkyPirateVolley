import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../src/core/game.js';
import { inputs, skipToRally } from './helpers.js';

test('a bot fires when the cannonball hangs in its zone', () => {
  const state = createMatch({
    seed: 2,
    slots: ['bot', 'off', 'off', 'off'],
    pointsToWin: 25,
    gamesToWin: 3,
  });
  skipToRally(state);
  const ship = state.ships[0];
  state.phase = 'rally';
  state.ball.active = true;
  state.ball.x = ship.x;
  state.ball.y = ship.y - 48;
  state.ball.vx = 0;
  state.ball.vy = 30;
  let struck = false;
  for (let i = 0; i < 180; i += 1) {
    step(state);
    if (state.lastHitter === 0 || state.events.includes('hit') || state.events.includes('powerhit') || state.events.includes('spike')) {
      struck = true;
      break;
    }
  }
  assert.equal(struck, true);
  assert.equal(state.ships[1].participating, false);
});

test('four bots play a rally to a point', () => {
  const state = createMatch({
    seed: 5,
    slots: ['bot', 'bot', 'bot', 'bot'],
    pointsToWin: 11,
    gamesToWin: 2,
  });
  let guard = 0;
  while (state.score.left + state.score.right === 0 && state.phase !== 'match' && guard < 60 * 40) {
    step(state);
    guard += 1;
  }
  assert.ok(state.score.left + state.score.right >= 1, `no point after ${guard} ticks`);
  assert.ok(state.ships.every((ship) => ship.human === false));
});

test('bots do not steal a human ship', () => {
  const state = createMatch({ seed: 1, slots: ['human', 'bot', 'bot', 'bot'] });
  skipToRally(state);
  const start = state.ships[0].x;
  for (let i = 0; i < 20; i += 1) step(state, inputs(0, {}));
  assert.equal(state.ships[0].x, start);
  assert.equal(state.ships[1].human, false);
});
