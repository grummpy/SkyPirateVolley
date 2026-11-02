import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../src/core/game.js';
import { makeRng } from '../src/core/rng.js';

test('same seed produces the same sequence', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  const seq = [];
  for (let i = 0; i < 32; i += 1) {
    const value = a.next();
    assert.equal(value, b.next());
    assert.ok(value >= 0 && value < 1);
    seq.push(value);
  }
  const other = [];
  const c = makeRng(7);
  for (let i = 0; i < 32; i += 1) other.push(c.next());
  assert.notDeepEqual(seq, other);
});

test('a reseeded generator repeats its series', () => {
  const first = makeRng(123456);
  const seen = [first.next(), first.next(), first.next()];
  const again = makeRng(123456);
  assert.deepEqual([again.next(), again.next(), again.next()], seen);
});

test('matches with the same seed stay in lockstep', () => {
  function digest(seed) {
    const state = createMatch({ seed, slots: ['bot', 'bot', 'bot', 'bot'] });
    for (let i = 0; i < 500; i += 1) step(state);
    return {
      ball: [state.ball.x, state.ball.y, state.ball.vx, state.ball.vy],
      score: { ...state.score },
      ships: state.ships.map((ship) => [ship.x, ship.y, ship.points, ship.charge]),
      phase: state.phase,
      wind: state.wind,
    };
  }
  assert.deepEqual(digest(11), digest(11));
  assert.notDeepEqual(digest(11), digest(12));
});
