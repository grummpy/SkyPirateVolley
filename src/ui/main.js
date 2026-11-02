import { BINDING_FIELDS, cloneBindings, mapPlayers } from '../core/inputmap.js';
import { ROSTER, createMatch, step } from '../core/game.js';
import { createAudio } from './audio.js';
import { hitSpot, render } from './render.js';
import { loadSettings, saveSettings } from './storage.js';

const canvas = document.getElementById('court');
const ctx = canvas.getContext('2d');
const live = document.getElementById('live');
const audio = createAudio();
const cover = new Image();
cover.src = 'assets/cover.jpg';

const STEP_MS = 1000 / 60;
const BEST_OF = [1, 3, 5];

let settings = loadSettings();
audio.setVolume(settings.volume);
audio.setMuted(settings.muted);

let screen = 'title';
let mode = '2v2';
let slotState = ['open', 'open', 'open', 'open'];
let match = null;
let menuIndex = 0;
let controlCursor = { player: 0, field: 0 };
let capturing = false;
let notice = '';
let lastSlots = ['bot', 'bot', 'bot', 'bot'];
let lastMode = '2v2';

const codesDown = new Set();
const justPressed = new Set();
let prevActions = [0, 1, 2, 3].map(() => ({ action: false, secondary: false }));
let prevPause = false;
let prevMute = false;
let pads = [null, null, null, null];
const trail = [];
const particles = [];
let acc = 0;
let lastTime = performance.now();

function say(text) {
  if (live) live.textContent = text;
}

function gamesToWin() {
  return Math.ceil(settings.bestOf / 2);
}

function readPads() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  const next = [null, null, null, null];
  for (let i = 0; i < 4; i += 1) {
    const pad = list && list[i];
    if (!pad || !pad.connected) continue;
    const buttons = [];
    for (let b = 0; b < pad.buttons.length; b += 1) {
      const button = pad.buttons[b];
      buttons[b] = !!(button && (button.pressed || button.value > 0.5));
    }
    next[i] = { connected: true, axes: [pad.axes[0] || 0, pad.axes[1] || 0], buttons };
  }
  return next;
}

function mapped() {
  return mapPlayers({ codesDown, pads, bindings: settings.bindings });
}

function burst(x, y, color) {
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * 90,
      vy: Math.sin(angle) * 90,
      life: 18,
      max: 18,
      color,
    });
  }
}

function playEvents() {
  if (!match) return;
  for (const event of match.events) {
    audio.play(event);
    if (event === 'hit' || event === 'powerhit' || event === 'spike') {
      burst(match.ball.x, match.ball.y, event === 'spike' ? '#ffd166' : '#fff1b8');
    }
    if (event === 'score' || event === 'ko' || event === 'game' || event === 'match') {
      say(match.banner?.title || event);
    }
  }
}

function rememberHeld(actions) {
  if (!match) return;
  match.ships.forEach((ship, i) => {
    ship.actionHeld = !!actions[i].action;
    ship.secondaryHeld = !!actions[i].secondary;
  });
}

function canLaunch() {
  const active = slotState.filter((slot) => slot !== 'off').length;
  if (mode === 'ffa') return active >= 2;
  const left = slotState[0] !== 'off' || slotState[1] !== 'off';
  const right = slotState[2] !== 'off' || slotState[3] !== 'off';
  return left && right;
}

function launch(seed) {
  if (!canLaunch()) {
    notice = mode === 'ffa' ? 'Need two ships in the air.' : 'Each sky needs a ship.';
    return;
  }
  notice = '';
  lastSlots = slotState.map((slot) => (slot === 'human' ? 'human' : slot === 'off' ? 'off' : 'bot'));
  lastMode = mode;
  match = createMatch({
    mode,
    slots: lastSlots,
    seed: seed ?? ((Date.now() >>> 0) || 1),
    pointsToWin: 11,
    gamesToWin: gamesToWin(),
    lives: 7,
  });
  trail.length = 0;
  screen = 'play';
  say(`${mode === 'ffa' ? 'Free-for-all' : '2v2'} launched`);
  audio.play('countdown');
}

function goTitle() {
  screen = 'title';
  match = null;
  menuIndex = 0;
  notice = '';
  say('Sky Pirate Volley');
}

function syncScreen() {
  document.body.dataset.screen = screen;
}

function cycleSlot(index) {
  const slot = slotState[index];
  if (slot === 'human') slotState[index] = 'open';
  else slotState[index] = slot === 'off' ? 'open' : 'off';
}

function handleMenus(actions, edges) {
  const pauseEdge = mappedPause(actions) && !prevPause;
  const muteEdge = actions.mute && !prevMute;
  prevPause = mappedPause(actions);
  prevMute = actions.mute;

  if (muteEdge && !capturing) {
    settings.muted = audio.toggleMuted();
    saveSettings(settings);
    say(settings.muted ? 'Muted' : 'Sound on');
  }

  const enter = justPressed.has('Enter') || justPressed.has('Space');
  const up = justPressed.has('ArrowUp') || justPressed.has('KeyW');
  const down = justPressed.has('ArrowDown') || justPressed.has('KeyS');
  const left = justPressed.has('ArrowLeft') || justPressed.has('KeyA');
  const right = justPressed.has('ArrowRight') || justPressed.has('KeyD');

  if (screen === 'controls' && capturing) {
    const ignore = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
    const key = [...justPressed].find((code) => !ignore.has(code));
    if (key === 'Escape') capturing = false;
    else if (key) {
      const binding = settings.bindings[controlCursor.player];
      binding[BINDING_FIELDS[controlCursor.field]] = key;
      saveSettings(settings);
      capturing = false;
    }
    return;
  }

  if (screen === 'title') {
    const anyAction = edges.some((edge) => edge.action);
    if (enter || pauseEdge || anyAction || justPressed.has('Digit1')) {
      audio.startTheme();
      screen = 'join';
      say('Join screen. Press fire to board, Enter to launch.');
    }
    return;
  }

  if (screen === 'join') {
    audio.startTheme();
    edges.forEach((edge, i) => {
      if (edge.action) slotState[i] = 'human';
      if (edge.secondary) cycleSlot(i);
    });
    if (justPressed.has('Digit1')) mode = '2v2';
    if (justPressed.has('Digit2')) mode = 'ffa';
    if (justPressed.has('Escape')) {
      goTitle();
      return;
    }
    if (enter || (pauseEdge && !inputHasEscape())) launch();
    return;
  }

  if (screen === 'pause') {
    if (up) menuIndex = (menuIndex + 2) % 3;
    if (down) menuIndex = (menuIndex + 1) % 3;
    if (pauseEdge || justPressed.has('Escape')) {
      rememberHeld(actions.actions);
      screen = 'play';
      return;
    }
    if (enter) activatePause();
    return;
  }

  if (screen === 'settings') {
    if (up) menuIndex = (menuIndex + 3) % 4;
    if (down) menuIndex = (menuIndex + 1) % 4;
    if (menuIndex === 0 && (left || right)) {
      settings.volume = Math.max(0, Math.min(1, settings.volume + (right ? 0.1 : -0.1)));
      settings.volume = Math.round(settings.volume * 10) / 10;
      audio.setVolume(settings.volume);
      saveSettings(settings);
    }
    if (menuIndex === 1 && (left || right)) {
      const index = BEST_OF.indexOf(settings.bestOf);
      const next = (index + (right ? 1 : BEST_OF.length - 1)) % BEST_OF.length;
      settings.bestOf = BEST_OF[next];
      saveSettings(settings);
    }
    if (enter) {
      if (menuIndex === 2) {
        screen = 'controls';
        capturing = false;
      } else if (menuIndex === 3 || menuIndex === 0) {
        if (menuIndex === 3) backFromSettings();
      }
      if (menuIndex === 1) {
        /* row already shows the value; enter leaves it */
      }
    }
    if (justPressed.has('Escape')) backFromSettings();
    return;
  }

  if (screen === 'controls') {
    if (left) controlCursor.player = (controlCursor.player + 3) % 4;
    if (right) controlCursor.player = (controlCursor.player + 1) % 4;
    if (up) controlCursor.field = (controlCursor.field + BINDING_FIELDS.length - 1) % BINDING_FIELDS.length;
    if (down) controlCursor.field = (controlCursor.field + 1) % BINDING_FIELDS.length;
    if (enter) capturing = true;
    if (justPressed.has('Backspace')) {
      settings.bindings = cloneBindings();
      saveSettings(settings);
    }
    if (justPressed.has('Escape')) {
      screen = match ? 'pause' : 'settings';
    }
    return;
  }

  if (screen === 'play' && match?.phase === 'match') {
    if (enter) launch((Date.now() >>> 0) || 1);
    if (justPressed.has('Escape')) goTitle();
    return;
  }

  if (screen === 'play' && (pauseEdge || justPressed.has('Escape'))) {
    menuIndex = 0;
    screen = 'pause';
    say('Paused');
  }
}

function mappedPause(actions) {
  return actions.pause;
}

function inputHasEscape() {
  return codesDown.has('Escape') || justPressed.has('Escape');
}

function activatePause() {
  if (menuIndex === 0) {
    rememberHeld(mapped().actions);
    screen = 'play';
  } else if (menuIndex === 1) {
    screen = 'settings';
    menuIndex = 0;
  } else {
    goTitle();
  }
}

function backFromSettings() {
  screen = match ? 'pause' : 'join';
  menuIndex = 0;
}

function onClick(x, y) {
  const id = hitSpot(x, y);
  if (!id) return;
  audio.startTheme();
  if (id === 'start-title') {
    screen = 'join';
    return;
  }
  if (id === 'mode-2v2') mode = '2v2';
  if (id === 'mode-ffa') mode = 'ffa';
  if (id.startsWith('slot-')) {
    const index = Number(id.slice(5));
    if (slotState[index] === 'open') slotState[index] = 'human';
    else if (slotState[index] === 'human') slotState[index] = 'off';
    else slotState[index] = 'open';
  }
  if (id === 'start-match') launch();
  if (id === 'pause-resume') {
    menuIndex = 0;
    activatePause();
  }
  if (id === 'pause-settings') {
    screen = 'settings';
    menuIndex = 0;
  }
  if (id === 'pause-quit' || id === 'to-title') goTitle();
  if (id === 'open-controls') screen = 'controls';
  if (id === 'settings-back' || id === 'controls-back') backFromSettings();
  if (id === 'volume') {
    settings.volume = Math.round(Math.min(1, settings.volume + 0.1) * 10) / 10;
    if (settings.volume >= 1) settings.volume = 0;
    audio.setVolume(settings.volume);
    saveSettings(settings);
  }
  if (id === 'bestof') {
    const index = BEST_OF.indexOf(settings.bestOf);
    settings.bestOf = BEST_OF[(index + 1) % BEST_OF.length];
    saveSettings(settings);
  }
  if (id === 'rematch') launch((Date.now() >>> 0) || 1);
  if (id === 'controls-reset') {
    settings.bindings = cloneBindings();
    saveSettings(settings);
  }
  if (id.startsWith('bind-')) {
    const [, player, field] = id.split('-');
    controlCursor = { player: Number(player), field: Number(field) };
    capturing = true;
    screen = 'controls';
  }
}

function pointer(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height,
  };
}

const blocked = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
]);

window.addEventListener('keydown', (event) => {
  if (!codesDown.has(event.code)) justPressed.add(event.code);
  codesDown.add(event.code);
  if (blocked.has(event.code) || event.code.startsWith('Numpad') || ['Slash', 'Quote', 'Semicolon'].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  codesDown.delete(event.code);
});

window.addEventListener('blur', () => {
  codesDown.clear();
});

canvas.addEventListener('pointerdown', (event) => {
  canvas.focus();
  const point = pointer(event);
  onClick(point.x, point.y);
});

function updateParticles(ms) {
  const dt = ms / 1000;
  for (const bit of particles) {
    bit.life -= ms / (1000 / 60);
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
}

function simulate(actions) {
  if (screen !== 'play' || !match || match.phase === 'match') return;
  let guard = 0;
  while (acc >= STEP_MS && guard < 5) {
    acc -= STEP_MS;
    guard += 1;
    step(match, actions);
    playEvents();
    if (match.ball.active) {
      trail.push({ x: match.ball.x, y: match.ball.y });
      if (trail.length > 16) trail.shift();
    } else {
      trail.length = 0;
    }
  }
}

function frame(now) {
  const elapsed = Math.min(100, now - lastTime);
  lastTime = now;
  if (screen === 'play' && match && match.phase !== 'match') acc += elapsed;
  else acc = 0;

  pads = readPads();
  const input = mapped();
  const edges = input.actions.map((action, i) => ({
    action: action.action && !prevActions[i].action,
    secondary: action.secondary && !prevActions[i].secondary,
  }));
  handleMenus(input, edges);
  prevActions = input.actions.map((action) => ({ action: action.action, secondary: action.secondary }));
  simulate(input.actions);
  updateParticles(elapsed);
  syncScreen();
  render(ctx, {
    screen,
    mode,
    slots: slotState,
    match,
    settings,
    menuIndex,
    controlCursor,
    capturing,
    notice,
    pads,
    roster: ROSTER,
    cover,
    time: now,
    trail,
    particles,
  });
  justPressed.clear();
  requestAnimationFrame(frame);
}

canvas.focus();
say('Sky Pirate Volley. Press Enter to start.');
requestAnimationFrame(frame);

window.__SKY__ = {
  get screen() {
    return screen;
  },
  snapshot() {
    return {
      screen,
      mode: match?.mode ?? mode,
      slots: match ? match.ships.map((ship) => (ship.human ? 'human' : ship.participating ? 'bot' : 'off')) : [...slotState],
      phase: match?.phase ?? null,
      score: match ? { ...match.score } : null,
      games: match ? { ...match.games } : null,
      lives: match ? match.ships.map((ship) => ship.lives) : null,
      human: match ? match.ships.map((ship) => ship.human) : null,
      tick: match?.tick ?? 0,
      rally: match?.rally ?? 0,
      banner: match?.banner?.title ?? null,
      ballActive: !!match?.ball?.active,
      gameNumber: match?.gameNumber ?? null,
      matchWinner: match?.matchWinner ?? null,
      participating: match ? match.ships.map((ship) => ship.participating) : null,
    };
  },
};
