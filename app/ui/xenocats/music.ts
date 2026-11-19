// Survival's music: five tunes in the style of an old games console, synthesised
// with Web Audio like the cats' sounds (sounds.ts), no audio files. Each is played
// the way that console's sound chip would: a pulse-wave lead, a second pulse wave
// for harmony, a triangle-wave bass and noise for the drums.
//
// A tune is written as text, one token a sixteenth note: `E5` a note, `E5:4` one
// held four sixteenths, `.` (or `.:4`) a rest. The harmony and the bass are written
// over a chord a bar (or two, `F G`, half a bar each): a digit is a tone of the
// chord (0 its root, 1 the next, ... wrapping an octave up), and for the bass `r`
// is the root, `t` the third, `f` the fifth, `s` the seventh and `o` the root an
// octave up. The drums: `k` kick, `s` snare, `h` hat, `o` open hat.
//
// The player schedules a little ahead on the audio clock (a timer wakes it every
// 25 ms), so the tempo holds whatever the frame rate.

// ------------------------------------------------------------------ the notation

const NOTE_NAMES: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** A note's name (`A4`, `C#5`, `Bb3`) as a MIDI number (A4 is 69). */
export function noteToMidi(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`not a note: ${name}`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + NOTE_NAMES[match[1]] + accidental;
}

/** A MIDI note's frequency, Hz. */
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

const CHORD_SHAPES: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
};

type Chord = { root: number; tones: readonly number[] };

/** A chord's name (`C`, `Am`, `G7`, `Fmaj7`, `Bb`) as its root (0–11) and intervals. */
export function parseChord(name: string): Chord {
  const match = /^([A-G])([#b]?)(.*)$/.exec(name);
  const tones = match ? CHORD_SHAPES[match[3]] : undefined;
  if (!match || !tones) throw new Error(`not a chord: ${name}`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return { root: (NOTE_NAMES[match[1]] + accidental + 12) % 12, tones };
}

/** Tokens, each with how many sixteenths it lasts (`X:4` four, `X` one). */
function tokens(text: string): { value: string; steps: number }[] {
  return text
    .split(/[\s|]+/)
    .filter(Boolean)
    .map((token) => {
      const [value, steps = '1'] = token.split(':');
      const n = Number(steps);
      if (!Number.isInteger(n) || n < 1) throw new Error(`not a length: ${token}`);
      return { value, steps: n };
    });
}

/** A note played on one of the voices: from `step`, for `steps` sixteenths. */
export type Note = { step: number; steps: number; midi: number };

/** A written melody (`E5:2 G5:2 .:4 …`) as notes. */
function melody(text: string): { notes: Note[]; steps: number } {
  const notes: Note[] = [];
  let step = 0;
  for (const t of tokens(text)) {
    if (t.value !== '.') notes.push({ step, steps: t.steps, midi: noteToMidi(t.value) });
    step += t.steps;
  }
  return { notes, steps: step };
}

/** The chord sounding at each sixteenth of `bars` (`'Am'`, `'F G'`, …). */
function chordAt(bars: readonly string[], step: number): Chord {
  const names = bars[Math.floor(step / 16) % bars.length].split(' ');
  return parseChord(names[Math.floor(((step % 16) * names.length) / 16)]);
}

/**
 * A one-bar pattern played over every bar's chord: each token a tone of the chord
 * (`pick` turns it into a MIDI note, or null for a rest), from `octave`.
 */
function overChords(
  bars: readonly string[],
  pattern: string,
  octave: number,
  pick: (value: string, chord: Chord) => number | null
): { notes: Note[]; steps: number } {
  const bar = tokens(pattern);
  const length = bar.reduce((sum, t) => sum + t.steps, 0);
  if (length !== 16) throw new Error(`a bar of ${length} sixteenths: ${pattern}`);
  const notes: Note[] = [];
  for (let b = 0; b < bars.length; b++) {
    let step = b * 16;
    for (const t of bar) {
      const chord = chordAt(bars, step);
      const tone = t.value === '.' ? null : pick(t.value, chord);
      if (tone !== null) notes.push({ step, steps: t.steps, midi: 12 * (octave + 1) + tone });
      step += t.steps;
    }
  }
  return { notes, steps: bars.length * 16 };
}

/** An arpeggio: digit k is the chord's k-th tone, wrapping an octave up. */
const arpeggio = (bars: readonly string[], pattern: string, octave: number) =>
  overChords(bars, pattern, octave, (value, chord) => {
    const k = Number(value);
    if (!Number.isInteger(k)) throw new Error(`not a chord tone: ${value}`);
    const { tones, root } = chord;
    return root + tones[k % tones.length] + 12 * Math.floor(k / tones.length);
  });

/** A bass line: r root, t third, f fifth, s seventh, o the root an octave up. */
const bassLine = (bars: readonly string[], pattern: string, octave: number) =>
  overChords(bars, pattern, octave, (value, { root, tones }) => {
    const interval = { r: 0, t: tones[1], f: tones[2], s: tones[3] ?? 10, o: 12 }[value];
    if (interval === undefined) throw new Error(`not a bass tone: ${value}`);
    return root + interval;
  });

export type Drum = 'k' | 's' | 'h' | 'o';
export type Hit = { step: number; drum: Drum };

/** A one-bar drum pattern, played every bar. */
function drumLine(pattern: string, bars: number): { hits: Hit[]; steps: number } {
  const bar = tokens(pattern);
  const length = bar.reduce((sum, t) => sum + t.steps, 0);
  if (length !== 16) throw new Error(`a bar of ${length} sixteenths: ${pattern}`);
  const hits: Hit[] = [];
  for (let b = 0; b < bars; b++) {
    let step = b * 16;
    for (const t of bar) {
      if (t.value !== '.') {
        if (!['k', 's', 'h', 'o'].includes(t.value)) throw new Error(`not a drum: ${t.value}`);
        hits.push({ step, drum: t.value as Drum });
      }
      step += t.steps;
    }
  }
  return { hits, steps: bars * 16 };
}

// -------------------------------------------------------------------- the tunes

export type TrackId = 'overworld' | 'catacombs' | 'showdown' | 'lounge' | 'hyperspace';

/** A tune, written out: what the player plays, voice by voice, in a loop. */
export type Track = {
  id: TrackId;
  name: string;
  /** What kind of old game music it is, for the settings. */
  kind: string;
  /** Quarter notes a minute. */
  bpm: number;
  /** How far the off-beat eighths are pushed late, 0 (straight) to ~0.33 (swung). */
  swing: number;
  /** The pulse waves' duty cycles: thinner is brighter and nasal. */
  leadDuty: number;
  harmonyDuty: number;
  /** Sixteenths before it loops. */
  steps: number;
  lead: readonly Note[];
  harmony: readonly Note[];
  bass: readonly Note[];
  drums: readonly Hit[];
};

type Written = {
  id: TrackId;
  name: string;
  kind: string;
  bpm: number;
  swing?: number;
  leadDuty: number;
  harmonyDuty: number;
  chords: readonly string[];
  lead: string;
  harmony: { pattern: string; octave: number };
  bass: { pattern: string; octave: number };
  drums: string;
};

/** A written tune as notes; every voice must last the same number of bars. */
function compile(w: Written): Track {
  const lead = melody(w.lead);
  const harmony = arpeggio(w.chords, w.harmony.pattern, w.harmony.octave);
  const bass = bassLine(w.chords, w.bass.pattern, w.bass.octave);
  const drums = drumLine(w.drums, w.chords.length);
  for (const [voice, part] of [
    ['lead', lead],
    ['harmony', harmony],
    ['bass', bass],
    ['drums', drums],
  ] as const) {
    if (part.steps !== w.chords.length * 16) {
      throw new Error(
        `${w.id}: the ${voice} lasts ${part.steps} sixteenths, not ${w.chords.length * 16}`
      );
    }
  }
  return {
    id: w.id,
    name: w.name,
    kind: w.kind,
    bpm: w.bpm,
    swing: w.swing ?? 0,
    leadDuty: w.leadDuty,
    harmonyDuty: w.harmonyDuty,
    steps: w.chords.length * 16,
    lead: lead.notes,
    harmony: harmony.notes,
    bass: bass.notes,
    drums: drums.hits,
  };
}

const WRITTEN: readonly Written[] = [
  {
    // A bright adventure across the stars, in C major.
    id: 'overworld',
    name: 'Starlit Overworld',
    kind: 'Adventure',
    bpm: 144,
    leadDuty: 0.25,
    harmonyDuty: 0.125,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F G', 'C'],
    lead: `
      E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 |
      D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 |
      C5:2 E5:2 A5:4 G5:2 E5:2 C5:2 E5:2 |
      F5:3 E5:1 F5:2 A5:2 G5:4 .:4 |
      E5:2 G5:2 C6:4 D6:2 E6:2 D6:2 C6:2 |
      B5:2 D6:2 G5:4 A5:2 B5:2 A5:2 G5:2 |
      A5:2 C6:2 F5:2 A5:2 B5:2 D6:2 G5:2 B5:2 |
      C6:6 G5:2 E5:2 G5:2 C6:4`,
    harmony: { pattern: '0 . 1 . 2 . 1 . 0 . 1 . 2 . 1 .', octave: 4 },
    bass: { pattern: 'r:2 . o:2 . f:2 . o:2 . r:2 f:2', octave: 2 },
    drums: 'k . h . s . h . k . k h s . h h',
  },
  {
    // Down in the catacombs, in A minor: a slow crawl over a rolling arpeggio.
    id: 'catacombs',
    name: 'Catacombs',
    kind: 'Dungeon',
    bpm: 112,
    leadDuty: 0.5,
    harmonyDuty: 0.25,
    chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E'],
    lead: `
      A5:6 G5:2 E5:4 C5:4 |
      F5:6 E5:2 C5:4 A4:4 |
      D5:4 F5:4 A5:4 G5:2 F5:2 |
      E5:8 G#5:4 B5:4 |
      C6:4 B5:2 A5:2 E5:4 A5:4 |
      A5:4 G5:2 F5:2 C5:8 |
      D5:2 E5:2 F5:4 E5:2 D5:2 C5:4 |
      B4:8 .:8`,
    harmony: { pattern: '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 1', octave: 4 },
    bass: { pattern: 'r:3 . r:2 . . r:2 f:2 . t:2 .', octave: 2 },
    drums: 'k . . . h . . . s . . . h . . k',
  },
  {
    // The mothership's boss fight, in E minor: fast, driving, a chromatic menace.
    id: 'showdown',
    name: 'Mothership Showdown',
    kind: 'Boss battle',
    bpm: 168,
    leadDuty: 0.25,
    harmonyDuty: 0.5,
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'],
    lead: `
      E5:2 .:1 E5:1 G5:2 .:1 E5:1 A5:2 G5:2 F#5:2 D5:2 |
      E5:2 .:1 E5:1 G5:2 .:1 E5:1 B5:4 A#5:2 A5:2 |
      G5:2 E5:2 C5:2 E5:2 G5:2 C6:2 B5:2 G5:2 |
      A5:2 F#5:2 D5:2 F#5:2 A5:2 D6:2 C6:2 A5:2 |
      E6:4 D6:2 B5:2 G5:4 E5:4 |
      F#5:2 G5:2 A5:2 B5:2 C6:2 B5:2 A5:2 G5:2 |
      E5:4 G5:4 C6:4 E6:4 |
      D#6:8 B5:4 F#5:4`,
    harmony: { pattern: '0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3', octave: 3 },
    bass: { pattern: 'r:2 o:2 r:2 o:2 r:2 o:2 r:2 o:2', octave: 2 },
    drums: 'k . h k s . h . k k h . s . h s',
  },
  {
    // A late-night lounge on the moon, in F major: swung, soft, sevenths.
    id: 'lounge',
    name: 'Moonbeam Lounge',
    kind: 'Chill',
    bpm: 96,
    swing: 0.3,
    leadDuty: 0.5,
    harmonyDuty: 0.125,
    chords: ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7', 'Am7', 'Gm7 C7', 'Fmaj7'],
    lead: `
      A5:6 G5:2 E5:4 C5:4 |
      F5:4 E5:2 D5:2 A4:8 |
      Bb4:2 D5:2 F5:4 A5:2 G5:2 F5:4 |
      E5:8 .:4 G5:2 Bb5:2 |
      A5:4 C6:4 E6:4 C6:4 |
      G5:6 E5:2 C5:4 E5:4 |
      D5:4 F5:4 E5:4 G5:4 |
      F5:12 .:4`,
    harmony: { pattern: '0:2 1:2 2:2 3:2 2:2 1:2 0:2 1:2', octave: 4 },
    bass: { pattern: 'r:4 t:4 f:4 s:4', octave: 2 },
    drums: 'k . h . s . h h k . h . s . h .',
  },
  {
    // A race through hyperspace, in D minor: the bass pumping octaves, never still.
    id: 'hyperspace',
    name: 'Hyperspace Dash',
    kind: 'Racing',
    bpm: 176,
    leadDuty: 0.125,
    harmonyDuty: 0.25,
    chords: ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A'],
    lead: `
      D5:1 F5:1 A5:2 D6:2 C6:2 A5:2 F5:2 A5:2 C6:2 |
      Bb5:4 A5:2 F5:2 D5:4 F5:4 |
      E5:2 G5:2 C6:2 E6:2 D6:2 C6:2 G5:4 |
      A5:6 F5:2 D5:8 |
      D6:2 C6:2 A5:2 F5:2 G5:2 A5:2 C6:2 D6:2 |
      F6:4 D6:4 Bb5:4 F5:4 |
      G5:2 A5:2 Bb5:2 C6:2 D6:2 E6:2 F6:2 G6:2 |
      E6:8 C#6:4 A5:4`,
    harmony: { pattern: '0:2 2:2 1:2 2:2 0:2 2:2 1:2 2:2', octave: 4 },
    bass: { pattern: 'r . o r . r o . r . o r . r o .', octave: 2 },
    drums: 'k . h . k . h s k . h . k s h .',
  },
];

/** The five tunes, in the order the settings list them. */
export const TRACKS: readonly Track[] = WRITTEN.map(compile);

export const TRACK_IDS: readonly TrackId[] = TRACKS.map((t) => t.id);

export const trackById = (id: TrackId): Track => TRACKS.find((t) => t.id === id) ?? TRACKS[0];

/** A tune for a run on shuffle: any but the one played last, when there is one. */
export function pickTrack(random: () => number, last: TrackId | null): TrackId {
  const choices = TRACK_IDS.filter((id) => id !== last);
  return choices[Math.min(Math.floor(random() * choices.length), choices.length - 1)];
}

// ------------------------------------------------------------------- the player

/** What the music needs of an AudioContext (a test passes a stand-in). */
export type MusicContext = Pick<
  AudioContext,
  | 'currentTime'
  | 'sampleRate'
  | 'destination'
  | 'createOscillator'
  | 'createGain'
  | 'createBiquadFilter'
  | 'createBuffer'
  | 'createBufferSource'
  | 'createPeriodicWave'
>;

/** The music's loudness against the cats' sounds (whose loudest peak is about 0.25). */
const VOLUME = 0.11;
/** Each voice's share of it. */
const LEVELS = { lead: 0.55, harmony: 0.3, bass: 0.75, drums: 0.6 } as const;
/** How far ahead the player schedules, seconds, and how often it wakes, ms. */
const LOOKAHEAD = 0.12;
const WAKE_MS = 25;
/** Fades, seconds: in at the start, out when stopped or paused. */
const FADE_IN = 0.4;
const FADE_OUT = 0.25;

export type MusicPlayer = ReturnType<typeof createMusicPlayer>;

/**
 * Plays the tunes in a loop. `context` gives the AudioContext to play on, or null
 * when there is none to play on (sound off, no gesture yet, no Web Audio): playing
 * then does nothing and says so. Never throws.
 */
export function createMusicPlayer(
  context: () => MusicContext | null,
  timers: {
    setInterval: (fn: () => void, ms: number) => unknown;
    clearInterval: (id: unknown) => void;
    setTimeout: (fn: () => void, ms: number) => unknown;
  } = {
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  }
) {
  let ctx: MusicContext | null = null;
  let track: Track | null = null;
  let master: GainNode | null = null;
  let timer: unknown = null;
  /** The next sixteenth to schedule, and when on the audio clock. */
  let step = 0;
  let nextAt = 0;
  // Made once per context, when first needed.
  let made: MusicContext | null = null;
  let noise: AudioBuffer | null = null;
  const pulses = new Map<number, PeriodicWave>();
  // Which notes start at which sixteenth, per tune (worked out once).
  const starts = new Map<TrackId, { voice: Voice; note: Note }[][]>();
  const hitsAt = new Map<TrackId, Hit[][]>();

  type Voice = 'lead' | 'harmony' | 'bass';

  function startsOf(t: Track) {
    let at = starts.get(t.id);
    if (!at) {
      at = Array.from({ length: t.steps }, () => []);
      for (const voice of ['lead', 'harmony', 'bass'] as const) {
        for (const note of t[voice]) at[note.step].push({ voice, note });
      }
      starts.set(t.id, at);
      const hits: Hit[][] = Array.from({ length: t.steps }, () => []);
      for (const hit of t.drums) hits[hit.step].push(hit);
      hitsAt.set(t.id, hits);
    }
    return { notes: at, hits: hitsAt.get(t.id)! };
  }

  function fresh(c: MusicContext) {
    if (made === c) return;
    made = c;
    noise = null;
    pulses.clear();
  }

  /** A pulse wave of duty `duty`: what the console's square channels play. */
  function pulse(c: MusicContext, duty: number): PeriodicWave {
    let wave = pulses.get(duty);
    if (!wave) {
      const real = new Float32Array(32);
      const imag = new Float32Array(32);
      for (let n = 1; n < 32; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      wave = c.createPeriodicWave(real, imag);
      pulses.set(duty, wave);
    }
    return wave;
  }

  function whiteNoise(c: MusicContext): AudioBuffer {
    if (noise) return noise;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise = buffer;
    return buffer;
  }

  const secondsPerStep = (t: Track) => 60 / t.bpm / 4;

  /** A note on a voice: a short attack, a slight decay, let go just before its end. */
  function playNote(
    c: MusicContext,
    out: AudioNode,
    t: Track,
    voice: Voice,
    note: Note,
    at: number
  ) {
    const length = note.steps * secondsPerStep(t);
    const end = at + length * (voice === 'bass' ? 0.95 : 0.88);
    const osc = c.createOscillator();
    if (voice === 'bass') osc.type = 'triangle';
    else osc.setPeriodicWave(pulse(c, voice === 'lead' ? t.leadDuty : t.harmonyDuty));
    osc.frequency.setValueAtTime(midiToHz(note.midi), at);
    const level = LEVELS[voice];
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.005);
    gain.gain.linearRampToValueAtTime(level * 0.7, at + Math.min(0.08, length / 2));
    gain.gain.setValueAtTime(level * 0.7, Math.max(at + 0.01, end - 0.02));
    gain.gain.linearRampToValueAtTime(0, end);
    // A held lead note gets a little vibrato, as the old composers wrote by hand.
    if (voice === 'lead' && length >= 0.4) {
      const wobble = c.createOscillator();
      wobble.frequency.setValueAtTime(5.5, at);
      const depth = c.createGain();
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(18, at + length * 0.6);
      wobble.connect(depth);
      depth.connect(osc.detune);
      wobble.start(at);
      wobble.stop(end);
    }
    osc.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(end + 0.01);
  }

  function playDrum(c: MusicContext, out: AudioNode, drum: Drum, at: number) {
    const level = LEVELS.drums;
    if (drum === 'k') {
      // A kick: a sine dropping fast in pitch.
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, at);
      osc.frequency.exponentialRampToValueAtTime(40, at + 0.12);
      const gain = c.createGain();
      gain.gain.setValueAtTime(level * 1.4, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
      osc.connect(gain);
      gain.connect(out);
      osc.start(at);
      osc.stop(at + 0.16);
      return;
    }
    // The rest are noise, filtered and cut short.
    const length = drum === 's' ? 0.14 : drum === 'o' ? 0.18 : 0.04;
    const source = c.createBufferSource();
    source.buffer = whiteNoise(c);
    source.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = drum === 's' ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(drum === 's' ? 1800 : 7000, at);
    const gain = c.createGain();
    gain.gain.setValueAtTime(drum === 's' ? level : level * 0.45, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(at, Math.random() * 0.4);
    source.stop(at + length + 0.01);
  }

  /** Schedules every sixteenth that starts before the lookahead runs out. */
  function wake() {
    if (!ctx || !track || !master) return;
    try {
      // Fallen behind (a hidden tab's timer slows to once a second): skip what
      // was missed rather than play it all at once.
      if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
      const { notes, hits } = startsOf(track);
      const each = secondsPerStep(track);
      while (nextAt < ctx.currentTime + LOOKAHEAD) {
        // Swing: the off-beat eighths (the third sixteenth of each beat) come late.
        const at = step % 4 === 2 ? nextAt + track.swing * each : nextAt;
        for (const { voice, note } of notes[step]) playNote(ctx, master, track, voice, note, at);
        for (const hit of hits[step]) playDrum(ctx, master, hit.drum, at);
        step = (step + 1) % track.steps;
        nextAt += each;
      }
    } catch {
      // A context that refuses (closed, say): the music goes quiet, nothing breaks.
      halt();
    }
  }

  /** Fades the master out and lets it go; the timer stops. */
  function halt() {
    if (timer !== null) timers.clearInterval(timer);
    timer = null;
    const old = master;
    master = null;
    if (old && ctx) {
      try {
        const now = ctx.currentTime;
        old.gain.setValueAtTime(old.gain.value, now);
        old.gain.linearRampToValueAtTime(0, now + FADE_OUT);
        timers.setTimeout(() => old.disconnect(), (FADE_OUT + LOOKAHEAD) * 1000 + 50);
      } catch {
        // Already gone.
      }
    }
  }

  return {
    /**
     * Plays tune `id` from where it was paused (or its start, for a tune not playing
     * before); true if it plays. Asked for the tune already playing, it goes on.
     */
    play(id: TrackId): boolean {
      if (track?.id === id && timer !== null) return true;
      const c = context();
      if (!c) return false;
      const same = track?.id === id && ctx === c;
      halt();
      try {
        fresh(c);
        ctx = c;
        if (!same) step = 0;
        track = trackById(id);
        const gain = c.createGain();
        gain.gain.setValueAtTime(0, c.currentTime);
        gain.gain.linearRampToValueAtTime(VOLUME, c.currentTime + FADE_IN);
        gain.connect(c.destination);
        master = gain;
        nextAt = c.currentTime + 0.05;
        timer = timers.setInterval(wake, WAKE_MS);
        wake();
        return true;
      } catch {
        halt();
        return false;
      }
    },

    /** Fades out, remembering where the tune was: `play` of the same tune goes on from there. */
    pause() {
      halt();
    },

    /** Fades out; the next `play` starts its tune from the beginning. */
    stop() {
      halt();
      track = null;
      step = 0;
    },

    /** The tune playing, or null. */
    playing: (): TrackId | null => (timer !== null && track ? track.id : null),
  };
}

let shared: MusicPlayer | null = null;

/** The page's one music player, on the sound player's context (sounds.ts). */
export function sharedMusicPlayer(context: () => MusicContext | null): MusicPlayer {
  shared ??= createMusicPlayer(context);
  return shared;
}
