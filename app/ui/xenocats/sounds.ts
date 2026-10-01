// The cats' sounds, synthesised with Web Audio: no audio files. Every attack has its
// own sound; every cat also has a sound for arriving and one for waking up, pitched
// to the cat. Sound is on by default and can be switched off (and stays off, in
// localStorage). Nothing plays before the visitor's first gesture on the page, as
// browsers require, and where Web Audio is missing nothing plays and nothing breaks.

import type { CatType } from './cat-types';

export type Tone = {
  /** An oscillator shape, or white noise. */
  wave: OscillatorType | 'noise';
  /** Hz; ignored for noise. */
  freq: number;
  /** Glides to this frequency by the end of the tone. */
  endFreq?: number;
  /** Seconds after the sound starts. */
  at: number;
  /** Seconds. */
  duration: number;
  /** Peak volume, 0–1. */
  gain: number;
};

export type Sound = readonly Tone[];

const tone = (
  wave: Tone['wave'],
  freq: number,
  at: number,
  duration: number,
  gain = 0.5,
  endFreq?: number
): Tone => ({ wave, freq, at, duration, gain, ...(endFreq ? { endFreq } : {}) });

/** Each attack's sound, keyed by effect id. */
export const ATTACK_SOUNDS: Readonly<Record<string, Sound>> = {
  // A long falling whoosh: the cursor is gone.
  vanish: [tone('sine', 880, 0, 0.5, 0.5, 110)],
  // A low, heavy drop.
  heavy: [tone('square', 110, 0, 0.6, 0.35, 55)],
  // A thump, then a rising zing.
  knockback: [tone('noise', 0, 0, 0.08, 0.6), tone('square', 220, 0.04, 0.15, 0.35, 880)],
  // Up and back down again.
  reverse: [tone('sawtooth', 300, 0, 0.18, 0.3, 600), tone('sawtooth', 600, 0.18, 0.18, 0.3, 300)],
  // Crackles of static.
  jitter: [0, 0.07, 0.14, 0.21].map((at) => tone('noise', 0, at, 0.04, 0.5)),
  // An icy shimmer.
  freeze: [tone('triangle', 1760, 0, 0.6, 0.3), tone('triangle', 2349, 0.05, 0.55, 0.25)],
  // A slow, drifting rise.
  drift: [tone('sine', 330, 0, 0.8, 0.4, 392)],
  // Three blips, each higher, as the cursor jumps.
  teleport: [0, 0.12, 0.24].map((at, i) => tone('square', 660 * (1 + i * 0.5), at, 0.06, 0.3)),
  // A beating magnetic hum.
  magnet: [tone('sawtooth', 80, 0, 0.6, 0.3), tone('sawtooth', 86, 0, 0.6, 0.3)],
  // Round and round between two notes.
  orbit: [0, 0.1, 0.2, 0.3].map((at, i) => tone('sine', i % 2 ? 660 : 440, at, 0.1, 0.4)),
  // A three-note chord, each cursor its own note.
  decoys: [523, 659, 784].map((freq, i) => tone('triangle', freq, i * 0.06, 0.35, 0.3)),
  // A woozy wobble.
  drunk: [tone('sine', 300, 0, 0.25, 0.4, 250), tone('sine', 250, 0.25, 0.3, 0.4, 320)],
  // A tiny squeak.
  tiny: [tone('sine', 2000, 0, 0.1, 0.35, 2600)],
  // A giant's stomp.
  giant: [tone('sawtooth', 60, 0, 0.7, 0.4, 40), tone('noise', 0, 0, 0.15, 0.4)],
  // A note and its late echoes.
  delay: [0, 0.2, 0.4].map((at, i) => tone('sine', 440, at, 0.15, 0.45 / (i + 1))),
  // A long fall.
  fall: [tone('sine', 900, 0, 0.7, 0.4, 150)],
  // A puff of smoke.
  blur: [tone('noise', 0, 0, 0.5, 0.3)],
  // A rising spiral.
  spiral: [tone('triangle', 200, 0, 0.8, 0.4, 1200)],
  // Boing, boing, boing.
  bounce: [0, 0.12, 0.24].map((at, i) =>
    tone('square', 300 + i * 150, at, 0.08, 0.3, 200 + i * 150)
  ),
  // A laser zap.
  'axis-lock': [tone('square', 1200, 0, 0.2, 0.3, 400)],
};

/** A plain chirp for an attack ATTACK_SOUNDS does not know. */
const FALLBACK_ATTACK: Sound = [tone('triangle', 440, 0, 0.2, 0.4, 660)];

/** Every cat sounds a little different: up to half an octave either side. */
export const pitchFor = (type: CatType) => 2 ** ((type.number - 10.5) / 19);

const transpose = (sound: Sound, factor: number): Sound =>
  sound.map((t) => ({
    ...t,
    freq: t.freq * factor,
    ...(t.endFreq ? { endFreq: t.endFreq * factor } : {}),
  }));

export type CatSounds = { attack: Sound; wake: Sound; arrive: Sound };

/** A cat type's three sounds. */
export function soundsFor(type: CatType): CatSounds {
  const pitch = pitchFor(type);
  return {
    attack: ATTACK_SOUNDS[type.effect.id] ?? FALLBACK_ATTACK,
    // A stretching yawn up a fifth.
    wake: transpose(
      [tone('triangle', 392, 0, 0.18, 0.3, 587), tone('sine', 587, 0.16, 0.12, 0.2)],
      pitch
    ),
    // A soft rising pop.
    arrive: transpose([tone('sine', 196, 0, 0.25, 0.35, 392)], pitch),
  };
}

// ------------------------------------------------------------- on/off, remembered

export const SOUND_KEY = 'xenocats:sound';

const listeners = new Set<() => void>();

/** Whether sound is on: the stored choice, on unless switched off. */
export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice lasts until the page is left.
    memory = on;
  }
  for (const listener of listeners) listener();
}

let memory: boolean | null = null;

/** For useSyncExternalStore: the stored choice, and changes to it (here or in another tab). */
export function subscribeSound(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export const getSoundEnabled = () => memory ?? soundEnabled();

// ------------------------------------------------------------------- the player

type AudioContextLike = Pick<
  AudioContext,
  | 'currentTime'
  | 'sampleRate'
  | 'state'
  | 'destination'
  | 'resume'
  | 'createOscillator'
  | 'createGain'
  | 'createBuffer'
  | 'createBufferSource'
>;

export type SoundPlayer = ReturnType<typeof createSoundPlayer>;

/**
 * Plays sounds once the page has had a user gesture. `createContext` makes the
 * AudioContext (tests pass their own); null, or one that throws, means no Web
 * Audio: every call is then a silent no-op.
 */
export function createSoundPlayer(
  createContext: () => AudioContextLike | null = defaultContext,
  enabled: () => boolean = getSoundEnabled
) {
  let context: AudioContextLike | null = null;
  let unlocked = false;
  let noise: AudioBuffer | null = null;

  function ensureContext(): AudioContextLike | null {
    if (context) return context;
    try {
      context = createContext();
    } catch {
      context = null;
    }
    return context;
  }

  return {
    /** The visitor has interacted with the page: audio may start. */
    unlock() {
      unlocked = true;
      // No context at all while sound is off; one is made when it is switched on.
      if (!enabled()) return;
      const ctx = ensureContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },

    isUnlocked: () => unlocked,

    /** Plays `sound` now, if sound is on, unlocked and available. Never throws. */
    play(sound: Sound): boolean {
      if (!unlocked || !enabled()) return false;
      const ctx = ensureContext();
      if (!ctx) return false;
      // A suspended context's clock stands still: sounds queued now would all play
      // at once later. Ask it to run, and skip this one.
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => {});
        return false;
      }
      try {
        const start = ctx.currentTime + 0.01;
        for (const t of sound) {
          const gain = ctx.createGain();
          const begin = start + t.at;
          const end = begin + t.duration;
          gain.gain.setValueAtTime(0.0001, begin);
          gain.gain.exponentialRampToValueAtTime(Math.max(t.gain * 0.25, 0.0002), begin + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          gain.connect(ctx.destination);
          if (t.wave === 'noise') {
            noise ??= whiteNoise(ctx);
            const source = ctx.createBufferSource();
            source.buffer = noise;
            source.connect(gain);
            source.start(begin);
            source.stop(end);
          } else {
            const osc = ctx.createOscillator();
            osc.type = t.wave;
            osc.frequency.setValueAtTime(t.freq, begin);
            if (t.endFreq) osc.frequency.exponentialRampToValueAtTime(t.endFreq, end);
            osc.connect(gain);
            osc.start(begin);
            osc.stop(end);
          }
        }
        return true;
      } catch {
        return false;
      }
    },
  };
}

function defaultContext(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function whiteNoise(ctx: AudioContextLike): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

let shared: SoundPlayer | null = null;

/**
 * The page's one player. Every cats provider uses it, so moving between pages
 * never leaves an AudioContext behind (browsers cap how many may exist).
 */
export function sharedSoundPlayer(): SoundPlayer {
  shared ??= createSoundPlayer();
  return shared;
}
