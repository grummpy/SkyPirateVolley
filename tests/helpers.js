import { step } from '../src/core/game.js';

export function idle() {
  return { x: 0, y: 0, action: false, secondary: false, pause: false };
}

export function humans() {
  return ['human', 'human', 'human', 'human'];
}

export function inputs(index, partial) {
  return [0, 1, 2, 3].map((i) => (i === index ? { ...idle(), ...partial } : idle()));
}

/** Jump a countdown or point pause straight into a live rally. */
export function skipToRally(state) {
  let guard = 0;
  while (state.phase !== 'rally' && state.phase !== 'match' && guard < 40) {
    if (state.phase === 'countdown') {
      state.countdown = 1;
      state.countdownTicks = 1;
    } else if (state.phase === 'point' || state.phase === 'game') {
      state.pointTimer = 1;
    }
    step(state, [idle(), idle(), idle(), idle()]);
    guard += 1;
  }
  return state;
}
