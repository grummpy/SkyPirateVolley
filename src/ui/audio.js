/** Live Web Audio chiptune. No sample files. */

const MELODY = [220, 277.18, 329.63, 220, 196, 164.81, 174.61, 246.94];

export function createAudio() {
  let ctx = null;
  let volume = 0.7;
  let muted = false;
  let timer = null;
  let stepIndex = 0;
  let armed = false;

  function context() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function envGain(duration, peak) {
    const audio = context();
    const gain = audio.createGain();
    const now = audio.currentTime;
    const amp = muted ? 0.0001 : Math.max(0.0001, peak * volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(amp, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.03, duration));
    gain.connect(audio.destination);
    return { audio, gain, now };
  }

  function tone(freq, duration, type, peak) {
    if (muted) return;
    const { audio, gain, now } = envGain(duration, peak);
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.03);
    void audio;
  }

  function noise(duration, peak) {
    if (muted) return;
    const { audio, gain, now } = envGain(duration, peak);
    const length = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = (length * 17 + Math.floor(now * 1000)) >>> 0;
    for (let i = 0; i < length; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    const src = audio.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    src.start(now);
  }

  function note() {
    if (muted) return;
    const freq = MELODY[stepIndex % MELODY.length];
    tone(freq, 0.26, 'triangle', 0.055);
    if (stepIndex % 2 === 0) tone(freq / 2, 0.26, 'sine', 0.03);
    stepIndex += 1;
  }

  return {
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
    },
    setMuted(value) {
      muted = !!value;
      if (muted) this.stopTheme();
      else if (armed) this.startTheme();
    },
    toggleMuted() {
      this.setMuted(!muted);
      return muted;
    },
    isMuted() {
      return muted;
    },
    startTheme() {
      armed = true;
      if (muted || timer) return;
      try {
        context();
        note();
        timer = setInterval(note, 320);
      } catch {
        /* autoplay can block the context until the next gesture */
      }
    },
    stopTheme() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    play(event) {
      if (muted || !event) return;
      try {
        context();
      } catch {
        return;
      }
      if (event === 'hit') {
        tone(494, 0.08, 'square', 0.09);
        noise(0.05, 0.04);
      } else if (event === 'powerhit') {
        tone(160, 0.18, 'sawtooth', 0.11);
        tone(90, 0.22, 'square', 0.06);
      } else if (event === 'spike') {
        noise(0.08, 0.1);
        tone(130, 0.12, 'square', 0.1);
      } else if (event === 'boost') {
        noise(0.07, 0.05);
        tone(720, 0.09, 'sine', 0.04);
      } else if (event === 'pickup') {
        tone(660, 0.07, 'square', 0.08);
        tone(880, 0.11, 'square', 0.07);
      } else if (event === 'ko') {
        tone(196, 0.22, 'sawtooth', 0.1);
        tone(98, 0.36, 'triangle', 0.08);
      } else if (event === 'countdown' || event === 'serve') {
        tone(880, 0.09, 'square', 0.07);
      } else if (event === 'score') {
        tone(523, 0.12, 'triangle', 0.09);
      } else if (event === 'game') {
        tone(523, 0.1, 'square', 0.09);
        tone(659, 0.12, 'square', 0.09);
        tone(784, 0.2, 'square', 0.09);
      } else if (event === 'match') {
        tone(523, 0.12, 'triangle', 0.1);
        tone(659, 0.16, 'triangle', 0.1);
        tone(784, 0.28, 'triangle', 0.11);
      }
    },
  };
}
