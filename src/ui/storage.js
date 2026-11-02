import { cloneBindings } from '../core/inputmap.js';

const KEY = 'skypiratevolley.settings.v1';

export function defaultSettings() {
  return {
    volume: 0.7,
    muted: false,
    bestOf: 3,
    bindings: cloneBindings(),
  };
}

export function loadSettings() {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    const bestOf = [1, 3, 5].includes(saved.bestOf) ? saved.bestOf : base.bestOf;
    const volume = Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : base.volume;
    return {
      volume,
      muted: !!saved.muted,
      bestOf,
      bindings: cloneBindings(saved.bindings),
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode and file URLs can refuse storage */
  }
}
