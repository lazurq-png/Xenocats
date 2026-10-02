// The cats' sounds, synthesised with Web Audio: no audio files. They are built from
// a small cat vocabulary — meow, mew, yowl, trill, purr, hiss, growl, chatter and
// yawn — each a buzzing voice (or breath) shaped into vowels by formant filters,
// with a pitch contour, vibrato or pulsing, the way a cat's voice is. Every attack
// has its own sound, a cat's call with an alien twist; every cat also has a sound
// for arriving, waking up and purring, pitched to the cat (a bigger voice, lower
// formants). Sound is on by default and can be switched off (and stays off, in
// localStorage). Nothing plays before the visitor's first gesture on the page, as
// browsers require, and where Web Audio is missing nothing plays and nothing breaks.

import type { CatType } from './cat-types';

/** A band of the voice the sound is filtered through: a formant, as of a vowel. */
export type Formant = {
  /** Its centre over the tone, Hz: one value, or a path spread evenly across it. */
  path: readonly number[];
  /** How narrow the band is. */
  q: number;
  /** How much of it is heard. */
  gain: number;
};

export type Tone = {
  /** An oscillator shape, or white noise (breath, hiss). */
  wave: OscillatorType | 'noise';
  /** Hz; ignored for noise. Where the tone has a contour, its first value. */
  freq: number;
  /** Glides to this frequency by the end of the tone. */
  endFreq?: number;
  /** A pitch path, Hz, spread evenly across the tone (instead of freq → endFreq). */
  contour?: readonly number[];
  /** Seconds after the sound starts. */
  at: number;
  /** Seconds. */
  duration: number;
  /** Peak volume, 0–1. */
  gain: number;
  /** Seconds to swell to full volume (default 0.01). */
  attack?: number;
  /** The vowel: the bands it is filtered through. None: heard as it is. */
  formants?: readonly Formant[];
  /** A wavering pitch: rate in Hz, depth in cents. */
  vibrato?: { rate: number; depth: number };
  /** A pulsing volume (a purr's rumble, a trill's roll): rate in Hz, depth 0–1. */
  pulse?: { rate: number; depth: number };
};

export type Sound = readonly Tone[];

// ---------------------------------------------------------------- the vocabulary

/** The first three formants of the vowels a cat's call moves through, Hz. */
const VOWELS = {
  m: [250, 1000, 2400], // lips closed
  i: [320, 2300, 3000],
  e: [520, 1900, 2700],
  a: [880, 1400, 2600],
  o: [560, 950, 2500],
  u: [360, 800, 2300],
} as const;
type Vowel = keyof typeof VOWELS;

/** The bands for a call moving through `vowels` (e.g. 'meau': m-e-a-u). */
const mouth = (vowels: string, width = 1): Formant[] =>
  [0, 1, 2].map((k) => ({
    path: [...vowels].map((v) => VOWELS[v as Vowel][k]),
    q: [6, 9, 11][k] / width,
    gain: [5, 3.5, 1.5][k],
  }));

type Call = {
  /** The call's pitch shape, as multiples of `f0`. */
  shape: readonly number[];
  vowels: string;
  vibrato?: Tone['vibrato'];
  pulse?: Tone['pulse'];
  /** How breathy it is: the share of breath heard with the voice. */
  breath?: number;
  wave?: OscillatorType;
};

/** A voiced call at pitch `f0`: the voice, with a breath of air through the same mouth. */
function call(f0: number, at: number, duration: number, gain: number, c: Call): Tone[] {
  const contour = c.shape.map((m) => m * f0);
  const formants = mouth(c.vowels);
  const voice: Tone = {
    wave: c.wave ?? 'sawtooth',
    freq: contour[0],
    contour,
    at,
    duration,
    gain,
    attack: Math.min(0.05, duration / 4),
    formants,
    ...(c.vibrato ? { vibrato: c.vibrato } : {}),
    ...(c.pulse ? { pulse: c.pulse } : {}),
  };
  const breath = c.breath ?? 0.12;
  if (breath <= 0) return [voice];
  return [
    voice,
    {
      wave: 'noise',
      freq: 0,
      at,
      duration,
      gain: Math.min(gain * breath * 3, 1),
      attack: voice.attack,
      formants,
      ...(c.pulse ? { pulse: c.pulse } : {}),
    },
  ];
}

/** "Mi-a-ow": up, then down, the mouth opening and closing. */
const meow = (f0: number, at = 0, duration = 0.6, gain = 0.6, extra: Partial<Call> = {}) =>
  call(f0, at, duration, gain, {
    shape: [0.85, 1.1, 1.2, 1.05, 0.75],
    vowels: 'meaou',
    vibrato: { rate: 6, depth: 20 },
    ...extra,
  });

/** A kitten's short, high "mew". */
const mew = (f0: number, at = 0, gain = 0.5) =>
  call(f0 * 1.6, at, 0.22, gain, { shape: [1, 1.15, 0.95], vowels: 'ieu', breath: 0.05 });

/** A long, wailing "mrrooOOWW". */
const yowl = (f0: number, at = 0, duration = 1.1, gain = 0.6, shape?: readonly number[]) =>
  call(f0 * 0.75, at, duration, gain, {
    shape: shape ?? [0.8, 0.9, 1.25, 1.3, 1.1, 0.85],
    vowels: 'muaaou',
    vibrato: { rate: 5, depth: 45 },
    breath: 0.2,
  });

/** "Brrrp?": a rolled, rising greeting. */
const trill = (f0: number, at = 0, duration = 0.3, gain = 0.5, rising = true) =>
  call(f0 * 0.9, at, duration, gain, {
    shape: rising ? [0.9, 1.05, 1.3] : [1.3, 1.05, 0.9],
    vowels: 'meo',
    pulse: { rate: 24, depth: 0.85 },
    breath: 0.1,
  });

/** A low, rough growl. */
const growl = (f0: number, at = 0, duration = 0.8, gain = 0.6) =>
  call(f0 * 0.2, at, duration, gain, {
    shape: [1, 0.95, 1.05, 0.9],
    vowels: 'oou',
    pulse: { rate: 32, depth: 0.6 },
    vibrato: { rate: 4, depth: 40 },
    breath: 0.3,
  });

/** A hiss: air forced through the teeth, sharp at the start. */
const hiss = (at = 0, duration = 0.6, gain = 0.5): Tone[] => [
  {
    wave: 'noise',
    freq: 0,
    at,
    duration,
    gain,
    attack: 0.02,
    formants: [
      { path: [3800, 4200, 3600], q: 2, gain: 3 },
      { path: [7000], q: 1.5, gain: 2 },
    ],
  },
];

/** A purr: a breathy rumble, ~25 pulses a second, breathing in and then out. */
const purr = (f0: number, at = 0, gain = 0.5): Tone[] => {
  const rumble = (start: number, duration: number, rate: number, level: number): Tone[] => [
    {
      wave: 'noise',
      freq: 0,
      at: start,
      duration,
      gain: level,
      attack: 0.08,
      formants: [{ path: [220, 260, 230], q: 0.9, gain: 6 }],
      pulse: { rate, depth: 0.95 },
    },
    {
      wave: 'sawtooth',
      freq: rate * 2,
      at: start,
      duration,
      gain: level * 0.5,
      attack: 0.08,
      formants: [{ path: [180], q: 0.7, gain: 4 }],
      pulse: { rate, depth: 0.9 },
    },
  ];
  // Faster with a higher voice, within a cat's 22–30 Hz.
  const rate = Math.min(Math.max(26 * Math.sqrt(f0 / 600), 22), 30);
  return [...rumble(at, 0.45, rate * 0.92, gain * 0.8), ...rumble(at + 0.5, 0.6, rate, gain)];
};

/** The chattering a cat makes at a bird it cannot reach: quick clicks and squeaks. */
const chatter = (f0: number, at = 0, count = 6, gain = 0.5): Tone[] =>
  Array.from({ length: count }, (_, i) => {
    const start = at + i * 0.075;
    return [
      {
        wave: 'noise' as const,
        freq: 0,
        at: start,
        duration: 0.03,
        gain,
        attack: 0.003,
        formants: [{ path: [2200], q: 3, gain: 4 }],
      },
      ...call(f0 * (1.4 + (i % 2) * 0.2), start + 0.02, 0.05, gain * 0.6, {
        shape: [1, 1.1],
        vowels: 'ei',
        breath: 0,
      }),
    ];
  }).flat();

/** A wide yawn, ending in a contented "mm". */
const yawn = (f0: number, at = 0, gain = 0.45) =>
  call(f0 * 0.8, at, 0.75, gain, {
    shape: [1.15, 1.3, 1.0, 0.75, 0.6],
    vowels: 'iaaom',
    vibrato: { rate: 4, depth: 15 },
    breath: 0.45,
  });

/** The sound moved later by `by` seconds. */
const later = (sound: Sound, by: number): Tone[] => sound.map((t) => ({ ...t, at: t.at + by }));

/** The sound quieter by `factor`. */
const softer = (sound: Sound, factor: number): Tone[] =>
  sound.map((t) => ({ ...t, gain: t.gain * factor }));

/**
 * The sound louder (or quieter) by `factor`. A tone's gain stays at most 1; what
 * it cannot carry, its formants do.
 */
const loud = (sound: Sound, factor: number): Tone[] =>
  sound.map((t) => {
    const gain = t.gain * factor;
    if (gain <= 1 || !t.formants) return { ...t, gain: Math.min(gain, 1) };
    return { ...t, gain: 1, formants: t.formants.map((f) => ({ ...f, gain: f.gain * gain })) };
  });

/**
 * Each sound's level against the others, measured: every sound was rendered (with
 * Web Audio, offline) and set to about the same loudness. A thin, high voice
 * passes little through the formants, so a mew needs far more than a yowl.
 */
const BALANCE: Readonly<Record<string, number>> = {
  vanish: 1.3,
  heavy: 0.7,
  knockback: 1.05,
  reverse: 0.8,
  jitter: 1.45,
  freeze: 1.35,
  drift: 1.25,
  teleport: 2.4,
  magnet: 1.5,
  orbit: 2.7,
  decoys: 1,
  drunk: 0.75,
  tiny: 4,
  giant: 0.9,
  delay: 1.85,
  fall: 1.7,
  blur: 0.9,
  spiral: 1.4,
  bounce: 3.7,
  'axis-lock': 2.1,
  wake: 0.62,
  arrive: 2.9,
  purr: 1.6,
};

// ------------------------------------------------------------- the cats' sounds

/** The pitch an attack is called at before the cat's own pitch is applied, Hz. */
const VOICE = 600;

/** Each attack's sound, keyed by effect id: a cat's call with an alien twist. */
const ATTACK_CALLS: Readonly<Record<string, Sound>> = {
  // A meow that dissolves into air: the cursor is gone.
  vanish: [...meow(VOICE, 0, 0.45), ...later(hiss(0, 0.5, 0.25), 0.35)],
  // A deep, slow, heavy yowl.
  heavy: [...yowl(VOICE * 0.55, 0, 1.2, 0.6, [1, 0.95, 0.9, 0.85, 0.75, 0.7])],
  // A spitting hiss, then a startled mew.
  knockback: [...hiss(0, 0.25, 0.6), ...mew(VOICE, 0.22)],
  // A meow said backwards: "woam".
  reverse: call(VOICE, 0, 0.6, 0.6, {
    shape: [0.75, 1.05, 1.2, 1.1, 0.85],
    vowels: 'uoaem',
    vibrato: { rate: 6, depth: 20 },
  }),
  // Chattering at the cursor.
  jitter: chatter(VOICE, 0, 7),
  // A cold hiss with a thin, shivering mew.
  freeze: [
    ...hiss(0, 0.5, 0.35),
    ...call(VOICE * 1.8, 0.1, 0.45, 0.35, {
      shape: [1, 1.05, 1],
      vowels: 'iie',
      vibrato: { rate: 14, depth: 60 },
      breath: 0.05,
    }),
  ],
  // A long meow that wanders off.
  drift: meow(VOICE * 0.9, 0, 1.0, 0.55, { vibrato: { rate: 2, depth: 90 } }),
  // Three mews from three places at once.
  teleport: [...mew(VOICE * 0.9, 0), ...mew(VOICE * 1.2, 0.14), ...mew(VOICE * 0.75, 0.28)],
  // A growl that rises into a meow: come here.
  magnet: [...growl(VOICE, 0, 0.5, 0.5), ...meow(VOICE, 0.4, 0.5, 0.5)],
  // Trills going round and round.
  orbit: [...trill(VOICE, 0, 0.25), ...trill(VOICE, 0.27, 0.25, 0.5, false), ...trill(VOICE, 0.54)],
  // Three cats meowing together, each a different pitch.
  decoys: [
    ...meow(VOICE * 0.8, 0, 0.6, 0.35),
    ...meow(VOICE, 0.06, 0.6, 0.35),
    ...meow(VOICE * 1.26, 0.12, 0.6, 0.35),
  ],
  // A slurred, swaying meow.
  drunk: meow(VOICE * 0.85, 0, 0.9, 0.55, {
    shape: [0.8, 1.1, 0.9, 1.15, 0.7],
    vowels: 'meaoau',
    vibrato: { rate: 2.5, depth: 120 },
    breath: 0.25,
  }),
  // A tiny kitten's squeak.
  tiny: call(VOICE * 2.6, 0, 0.16, 0.4, { shape: [1, 1.2, 1.1], vowels: 'iie', breath: 0.03 }),
  // A giant's yowl, over a growl.
  giant: [...yowl(VOICE * 0.45, 0, 1.2, 0.55), ...growl(VOICE * 0.8, 0, 1.0, 0.45)],
  // A meow and its late echoes.
  delay: [
    ...meow(VOICE, 0, 0.45, 0.55),
    ...later(softer(meow(VOICE, 0, 0.45, 0.55), 0.45), 0.35),
    ...later(softer(meow(VOICE, 0, 0.45, 0.55), 0.2), 0.7),
  ],
  // A yowl falling away.
  fall: yowl(VOICE, 0, 1.0, 0.55, [1.4, 1.3, 1.1, 0.9, 0.7, 0.5]),
  // A breathy, smoky meow.
  blur: meow(VOICE * 0.9, 0, 0.7, 0.4, { breath: 0.8 }),
  // A trill spiralling up.
  spiral: call(VOICE, 0, 0.9, 0.5, {
    shape: [0.7, 0.85, 1.0, 1.2, 1.45, 1.7],
    vowels: 'meaei',
    pulse: { rate: 18, depth: 0.7 },
  }),
  // Brrp, brrp, brrp: chirrups bouncing.
  bounce: [
    ...trill(VOICE * 1.1, 0, 0.16),
    ...trill(VOICE * 0.9, 0.18, 0.16, 0.5, false),
    ...trill(VOICE * 1.2, 0.36, 0.16),
  ],
  // Chattering clicks, then a sharp mew: locked on.
  'axis-lock': [...chatter(VOICE * 1.2, 0, 4), ...mew(VOICE * 1.1, 0.32)],
};

/** Each attack's sound, keyed by effect id, at a level with the rest. */
export const ATTACK_SOUNDS: Readonly<Record<string, Sound>> = Object.fromEntries(
  Object.entries(ATTACK_CALLS).map(([id, sound]) => [id, loud(sound, BALANCE[id] ?? 1)])
);

/** A plain meow for an attack ATTACK_SOUNDS does not know. */
const FALLBACK_ATTACK: Sound = meow(VOICE);

/** Every cat sounds a little different: up to half an octave either side. */
export const pitchFor = (type: CatType) => 2 ** ((type.number - 10.5) / 19);

/** A smaller cat has a higher voice and a smaller mouth: formants move a little. */
const transpose = (sound: Sound, factor: number): Sound =>
  sound.map((t) => ({
    ...t,
    freq: t.freq * factor,
    ...(t.endFreq ? { endFreq: t.endFreq * factor } : {}),
    ...(t.contour ? { contour: t.contour.map((f) => f * factor) } : {}),
    ...(t.formants
      ? {
          formants: t.formants.map((f) => ({
            ...f,
            path: f.path.map((hz) => hz * factor ** 0.35),
          })),
        }
      : {}),
  }));

export type CatSounds = { attack: Sound; wake: Sound; arrive: Sound; purr: Sound };

/** A cat type's sounds. */
export function soundsFor(type: CatType): CatSounds {
  const pitch = pitchFor(type);
  return {
    attack: ATTACK_SOUNDS[type.effect.id] ?? FALLBACK_ATTACK,
    // A yawn and a stretch.
    wake: transpose(loud(yawn(VOICE), BALANCE.wake), pitch),
    // "Brrp?": a chirrup of greeting.
    arrive: transpose(loud(trill(VOICE, 0, 0.28, 0.45), BALANCE.arrive), pitch),
    purr: transpose(loud(purr(VOICE * pitch), BALANCE.purr), pitch),
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
  | 'createBiquadFilter'
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
          const begin = start + t.at;
          const end = begin + t.duration;
          // The envelope: swell in, then die away by the end.
          const envelope = ctx.createGain();
          const peak = Math.max(t.gain * 0.25, 0.0002);
          envelope.gain.setValueAtTime(0.0001, begin);
          envelope.gain.exponentialRampToValueAtTime(peak, begin + (t.attack ?? 0.01));
          envelope.gain.exponentialRampToValueAtTime(0.0001, end);
          envelope.connect(ctx.destination);
          const stops: AudioScheduledSourceNode[] = [];

          // The source: breath, or a voice with its pitch path and vibrato.
          let source: AudioNode;
          if (t.wave === 'noise') {
            noise ??= whiteNoise(ctx);
            const breath = ctx.createBufferSource();
            breath.buffer = noise;
            breath.loop = true;
            source = breath;
            stops.push(breath);
          } else {
            const osc = ctx.createOscillator();
            osc.type = t.wave;
            if (t.contour && t.contour.length > 1) {
              osc.frequency.setValueCurveAtTime(Float32Array.from(t.contour), begin, t.duration);
            } else {
              osc.frequency.setValueAtTime(t.freq, begin);
              if (t.endFreq) osc.frequency.exponentialRampToValueAtTime(t.endFreq, end);
            }
            if (t.vibrato) {
              const wobble = ctx.createOscillator();
              wobble.frequency.setValueAtTime(t.vibrato.rate, begin);
              const depth = ctx.createGain();
              depth.gain.setValueAtTime(t.vibrato.depth, begin);
              wobble.connect(depth);
              depth.connect(osc.detune);
              stops.push(wobble);
            }
            source = osc;
            stops.push(osc);
          }

          // Pulses: the volume rolls between full and 1 - depth.
          if (t.pulse) {
            const rolled = ctx.createGain();
            rolled.gain.setValueAtTime(1 - t.pulse.depth / 2, begin);
            const lfo = ctx.createOscillator();
            lfo.frequency.setValueAtTime(t.pulse.rate, begin);
            const amount = ctx.createGain();
            amount.gain.setValueAtTime(t.pulse.depth / 2, begin);
            lfo.connect(amount);
            amount.connect(rolled.gain);
            source.connect(rolled);
            source = rolled;
            stops.push(lfo);
          }

          // The mouth: each formant a band-pass filter, moving along its path.
          if (t.formants && t.formants.length > 0) {
            for (const formant of t.formants) {
              const band = ctx.createBiquadFilter();
              band.type = 'bandpass';
              band.Q.setValueAtTime(formant.q, begin);
              if (formant.path.length > 1) {
                band.frequency.setValueCurveAtTime(
                  Float32Array.from(formant.path),
                  begin,
                  t.duration
                );
              } else {
                band.frequency.setValueAtTime(formant.path[0], begin);
              }
              const level = ctx.createGain();
              level.gain.setValueAtTime(formant.gain, begin);
              source.connect(band);
              band.connect(level);
              level.connect(envelope);
            }
          } else {
            source.connect(envelope);
          }

          for (const node of stops) {
            node.start(begin);
            node.stop(end);
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
