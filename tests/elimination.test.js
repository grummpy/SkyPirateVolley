import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD, createMatch, standings, step } from '../src/core/game.js';
import { humans, inputs, skipToRally } from './helpers.js';

function ffa(lives = 7) {
  const state = createMatch({
    mode: 'ffa',
    seed: 4,
    slots: humans(),
    lives,
    pointsToWin: 11,
    gamesToWin: 2,
  });
  skipToRally(state);
  return state;
}

function dropOn(state, owner) {
  if (state.phase !== 'rally') skipToRally(state);
  state.phase = 'rally';
  state.ball.active = true;
  state.ball.vx = 0;
  state.ball.vy = 900;
  if (owner === 0 || owner === 2) {
    state.ball.x = owner === 0 ? 220 : 980;
    state.ball.y = WORLD.midY - 12;
  } else {
    state.ball.x = owner === 1 ? 220 : 980;
    state.ball.y = WORLD.floor + 6;
  }
  step(state, inputs(0, {}));
}

test('a ball landing in a quadrant costs that ship a life', () => {
  const state = ffa(7);
  assert.equal(state.ships[1].lives, 7);
  dropOn(state, 1);
  assert.equal(state.ships[1].lives, 6);
  assert.equal(state.ships[1].alive, true);
  assert.equal(state.phase, 'point');
  assert.match(state.banner.title, /Lark/);
});

test('the top quadrants lose a life when the ball falls through the midline', () => {
  const state = ffa(7);
  dropOn(state, 2);
  assert.equal(state.ships[2].lives, 6);
  assert.equal(state.ships[0].lives, 7);
  assert.equal(state.ships[3].lives, 7);
});

test('running out of lives eliminates a ship, and the last one flying wins', () => {
  const state = ffa(1);
  dropOn(state, 0);
  dropOn(state, 1);
  dropOn(state, 2);
  assert.equal(state.ships[0].alive, false);
  assert.equal(state.ships[1].alive, false);
  assert.equal(state.ships[2].alive, false);
  assert.equal(state.ships[3].alive, true);
  assert.equal(state.phase, 'match');
  assert.equal(state.matchWinner, 3);
  assert.ok(state.events.includes('ko') || state.elimOrder.length === 3);
  const board = standings(state);
  assert.equal(board.mode, 'ffa');
  assert.equal(board.rows[0].winner, true);
  assert.match(board.rows[0].label, /Kite/);
  assert.deepEqual(state.elimOrder, [0, 1, 2]);
});

test('landing in an eliminated quadrant faults the last hitter', () => {
  const state = ffa(1);
  dropOn(state, 0);
  assert.equal(state.ships[0].alive, false);
  skipToRally(state);
  state.phase = 'rally';
  state.ball.active = true;
  state.ball.x = 200;
  state.ball.y = WORLD.midY - 8;
  state.ball.vx = 0;
  state.ball.vy = 900;
  state.lastHitter = 3;
  const before = state.ships[3].lives;
  step(state, inputs(0, {}));
  assert.equal(state.ships[3].lives, before - 1);
});
