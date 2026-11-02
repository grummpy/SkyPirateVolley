/** Pure keyboard + gamepad mapping. No DOM. */

export const DEFAULT_BINDINGS = [
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', action: 'KeyF', secondary: 'KeyG' },
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', action: 'Slash', secondary: 'Period' },
  { left: 'KeyJ', right: 'KeyL', up: 'KeyI', down: 'KeyK', action: 'Semicolon', secondary: 'Quote' },
  { left: 'Numpad4', right: 'Numpad6', up: 'Numpad8', down: 'Numpad5', action: 'Numpad0', secondary: 'NumpadEnter' },
];

export const BINDING_FIELDS = ['up', 'down', 'left', 'right', 'action', 'secondary'];

const DEADZONE = 0.28;

export function idleInput() {
  return { x: 0, y: 0, action: false, secondary: false, pause: false };
}

export function cloneBindings(bindings = DEFAULT_BINDINGS) {
  return bindings.map((row, i) => ({ ...DEFAULT_BINDINGS[i], ...row }));
}

function axisToDigital(value) {
  if (Math.abs(value) < DEADZONE) return 0;
  return Math.sign(value);
}

function fromKeys(down, binding) {
  const left = down.has(binding.left);
  const right = down.has(binding.right);
  const up = down.has(binding.up);
  const downKey = down.has(binding.down);
  let x = 0;
  let y = 0;
  if (left && !right) x = -1;
  else if (right && !left) x = 1;
  if (up && !downKey) y = -1;
  else if (downKey && !up) y = 1;
  return {
    x,
    y,
    action: down.has(binding.action),
    secondary: down.has(binding.secondary),
    pause: false,
  };
}

/**
 * Standard mapping: axes 0/1 left stick, buttons 0 A, 1 B, 9 Start,
 * 12-15 D-pad up/down/left/right. Positive stick Y is down.
 */
export function fromGamepad(pad) {
  if (!pad || !pad.connected) return null;
  const buttons = pad.buttons || [];
  const axes = pad.axes || [0, 0];
  const dpadUp = !!buttons[12];
  const dpadDown = !!buttons[13];
  const dpadLeft = !!buttons[14];
  const dpadRight = !!buttons[15];
  let x;
  let y;
  if (dpadUp || dpadDown || dpadLeft || dpadRight) {
    x = (dpadRight ? 1 : 0) - (dpadLeft ? 1 : 0);
    y = (dpadDown ? 1 : 0) - (dpadUp ? 1 : 0);
  } else {
    x = axisToDigital(Number(axes[0]) || 0);
    y = axisToDigital(Number(axes[1]) || 0);
  }
  return {
    x,
    y,
    action: !!buttons[0],
    secondary: !!buttons[1],
    pause: !!buttons[9],
  };
}

/**
 * @param {object} params
 * @param {Set<string>|string[]} params.codesDown
 * @param {Array<object|null>} [params.pads] index 0-3, connected pad overrides that player's keys
 * @param {Array<object>} [params.bindings]
 */
export function mapPlayers({ codesDown, pads, bindings } = {}) {
  const down = codesDown instanceof Set ? codesDown : new Set(codesDown || []);
  const maps = cloneBindings(bindings);
  const actions = [];
  let pause = down.has('Escape');
  for (let i = 0; i < 4; i += 1) {
    const padAction = fromGamepad(pads?.[i]);
    if (padAction) {
      actions.push(padAction);
      if (padAction.pause) pause = true;
    } else {
      actions.push(fromKeys(down, maps[i]));
    }
  }
  return { actions, pause, escape: down.has('Escape'), mute: down.has('KeyM') };
}
