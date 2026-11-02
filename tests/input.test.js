import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BINDINGS,
  cloneBindings,
  fromGamepad,
  mapPlayers,
} from '../src/core/inputmap.js';

test('default keyboard split maps all four players', () => {
  const { actions, pause } = mapPlayers({
    codesDown: ['KeyW', 'KeyA', 'KeyF', 'ArrowRight', 'Slash', 'KeyI', 'Semicolon', 'Numpad4', 'Numpad0', 'NumpadEnter'],
  });
  assert.deepEqual(actions[0], { x: -1, y: -1, action: true, secondary: false, pause: false });
  assert.equal(actions[1].x, 1);
  assert.equal(actions[1].action, true);
  assert.equal(actions[2].y, -1);
  assert.equal(actions[2].action, true);
  assert.equal(actions[3].x, -1);
  assert.equal(actions[3].action, true);
  assert.equal(actions[3].secondary, true);
  assert.equal(pause, false);
  assert.equal(DEFAULT_BINDINGS[1].secondary, 'Period');
  assert.equal(DEFAULT_BINDINGS[2].action, 'Semicolon');
  assert.equal(DEFAULT_BINDINGS[2].secondary, 'Quote');
});

test('opposite keys cancel and custom bindings are honored', () => {
  const cancelled = mapPlayers({ codesDown: ['KeyA', 'KeyD', 'KeyW', 'KeyS'] });
  assert.equal(cancelled.actions[0].x, 0);
  assert.equal(cancelled.actions[0].y, 0);

  const bindings = cloneBindings();
  bindings[0] = { ...bindings[0], left: 'KeyZ', action: 'KeyQ' };
  const { actions } = mapPlayers({
    codesDown: ['KeyA', 'KeyZ', 'KeyQ'],
    bindings,
  });
  assert.equal(actions[0].x, -1);
  assert.equal(actions[0].action, true);
});

test('escape and the mute key are global', () => {
  const paused = mapPlayers({ codesDown: ['Escape'] });
  assert.equal(paused.pause, true);
  assert.equal(paused.escape, true);
  const muted = mapPlayers({ codesDown: ['KeyM'] });
  assert.equal(muted.mute, true);
  assert.equal(muted.pause, false);
});

test('gamepad stick, d-pad, face buttons, and start', () => {
  const neutral = fromGamepad({ connected: true, axes: [0.1, -0.12], buttons: [] });
  assert.equal(neutral.x, 0);
  assert.equal(neutral.y, 0);

  const stick = fromGamepad({
    connected: true,
    axes: [0.9, -0.8],
    buttons: { 0: true, 1: false, 9: true },
  });
  assert.equal(stick.x, 1);
  assert.equal(stick.y, -1);
  assert.equal(stick.action, true);
  assert.equal(stick.secondary, false);
  assert.equal(stick.pause, true);

  const dpad = fromGamepad({
    connected: true,
    axes: [0.95, 0.95],
    buttons: { 12: true, 14: true },
  });
  assert.equal(dpad.x, -1);
  assert.equal(dpad.y, -1);
});

test('a connected pad overrides that player keyboard and leaves the others alone', () => {
  const { actions, pause } = mapPlayers({
    codesDown: ['KeyD', 'KeyF', 'ArrowUp'],
    pads: [
      { connected: true, axes: [0, 0], buttons: { 0: true, 9: true } },
      null,
      null,
      null,
    ],
  });
  assert.equal(actions[0].x, 0);
  assert.equal(actions[0].action, true);
  assert.equal(actions[0].pause, true);
  assert.equal(actions[1].y, -1);
  assert.equal(pause, true);
});

test('disconnected pads are ignored', () => {
  const mapped = mapPlayers({
    codesDown: ['KeyF'],
    pads: [{ connected: false, axes: [1, 0], buttons: { 0: false } }],
  });
  assert.equal(mapped.actions[0].action, true);
  assert.equal(mapped.actions[0].x, 0);
});
