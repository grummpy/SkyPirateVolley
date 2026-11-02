import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD, createMatch, gameIsWon, step } from '../src/core/game.js';
import { humans, inputs, skipToRally } from './helpers.js';

function match(extra = {}) {
  return createMatch({
    seed: 9,
    slots: humans(),
    pointsToWin: 11,
    gamesToWin: 2,
    ...extra,
  });
}

function award(state, team) {
  if (state.phase !== 'rally') skipToRally(state);
  state.phase = 'rally';
  state.ball.active = true;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.x = team === 'left' ? 1040 : 180;
  state.ball.y = WORLD.floor + 4;
  step(state, inputs(0, {}));
}

test('win by two, and not a bare reaching of the target', () => {
  assert.equal(gameIsWon(11, 10, 11), false);
  assert.equal(gameIsWon(11, 9, 11), true);
  assert.equal(gameIsWon(10, 0, 11), false);
  assert.equal(gameIsWon(12, 10, 11), true);
});

test('a ball through the bottom clouds scores for the other side', () => {
  const state = match();
  skipToRally(state);
  award(state, 'left');
  assert.equal(state.score.left, 1);
  assert.equal(state.score.right, 0);
  assert.equal(state.phase, 'point');
  assert.ok(state.ships.some((ship) => ship.team === 'left' && ship.points === 1));
  award(state, 'right');
  assert.equal(state.score.right, 1);
});

test('deuce must be won by two, then a game is recorded', () => {
  const state = match();
  skipToRally(state);
  for (let i = 0; i < 10; i += 1) {
    award(state, 'left');
    award(state, 'right');
  }
  assert.equal(state.score.left, 10);
  assert.equal(state.score.right, 10);
  award(state, 'left');
  assert.equal(state.score.left, 11);
  assert.equal(state.score.right, 10);
  assert.equal(state.phase, 'point');
  assert.equal(state.games.left, 0);
  award(state, 'left');
  assert.equal(state.score.left, 12);
  assert.equal(state.phase, 'game');
  assert.equal(state.games.left, 1);
  assert.match(state.banner.title, /WINS THE GAME/);
});

test('best of three ends the match when a side takes two games', () => {
  const state = match({ pointsToWin: 2, gamesToWin: 2 });
  skipToRally(state);
  award(state, 'right');
  award(state, 'right');
  assert.equal(state.phase, 'game');
  assert.equal(state.games.right, 1);
  award(state, 'right');
  award(state, 'right');
  assert.equal(state.phase, 'match');
  assert.equal(state.matchWinner, 'right');
  assert.equal(state.games.right, 2);
  assert.match(state.banner.title, /MATCH/);
});

test('the fourth touch on a side is a fault', () => {
  const state = match();
  skipToRally(state);
  const ship = state.ships[0];
  state.possessing = 'left';
  state.touches.left = 3;
  state.ball.active = true;
  state.ball.x = ship.x + 28;
  state.ball.y = ship.y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  ship.actionHeld = true;
  ship.charge = 0.3;
  step(state, inputs(0, { action: false, x: 1, y: -0.5 }));
  assert.equal(state.score.right, 1);
  assert.equal(state.phase, 'point');
  assert.match(state.banner.reason, /touch/);
});

test('a new possession resets the touch count', () => {
  const state = match();
  skipToRally(state);
  state.possessing = 'right';
  state.touches.right = 2;
  state.touches.left = 3;
  const ship = state.ships[0];
  state.ball.active = true;
  state.ball.x = ship.x + 24;
  state.ball.y = ship.y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  ship.actionHeld = true;
  step(state, inputs(0, { action: false, x: 0.4, y: -0.8 }));
  assert.equal(state.touches.left, 1);
  assert.equal(state.touches.right, 0);
  assert.equal(state.score.right, 0);
  assert.equal(state.lastHitter, 0);
});
