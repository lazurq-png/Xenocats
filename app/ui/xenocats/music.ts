// Survival's music, in the style of an old games console, synthesised with Web
// Audio like the cats' sounds (sounds.ts), no audio files. Each tune is played the
// way that console's sound chip would: a pulse-wave lead, a second pulse wave for
// harmony, a triangle-wave bass and noise for the drums.
//
// There is music for each part of the game, a scene: lounge music in the menus,
// upbeat music for a run, and boss music while a boss is on the field. A scene plays
// its tunes in a random order, a few times round each. Paused, the music goes on
// quieter, slower and muffled; a boss sent home ends its music with the sound of the
// mothership beaming it up.
//
// A tune is written as text, one token a sixteenth note: `E5` a note, `E5:4` one
// held four sixteenths, `.` (or `.:4`) a rest. The harmony and the bass are written
// over a chord a bar (or two, `F G`, half a bar each): a digit is a tone of the
// chord (0 its root, 1 the next, ... wrapping an octave up), and for the bass `r`
// is the root, `t` the third, `f` the fifth, `s` the seventh and `o` the root an
// octave up. The drums: `k` kick, `s` snare, `h` hat, `o` open hat, a bar played
// every bar (and a fill, if written, in the last).
//
// The player schedules a little ahead on the audio clock (a timer wakes it every
// 25 ms), so the tempo holds whatever the frame rate.

import { sharedSoundPlayer } from './sounds';

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

/** A one-bar pattern's tokens, which must fill the bar exactly. */
function bar(pattern: string) {
  const parts = tokens(pattern);
  const length = parts.reduce((sum, t) => sum + t.steps, 0);
  if (length !== 16) throw new Error(`a bar of ${length} sixteenths: ${pattern}`);
  return parts;
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
  const parts = bar(pattern);
  const notes: Note[] = [];
  for (let b = 0; b < bars.length; b++) {
    let step = b * 16;
    for (const t of parts) {
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

/** A one-bar drum pattern, played every bar; `fill`, if given, in the last instead. */
function drumLine(pattern: string, bars: number, fill?: string): { hits: Hit[]; steps: number } {
  const every = bar(pattern);
  const last = fill ? bar(fill) : every;
  const hits: Hit[] = [];
  for (let b = 0; b < bars; b++) {
    let step = b * 16;
    for (const t of b === bars - 1 ? last : every) {
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

/** The part of the game a tune is for. */
export type Scene = 'menu' | 'combat' | 'boss';

export const SCENES: readonly Scene[] = ['menu', 'combat', 'boss'];

/** A tune, written out: what the player plays, voice by voice, in a loop. */
export type Track = {
  id: string;
  name: string;
  scene: Scene;
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
  id: string;
  name: string;
  scene: Scene;
  bpm: number;
  swing?: number;
  leadDuty: number;
  harmonyDuty: number;
  chords: readonly string[];
  lead: string;
  harmony: { pattern: string; octave: number };
  bass: { pattern: string; octave: number };
  drums: string;
  fill?: string;
};

/** A written tune as notes; every voice must last the same number of bars. */
function compile(w: Written): Track {
  const lead = melody(w.lead);
  const harmony = arpeggio(w.chords, w.harmony.pattern, w.harmony.octave);
  const bass = bassLine(w.chords, w.bass.pattern, w.bass.octave);
  const drums = drumLine(w.drums, w.chords.length, w.fill);
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
    scene: w.scene,
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

// ---- The menus: lounge music. Slow, seventh chords, a walking bass, mostly swung.

const MENU: readonly Written[] = [
  {
    // A late-night lounge on the moon, in F major: I–vi–ii–V, the jazz turnaround.
    id: 'moonbeam-lounge',
    name: 'Moonbeam Lounge',
    scene: 'menu',
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
    // Drifting through a nebula, in E-flat: soft stabs on the beat, brushes.
    id: 'velvet-nebula',
    name: 'Velvet Nebula',
    scene: 'menu',
    bpm: 88,
    swing: 0.33,
    leadDuty: 0.5,
    harmonyDuty: 0.125,
    chords: ['Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Ebmaj7', 'Abmaj7', 'Fm7 Bb7', 'Ebmaj7'],
    lead: `
      G5:4 Bb5:2 D6:6 C6:2 Bb5:2 |
      G5:6 Eb5:2 C5:8 |
      Ab5:4 C6:2 Eb6:4 D6:2 C6:2 Ab5:2 |
      D6:8 .:4 F5:2 Ab5:2 |
      G5:2 Bb5:2 D6:4 Eb6:4 D6:2 Bb5:2 |
      C6:6 Ab5:2 G5:4 Eb5:4 |
      F5:4 Ab5:4 D5:4 F5:4 |
      Eb5:12 .:4`,
    harmony: { pattern: '0:3 . 2:3 . 1:3 . 3:3 .', octave: 4 },
    bass: { pattern: 'r:4 t:4 f:4 t:4', octave: 2 },
    drums: 'k . h . h . h . s . h . h . h .',
  },
  {
    // A café on a space station, in G major: bossa nova, straight and syncopated.
    id: 'catnip-cafe',
    name: 'Catnip Café',
    scene: 'menu',
    bpm: 92,
    leadDuty: 0.25,
    harmonyDuty: 0.125,
    chords: ['Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'Gmaj7', 'Em7', 'Am7 D7', 'Gmaj7'],
    lead: `
      B5:3 A5:1 B5:4 D6:4 F#5:4 |
      E5:3 G5:1 C6:4 B5:4 A5:4 |
      F#5:3 A5:1 D6:6 C6:2 B5:4 |
      E6:8 D6:2 B5:2 G5:4 |
      G5:2 B5:2 D6:2 F#6:6 E6:4 |
      D6:4 B5:4 G5:4 E5:4 |
      C6:4 A5:4 F#5:4 A5:4 |
      G5:12 .:4`,
    harmony: { pattern: '. 0:2 . 2:3 . 1:2 . 3:3 . .', octave: 4 },
    bass: { pattern: 'r:3 f:1 f:4 r:3 f:1 f:4', octave: 2 },
    drums: 'k . h . h . k h k . h . h . k h',
  },
  {
    // The glow after the asteroids, in D major: slow, a dreamy arpeggio, a lazy swing.
    id: 'asteroid-afterglow',
    name: 'Asteroid Afterglow',
    scene: 'menu',
    bpm: 84,
    swing: 0.25,
    leadDuty: 0.5,
    harmonyDuty: 0.25,
    chords: ['Dmaj7', 'F#m7', 'Gmaj7', 'A7', 'Bm7', 'F#m7', 'Em7 A7', 'Dmaj7'],
    lead: `
      F#5:6 E5:2 C#5:4 A4:4 |
      A5:6 F#5:2 E5:4 C#5:4 |
      B5:4 D6:4 F#6:6 E6:2 |
      E6:8 C#6:4 G5:4 |
      D6:6 B5:2 F#5:4 A5:4 |
      C#6:6 A5:2 E5:8 |
      G5:4 B5:4 A5:4 C#6:4 |
      D6:12 .:4`,
    harmony: { pattern: '0:2 2:2 3:2 2:2 1:2 2:2 3:2 2:2', octave: 4 },
    bass: { pattern: 'r:6 f:2 o:4 f:4', octave: 2 },
    drums: 'k . . h s . . h k . k h s . . h',
  },
  {
    // A purr under the stars, in B-flat: a walking bass, stabs off the beat.
    id: 'starlight-purr',
    name: 'Starlight Purr',
    scene: 'menu',
    bpm: 100,
    swing: 0.3,
    leadDuty: 0.25,
    harmonyDuty: 0.125,
    chords: ['Bbmaj7', 'Gm7', 'Cm7', 'F7', 'Dm7', 'Gm7', 'Cm7 F7', 'Bbmaj7'],
    lead: `
      D6:4 C6:2 Bb5:2 A5:8 |
      Bb5:4 G5:2 F5:2 D5:8 |
      Eb5:2 G5:2 Bb5:4 D6:4 C6:4 |
      A5:6 Eb6:2 C6:8 |
      F5:2 A5:2 C6:4 F6:4 D6:4 |
      Bb5:6 A5:2 G5:4 F5:4 |
      Eb5:4 G5:4 A5:4 C6:4 |
      Bb5:12 .:4`,
    harmony: { pattern: '0:2 . . 2:2 . . 1:2 . 3:2 . 2:2', octave: 4 },
    bass: { pattern: 'r:4 t:4 f:4 o:4', octave: 2 },
    drums: 'k . h . s . h . k . h h s . h .',
  },
];

// ---- A run: upbeat music. Quick, bright, a driving bass and a backbeat.

const COMBAT: readonly Written[] = [
  {
    // A bright adventure across the stars, in C major: I–V–vi–IV.
    id: 'starlit-overworld',
    name: 'Starlit Overworld',
    scene: 'combat',
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
    // A race through hyperspace, in D minor: i–VI–VII, the bass pumping octaves.
    id: 'hyperspace-dash',
    name: 'Hyperspace Dash',
    scene: 'combat',
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
  {
    // On patrol round the litter trays, in G major: a march with a bouncing bass.
    id: 'litter-patrol',
    name: 'Litter Patrol',
    scene: 'combat',
    bpm: 152,
    leadDuty: 0.25,
    harmonyDuty: 0.125,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C D', 'G'],
    lead: `
      G5:2 B5:2 D6:2 B5:2 G5:2 D5:2 G5:4 |
      E5:2 G5:2 B5:2 E6:4 D6:2 B5:4 |
      C6:2 B5:2 A5:2 G5:2 E5:4 G5:4 |
      F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4 |
      B5:2 D6:2 G6:4 F#6:2 D6:2 B5:4 |
      G6:2 E6:2 B5:2 G5:2 E5:4 B5:4 |
      C6:2 E6:2 G6:4 F#6:2 D6:2 A5:4 |
      G6:6 D6:2 B5:4 G5:4`,
    harmony: { pattern: '0 2 1 2 0 2 1 2 0 2 1 2 0 2 1 2', octave: 4 },
    bass: { pattern: 'r:2 r:1 o:1 f:2 r:2 r:2 r:1 o:1 f:2 o:2', octave: 2 },
    drums: 'k . h . s . h k k . h . s . h h',
    fill: 'k . s . s . s s k s s s s s s s',
  },
  {
    // A brawl over a ball of yarn, in A minor: a rock riff, eighths in the bass.
    id: 'yarnball-rumble',
    name: 'Yarnball Rumble',
    scene: 'combat',
    bpm: 160,
    leadDuty: 0.25,
    harmonyDuty: 0.5,
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F G', 'E'],
    lead: `
      A5:2 A5:1 .:1 C6:2 A5:2 E6:4 D6:2 C6:2 |
      B5:2 C6:2 B5:2 A5:2 G5:4 E5:4 |
      F5:2 A5:2 C6:2 F6:4 E6:2 C6:4 |
      D6:2 B5:2 G5:2 B5:2 D6:4 G6:4 |
      E6:4 C6:2 A5:2 E6:4 A6:4 |
      G6:2 E6:2 C6:2 A5:2 B5:2 C6:2 D6:2 E6:2 |
      F6:4 C6:4 G6:4 D6:4 |
      G#6:4 E6:4 B5:4 G#5:4`,
    harmony: { pattern: '0 . 2 . 0 . 2 . 0 . 2 . 1 . 2 .', octave: 4 },
    bass: { pattern: 'r:2 r:2 o:2 r:2 r:2 o:2 f:2 r:2', octave: 2 },
    drums: 'k . h . s . h . k k h . s . h .',
    fill: 'k . s s k . s s k s k s s s s s',
  },
  {
    // Chasing a comet, in F major: a galop, oom-pah in the bass.
    id: 'comet-chase',
    name: 'Comet Chase',
    scene: 'combat',
    bpm: 168,
    leadDuty: 0.5,
    harmonyDuty: 0.125,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb C', 'F'],
    lead: `
      C6:2 A5:2 F5:2 A5:2 C6:2 F6:4 C6:2 |
      E6:2 C6:2 G5:2 C6:2 E6:2 G6:4 E6:2 |
      F6:2 D6:2 A5:2 D6:2 F6:4 E6:2 D6:2 |
      D6:4 Bb5:2 F5:2 Bb5:4 .:4 |
      A5:1 Bb5:1 C6:2 A5:2 F5:2 A5:1 Bb5:1 C6:2 F6:4 |
      G6:2 E6:2 C6:2 G5:2 E5:4 G5:4 |
      F5:2 Bb5:2 D6:4 E6:2 G6:2 C6:4 |
      F6:8 C6:4 F5:4`,
    harmony: { pattern: '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1', octave: 4 },
    bass: { pattern: 'r:2 f:2 r:2 f:2 r:2 f:2 r:2 f:2', octave: 2 },
    drums: 'k . h . s . h . k . h . s . s s',
  },
  {
    // A sprint on four paws, in E major: arpeggios that leap an octave, a bright fill.
    id: 'whisker-sprint',
    name: 'Whisker Sprint',
    scene: 'combat',
    bpm: 156,
    leadDuty: 0.25,
    harmonyDuty: 0.125,
    chords: ['E', 'B', 'C#m', 'A', 'E', 'B', 'A B', 'E'],
    lead: `
      E5:2 G#5:2 B5:4 G#5:2 B5:2 E6:4 |
      D#6:2 B5:2 F#5:4 B5:2 D#6:2 F#6:4 |
      E6:2 C#6:2 G#5:2 C#6:2 E6:4 D#6:2 C#6:2 |
      C#6:4 A5:2 E5:2 A5:4 .:4 |
      G#5:2 A5:2 B5:2 E6:2 G#6:4 F#6:2 E6:2 |
      F#6:2 D#6:2 B5:2 F#5:2 B5:4 D#6:4 |
      C#6:2 E6:2 A5:4 D#6:2 F#6:2 B5:4 |
      E6:8 B5:4 E5:4`,
    harmony: { pattern: '0 . 2 . 1 . 2 . 0 . 2 . 1 . 2 .', octave: 4 },
    bass: { pattern: 'r:2 o:2 f:2 o:2 r:2 o:2 f:2 o:2', octave: 2 },
    drums: 'k . h . s . h . k . h k s . h .',
    fill: 'k . s . k . s s k s s s s s s s',
  },
  {
    // Saucers everywhere, in B-flat major: a skipping bass, a hat on every off-beat.
    id: 'saucer-scramble',
    name: 'Saucer Scramble',
    scene: 'combat',
    bpm: 148,
    leadDuty: 0.5,
    harmonyDuty: 0.25,
    chords: ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb F', 'Bb'],
    lead: `
      F5:2 Bb5:2 D6:2 F6:4 D6:2 Bb5:4 |
      A5:2 C6:2 F6:4 C6:2 A5:2 F5:4 |
      G5:2 Bb5:2 D6:2 G6:4 F6:2 D6:4 |
      Eb6:4 G5:2 Bb5:2 Eb6:4 .:4 |
      D6:2 C6:2 Bb5:2 F5:2 Bb5:2 D6:2 F6:4 |
      F6:2 Eb6:2 C6:2 A5:2 F5:4 A5:4 |
      G5:2 Bb5:2 Eb6:4 F5:2 A5:2 C6:4 |
      Bb5:8 F5:4 Bb4:4`,
    harmony: { pattern: '0:2 1:2 2:2 1:2 0:2 1:2 2:2 1:2', octave: 4 },
    bass: { pattern: 'r:2 . r f:2 . f r:2 . r o:2 f:2', octave: 2 },
    drums: 'k . h . s . h h k . h . s . h .',
  },
  {
    // A hairball, coughed up with style, in A major: funky stabs, a syncopated bass.
    id: 'hairball-hustle',
    name: 'Hairball Hustle',
    scene: 'combat',
    bpm: 140,
    leadDuty: 0.125,
    harmonyDuty: 0.5,
    chords: ['A', 'D', 'E', 'A', 'F#m', 'D', 'E', 'E'],
    lead: `
      E6:1 .:1 E6:2 C#6:2 A5:2 E5:2 A5:2 C#6:4 |
      F#6:1 .:1 F#6:2 D6:2 A5:2 F#5:2 A5:2 D6:4 |
      G#6:1 .:1 G#6:2 E6:2 B5:2 G#5:2 B5:2 E6:4 |
      A6:4 E6:2 C#6:2 A5:8 |
      C#6:2 F#6:2 E6:2 C#6:2 A5:2 C#6:2 F#5:4 |
      D6:2 F#6:2 A6:4 F#6:2 D6:2 A5:4 |
      B5:2 E6:2 G#6:2 B6:2 G#6:2 E6:2 B5:4 |
      D6:4 B5:4 G#5:4 E5:4`,
    harmony: { pattern: '0 . . 2 . . 1 . 0 . . 2 . 1 . .', octave: 4 },
    bass: { pattern: 'r:2 . o r:2 f . r:2 . o t:2 f:2', octave: 2 },
    drums: 'k . h k s . h . k . h . s . h k',
  },
  {
    // A polka for the red dot, in C major: oom-pah, the snare on every off-beat.
    id: 'laser-pointer-polka',
    name: 'Laser Pointer Polka',
    scene: 'combat',
    bpm: 172,
    leadDuty: 0.25,
    harmonyDuty: 0.125,
    chords: ['C', 'G', 'G', 'C', 'C', 'F', 'G', 'C'],
    lead: `
      E5:1 F5:1 G5:2 E5:2 C5:2 G5:2 C6:2 G5:2 E5:2 |
      D5:1 E5:1 F5:2 D5:2 B4:2 G5:2 B5:2 G5:2 D5:2 |
      B5:2 A5:2 G5:2 F5:2 D5:2 F5:2 G5:4 |
      E5:2 G5:2 C6:4 .:2 C6:2 C6:4 |
      G5:2 C6:2 E6:2 C6:2 G5:2 E5:2 G5:4 |
      A5:2 C6:2 F6:2 C6:2 A5:2 F5:2 A5:4 |
      B5:2 D6:2 G6:4 F6:2 D6:2 B5:4 |
      C6:4 G5:2 E5:2 C5:4 .:4`,
    harmony: { pattern: '. 0 . 1 . 2 . 1 . 0 . 1 . 2 . 1', octave: 4 },
    bass: { pattern: 'r:2 . . f:2 . . r:2 . . f:2 . .', octave: 2 },
    drums: 'k . s . k . s . k . s . k . s s',
  },
  {
    // In orbit and speeding up, in F-sharp minor: a rolling bass, a leading tone at the end.
    id: 'orbit-overdrive',
    name: 'Orbit Overdrive',
    scene: 'combat',
    bpm: 170,
    leadDuty: 0.25,
    harmonyDuty: 0.5,
    chords: ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'E', 'C#'],
    lead: `
      F#5:2 A5:2 C#6:2 F#6:4 E6:2 C#6:4 |
      D6:2 F#6:2 A6:4 F#6:2 D6:2 A5:4 |
      C#6:2 E6:2 A6:4 G#6:2 E6:2 C#6:4 |
      B5:2 E6:2 G#6:4 E6:2 B5:2 G#5:4 |
      A6:2 G#6:2 F#6:2 E6:2 C#6:2 E6:2 F#6:4 |
      F#6:2 E6:2 D6:2 A5:2 F#5:4 A5:4 |
      G#5:2 B5:2 E6:2 G#6:2 B6:2 G#6:2 E6:4 |
      F6:8 C#6:4 G#5:4`,
    harmony: { pattern: '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1', octave: 3 },
    bass: { pattern: 'r r o r r r o r r r o r r r o r', octave: 2 },
    drums: 'k . h . s . h k k . h . s . h .',
    fill: 'k . k . s s k . k s k s s s s s',
  },
  {
    // A whole bag of treats, in D major: sunny, leaping, the bass bouncing fifths.
    id: 'treat-bag-bonanza',
    name: 'Treat Bag Bonanza',
    scene: 'combat',
    bpm: 150,
    leadDuty: 0.5,
    harmonyDuty: 0.125,
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G A', 'D'],
    lead: `
      A5:2 D6:2 F#6:2 D6:2 A5:2 F#5:2 A5:4 |
      C#6:2 E6:2 A6:2 E6:2 C#6:2 A5:2 E5:4 |
      D6:2 F#6:2 B6:4 A6:2 F#6:2 D6:4 |
      B5:4 D6:2 G6:2 F#6:2 E6:2 D6:4 |
      F#6:2 E6:2 D6:2 A5:2 B5:2 C#6:2 D6:4 |
      E6:2 C#6:2 A5:2 E5:2 A5:2 C#6:2 E6:4 |
      D6:2 B5:2 G5:4 E6:2 C#6:2 A5:4 |
      D6:8 A5:4 D5:4`,
    harmony: { pattern: '0 2 1 2 0 2 1 2 0 2 1 2 0 2 1 2', octave: 4 },
    bass: { pattern: 'r:2 f:2 o:2 f:2 r:2 f:2 o:2 f:2', octave: 2 },
    drums: 'k . h . s . h . k k h . s . h h',
  },
  {
    // Holding the cardboard fort, in G minor: the falling Andalusian chords, heroic.
    id: 'cardboard-fortress',
    name: 'Cardboard Fortress',
    scene: 'combat',
    bpm: 158,
    leadDuty: 0.25,
    harmonyDuty: 0.5,
    chords: ['Gm', 'F', 'Eb', 'D', 'Gm', 'F', 'Eb D', 'Gm'],
    lead: `
      D6:2 Bb5:2 G5:2 Bb5:2 D6:2 G6:4 D6:2 |
      C6:2 A5:2 F5:2 A5:2 C6:2 F6:4 C6:2 |
      Bb5:2 G5:2 Eb5:2 G5:2 Bb5:2 Eb6:4 Bb5:2 |
      A5:4 F#5:4 D5:4 F#5:4 |
      G6:4 F6:2 D6:2 Bb5:4 G5:4 |
      F6:4 Eb6:2 C6:2 A5:4 F5:4 |
      Eb6:2 G6:2 Bb5:4 D6:2 F#6:2 A5:4 |
      G5:8 D6:4 G6:4`,
    harmony: { pattern: '0 . 1 2 0 . 1 2 0 . 1 2 0 . 1 2', octave: 4 },
    bass: { pattern: 'r:2 r:2 o:2 r:2 f:2 r:2 o:2 r:2', octave: 2 },
    drums: 'k . h . s . h k k . h . s h s .',
  },
  {
    // A cat with nine lives and neon fur, in E-flat major: synth-pop, octaves off the beat.
    id: 'neon-nine-lives',
    name: 'Neon Nine Lives',
    scene: 'combat',
    bpm: 146,
    leadDuty: 0.125,
    harmonyDuty: 0.25,
    chords: ['Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb', 'Ab Bb', 'Eb'],
    lead: `
      G5:2 Bb5:2 Eb6:4 D6:2 Bb5:2 G5:4 |
      F5:2 Bb5:2 D6:4 C6:2 Bb5:2 F5:4 |
      Eb6:2 G6:2 C6:4 D6:2 Eb6:2 G5:4 |
      Ab5:4 C6:4 Eb6:4 .:4 |
      Bb5:2 Eb6:2 G6:4 F6:2 Eb6:2 Bb5:4 |
      D6:2 F6:2 Bb6:4 Ab6:2 F6:2 D6:4 |
      C6:2 Eb6:2 Ab6:4 Bb5:2 D6:2 F6:4 |
      Eb6:12 .:4`,
    harmony: { pattern: '0:2 2:2 3:2 2:2 1:2 2:2 3:2 2:2', octave: 4 },
    bass: { pattern: 'r . o . r . o . r . o . r . o .', octave: 2 },
    drums: 'k . h . s . h . k . h . s . h .',
  },
  {
    // A caravan of kittens on the move, in E minor: a galloping bass, folk-tune turns.
    id: 'kitten-caravan',
    name: 'Kitten Caravan',
    scene: 'combat',
    bpm: 164,
    leadDuty: 0.25,
    harmonyDuty: 0.125,
    chords: ['Em', 'D', 'C', 'B', 'Em', 'D', 'C B', 'Em'],
    lead: `
      E5:2 G5:2 B5:2 E6:2 D6:2 B5:2 G5:2 B5:2 |
      D5:2 F#5:2 A5:2 D6:2 C6:2 A5:2 F#5:2 A5:2 |
      C5:2 E5:2 G5:2 C6:2 B5:2 G5:2 E5:2 G5:2 |
      B4:2 D#5:2 F#5:2 B5:2 A5:2 F#5:2 D#5:4 |
      E6:4 D6:2 B5:2 G5:4 B5:4 |
      D6:4 C6:2 A5:2 F#5:4 A5:4 |
      C6:2 E6:2 G6:4 B5:2 D#6:2 F#6:4 |
      E6:8 B5:4 E5:4`,
    harmony: { pattern: '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1', octave: 4 },
    bass: { pattern: 'r:2 r r r:2 r r f:2 f f r:2 r r', octave: 2 },
    drums: 'k . h k s . h k k . h k s . h k',
  },
  {
    // The zoomies, in C major: the fastest of a run's, sixteenth-note runs up and down.
    id: 'zoomies',
    name: 'Zoomies',
    scene: 'combat',
    bpm: 176,
    leadDuty: 0.125,
    harmonyDuty: 0.25,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F G', 'C'],
    lead: `
      C6 D6 E6 G6 E6 D6 C6 G5 C6:2 E6:2 G6:4 |
      A5 B5 C6 E6 C6 B5 A5 E5 A5:2 C6:2 E6:4 |
      F5 G5 A5 C6 A5 G5 F5 C5 F5:2 A5:2 C6:4 |
      G5 A5 B5 D6 B5 A5 G5 D5 G5:2 B5:2 D6:4 |
      E6:2 G6:2 C6:2 E6:2 G6:4 E6:4 |
      E6:2 C6:2 A5:2 C6:2 E6:4 A6:4 |
      F6 E6 D6 C6 A5:2 C6:2 G6 F6 E6 D6 B5:2 D6:2 |
      C6:8 G5:4 C5:4`,
    harmony: { pattern: '0:2 1:2 2:2 3:2 0:2 1:2 2:2 3:2', octave: 4 },
    bass: { pattern: 'r o r o r o r o r o r o r o r o', octave: 2 },
    drums: 'k h s h k h s h k h s h k h s s',
  },
];

// ---- A boss: minor keys, fast, chromatic, each loop ending on the chord that
// pulls hardest back to the first.

const BOSS: readonly Written[] = [
  {
    // The mothership's showdown, in E minor: a stuttering riff, a chromatic slide.
    id: 'mothership-showdown',
    name: 'Mothership Showdown',
    scene: 'boss',
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
    // The Matriarch's wrath, in C minor: a galloping bass, the leading tone at the end.
    id: 'matriarchs-wrath',
    name: 'Matriarch’s Wrath',
    scene: 'boss',
    bpm: 176,
    leadDuty: 0.25,
    harmonyDuty: 0.5,
    chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm G', 'G'],
    lead: `
      C6:2 .:1 C6:1 Eb6:2 .:1 C6:1 G6:4 F6:2 Eb6:2 |
      Eb6:2 C6:2 Ab5:2 C6:2 Eb6:4 D6:2 C6:2 |
      D6:2 Bb5:2 F5:2 Bb5:2 D6:4 F6:4 |
      B5:4 D6:4 G6:4 F6:2 D6:2 |
      G6:2 F#6:2 G6:2 Eb6:2 C6:4 G5:4 |
      Ab5:2 C6:2 Eb6:2 Ab6:4 G6:2 Eb6:4 |
      F6:2 Ab6:2 C6:4 D6:2 B5:2 G5:4 |
      B5:8 D6:4 F6:4`,
    harmony: { pattern: '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1', octave: 3 },
    bass: { pattern: 'r:2 r:1 r:1 r:2 r:1 r:1 r:2 r:1 r:1 o:2 o:1 o:1', octave: 2 },
    drums: 'k . h k s . h k k . h k s . s s',
    fill: 's s s s s s s s k . k . s s s s',
  },
  {
    // A Mega Cat's meltdown, in D minor: the fastest, a piercing lead, chromatic turns.
    id: 'mega-cat-meltdown',
    name: 'Mega Cat Meltdown',
    scene: 'boss',
    bpm: 184,
    leadDuty: 0.125,
    harmonyDuty: 0.25,
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Gm A', 'A'],
    lead: `
      D6:2 F6:2 A6:2 F6:2 D6:2 A5:2 D6:4 |
      C#6:2 D6:2 E6:2 F6:2 E6:2 D6:2 C#6:2 A5:2 |
      Bb5:2 D6:2 F6:2 Bb6:4 A6:2 F6:4 |
      A5:2 C#6:2 E6:2 A6:4 G6:2 E6:4 |
      F6:2 E6:2 D6:2 C#6:2 D6:4 A5:4 |
      Bb5:2 A5:2 G#5:2 A5:2 D6:4 F6:4 |
      G6:4 Bb6:4 A6:4 C#6:4 |
      E6:8 A5:8`,
    harmony: { pattern: '0 2 0 2 1 2 1 2 0 2 0 2 1 2 1 2', octave: 4 },
    bass: { pattern: 'r r o r r r o r r r o r f:2 o:2', octave: 2 },
    drums: 'k k h . s . h k k k h . s . h s',
  },
  {
    // An abduction in progress, in B minor: syncopated stabs, a bass that lurches.
    id: 'abduction-protocol',
    name: 'Abduction Protocol',
    scene: 'boss',
    bpm: 164,
    leadDuty: 0.25,
    harmonyDuty: 0.5,
    chords: ['Bm', 'G', 'Em', 'F#', 'Bm', 'G', 'Em F#', 'F#'],
    lead: `
      B5:3 F#5:1 B5:2 D6:2 C#6:2 B5:2 A#5:2 B5:2 |
      G5:3 D5:1 G5:2 B5:2 D6:4 B5:4 |
      E6:3 B5:1 E6:2 G6:2 F#6:2 E6:2 D6:2 B5:2 |
      A#5:4 C#6:4 F#6:4 E6:4 |
      F#6:2 D6:2 B5:2 D6:2 F#6:2 B6:4 A#6:2 |
      G6:2 D6:2 B5:2 G5:2 A5:2 B5:2 D6:4 |
      E6:4 G6:4 F#6:4 A#6:4 |
      F#6:8 C#6:8`,
    harmony: { pattern: '0:2 . 0 . 2:2 . 1:2 . 2:2 . 1 .', octave: 4 },
    bass: { pattern: 'r:3 r . r:2 f:2 r:3 r . o:2', octave: 2 },
    drums: 'k . . k s . . k k . k . s . s .',
  },
  {
    // A titan's hiss, in G minor: a rolling arpeggio, a snare roll into the loop.
    id: 'hiss-of-the-titan',
    name: 'Hiss of the Titan',
    scene: 'boss',
    bpm: 170,
    leadDuty: 0.5,
    harmonyDuty: 0.25,
    chords: ['Gm', 'Eb', 'Cm', 'D', 'Gm', 'Eb', 'Cm D', 'D'],
    lead: `
      G5:2 Bb5:2 D6:2 G6:4 F#6:2 D6:4 |
      Eb6:2 D6:2 C6:2 Bb5:2 G5:4 Eb5:4 |
      C6:2 Eb6:2 G6:4 F6:2 Eb6:2 C6:4 |
      D6:4 F#6:4 A6:4 C6:4 |
      Bb6:2 A6:2 G6:2 D6:2 Bb5:2 A5:2 G5:4 |
      G5:2 Bb5:2 Eb6:4 D6:2 Bb5:2 G5:4 |
      C6:4 Eb6:4 D6:4 F#6:4 |
      A6:8 F#6:4 D6:4`,
    harmony: { pattern: '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 1', octave: 3 },
    bass: { pattern: 'r:2 o:2 r:2 o:2 r:2 o:2 t:2 f:2', octave: 2 },
    drums: 'k . h . s . h k k . h . s h s .',
    fill: 'k s k s k s k s s s s s s s s s',
  },
];

/** Every tune: five for the menus, fifteen for a run, five for a boss. */
export const TRACKS: readonly Track[] = [...MENU, ...COMBAT, ...BOSS].map(compile);

/** A scene's tunes. */
export const tracksFor = (scene: Scene): readonly Track[] =>
  TRACKS.filter((t) => t.scene === scene);

/** A random tune of `scene`: any but `last`, the one just played, when there is one. */
export function pickTrack(scene: Scene, random: () => number, last: string | null): Track {
  const choices = tracksFor(scene).filter((t) => t.id !== last);
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

/**
 * The music's loudness against the cats' sounds (whose loudest peak is about 0.25):
 * 0.11 at first, then 15% lower, as it stood out too much.
 */
export const VOLUME = 0.0935;
/**
 * Paused: this share of the loudness, this share of the tempo, muffled above this, Hz.
 * The share was 0.35; raised a tenth (0.385) when VOLUME was lowered, so a pause
 * loses less than the rest (0.036, against 0.0385 before).
 */
export const PAUSED = { volume: 0.385, tempo: 0.7, muffle: 900 } as const;
/** Each voice's share of it. */
const LEVELS = { lead: 0.55, harmony: 0.3, bass: 0.75, drums: 0.6 } as const;
/** Times round a tune before the scene's next. */
export const LOOPS = 3;
/** How far ahead the player schedules, seconds, and how often it wakes, ms. */
const LOOKAHEAD = 0.12;
const WAKE_MS = 25;
/** Fades, seconds: in at the start, out when stopped or changed; pausing glides. */
const FADE_IN = 0.4;
const FADE_OUT = 0.25;
const GLIDE = 0.3;
/** The beam-up at a boss's end, seconds: as long as the mothership's visit (2.2 s). */
export const BEAM_UP = 2.3;

export type MusicPlayer = ReturnType<typeof createMusicPlayer>;

type Timers = {
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
};

const realTimers: Timers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
};

/**
 * Plays the scenes' tunes. `context` gives the AudioContext to play on, or null when
 * there is none to play on (sound off, no gesture yet, no Web Audio): playing then
 * does nothing and says so. `random` picks the tunes. Never throws.
 */
export function createMusicPlayer(
  context: () => MusicContext | null,
  timers: Timers = realTimers,
  random: () => number = Math.random
) {
  let ctx: MusicContext | null = null;
  /** The chain the tunes play into: their volume, then the muffle of a pause. */
  let master: GainNode | null = null;
  let muffle: BiquadFilterNode | null = null;
  let timer: unknown = null;
  let scene: Scene | null = null;
  let track: Track | null = null;
  let loopsLeft = LOOPS;
  /** The next sixteenth to schedule, and when on the audio clock. */
  let step = 0;
  let nextAt = 0;
  let paused = false;
  /** A boss's beam-up is playing: the scene asked for meanwhile, to play after it. */
  let beaming = false;
  let after: Scene | null = null;
  const listeners = new Set<() => void>();
  // Made once per context, when first needed.
  let made: MusicContext | null = null;
  let noise: AudioBuffer | null = null;
  const pulses = new Map<number, PeriodicWave>();
  // Which notes start at which sixteenth, per tune (worked out once).
  const starts = new Map<string, { notes: { voice: Voice; note: Note }[][]; hits: Hit[][] }>();

  type Voice = 'lead' | 'harmony' | 'bass';

  function startsOf(t: Track) {
    let at = starts.get(t.id);
    if (!at) {
      const notes: { voice: Voice; note: Note }[][] = Array.from({ length: t.steps }, () => []);
      for (const voice of ['lead', 'harmony', 'bass'] as const) {
        for (const note of t[voice]) notes[note.step].push({ voice, note });
      }
      const hits: Hit[][] = Array.from({ length: t.steps }, () => []);
      for (const hit of t.drums) hits[hit.step].push(hit);
      at = { notes, hits };
      starts.set(t.id, at);
    }
    return at;
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

  /** A sixteenth's length now, seconds: slower while paused. */
  const secondsPerStep = (t: Track) => 60 / t.bpm / 4 / (paused ? PAUSED.tempo : 1);

  /** A pulse-wave (or triangle) note from `at` for `length` seconds, into `out`. */
  function tone(
    c: MusicContext,
    out: AudioNode,
    wave: number | 'triangle',
    hz: number,
    at: number,
    length: number,
    level: number,
    gate = 0.88,
    vibrato = false
  ) {
    const end = at + length * gate;
    const osc = c.createOscillator();
    if (wave === 'triangle') osc.type = 'triangle';
    else osc.setPeriodicWave(pulse(c, wave));
    osc.frequency.setValueAtTime(hz, at);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.005);
    gain.gain.linearRampToValueAtTime(level * 0.7, at + Math.min(0.08, length / 2));
    gain.gain.setValueAtTime(level * 0.7, Math.max(at + 0.01, end - 0.02));
    gain.gain.linearRampToValueAtTime(0, end);
    // A held note gets a little vibrato, as the old composers wrote by hand.
    if (vibrato && length >= 0.4) {
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

  function playNote(
    c: MusicContext,
    out: AudioNode,
    t: Track,
    voice: Voice,
    note: Note,
    at: number
  ) {
    const length = note.steps * secondsPerStep(t);
    const hz = midiToHz(note.midi);
    if (voice === 'bass') tone(c, out, 'triangle', hz, at, length, LEVELS.bass, 0.95);
    else if (voice === 'lead') tone(c, out, t.leadDuty, hz, at, length, LEVELS.lead, 0.88, true);
    else tone(c, out, t.harmonyDuty, hz, at, length, LEVELS.harmony);
  }

  /** A burst of noise through a filter: a snare, a hat, a whoosh. */
  function hiss(
    c: MusicContext,
    out: AudioNode,
    at: number,
    length: number,
    level: number,
    type: BiquadFilterType,
    from: number,
    to = from
  ) {
    const source = c.createBufferSource();
    source.buffer = whiteNoise(c);
    source.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, at);
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, at + length);
    const gain = c.createGain();
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(at, Math.random() * 0.4);
    source.stop(at + length + 0.01);
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
    } else if (drum === 's') hiss(c, out, at, 0.14, level, 'bandpass', 1800);
    else hiss(c, out, at, drum === 'o' ? 0.18 : 0.04, level * 0.45, 'highpass', 7000);
  }

  /**
   * The mothership beaming a boss up, from `at`, straight to the speakers: a tractor
   * beam of two pulse waves sweeping up three octaves and wobbling, sparkles rising
   * through a major chord, a whoosh as the ship leaves, and a last high two-note chime.
   */
  function beamSound(c: MusicContext, at: number) {
    const out = c.createGain();
    out.gain.setValueAtTime(VOLUME * 1.4, at);
    out.connect(c.destination);
    for (const [from, to, duty, level] of [
      [220, 1760, 0.25, 0.5],
      [330, 2640, 0.125, 0.25],
    ] as const) {
      const osc = c.createOscillator();
      osc.setPeriodicWave(pulse(c, duty));
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(to, at + 1.6);
      const wobble = c.createOscillator();
      wobble.frequency.setValueAtTime(14, at);
      const depth = c.createGain();
      depth.gain.setValueAtTime(60, at);
      wobble.connect(depth);
      depth.connect(osc.detune);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.15);
      gain.gain.setValueAtTime(level, at + 1.3);
      gain.gain.linearRampToValueAtTime(0, at + 1.7);
      osc.connect(gain);
      gain.connect(out);
      for (const node of [osc, wobble]) {
        node.start(at);
        node.stop(at + 1.75);
      }
    }
    // Sparkles: C major, up two octaves.
    [72, 76, 79, 84, 88, 91, 96].forEach((midi, k) =>
      tone(c, out, 0.125, midiToHz(midi), at + 0.35 + k * 0.11, 0.1, 0.3, 0.9)
    );
    hiss(c, out, at + 1.5, 0.5, 0.4, 'bandpass', 600, 6000);
    tone(c, out, 0.5, midiToHz(91), at + 1.9, 0.12, 0.35, 0.9);
    tone(c, out, 0.5, midiToHz(96), at + 2.0, 0.3, 0.35, 0.95);
  }

  /** Schedules every sixteenth that starts before the lookahead runs out. */
  function wake() {
    if (!ctx || !track || !master || !scene) return;
    try {
      // Fallen behind (a hidden tab's timer slows to once a second): skip what
      // was missed rather than play it all at once.
      if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
      while (nextAt < ctx.currentTime + LOOKAHEAD) {
        const { notes, hits } = startsOf(track);
        const each = secondsPerStep(track);
        // Swing: the off-beat eighths (the third sixteenth of each beat) come late.
        const at = step % 4 === 2 ? nextAt + track.swing * each : nextAt;
        for (const { voice, note } of notes[step]) playNote(ctx, master, track, voice, note, at);
        for (const hit of hits[step]) playDrum(ctx, master, hit.drum, at);
        nextAt += each;
        step++;
        if (step >= track.steps) {
          step = 0;
          // Round enough times: the scene's next tune, from the next bar.
          if (--loopsLeft <= 0) {
            track = pickTrack(scene, random, track.id);
            loopsLeft = LOOPS;
            notify();
          }
        }
      }
    } catch {
      // A context that refuses (closed, say): the music goes quiet, nothing breaks.
      halt();
    }
  }

  /** Tells whoever follows the tune playing (the settings' "Now playing") it changed. */
  function notify() {
    for (const listener of listeners) listener();
  }

  /** Fades the chain out and lets it go; the timer stops. */
  function halt() {
    const was = timer !== null;
    if (timer !== null) timers.clearInterval(timer);
    timer = null;
    if (was) notify();
    const old = master;
    const oldMuffle = muffle;
    master = null;
    muffle = null;
    if (old && ctx) {
      try {
        const now = ctx.currentTime;
        old.gain.cancelScheduledValues?.(now);
        old.gain.setValueAtTime(old.gain.value, now);
        old.gain.linearRampToValueAtTime(0, now + FADE_OUT);
        timers.setTimeout(
          () => {
            old.disconnect();
            oldMuffle?.disconnect();
          },
          (FADE_OUT + LOOKAHEAD) * 1000 + 50
        );
      } catch {
        // Already gone.
      }
    }
  }

  /** The levels a pause asks for: the chain's volume and where it muffles. */
  const levels = () =>
    paused
      ? { volume: VOLUME * PAUSED.volume, muffle: PAUSED.muffle }
      : { volume: VOLUME, muffle: 20000 };

  /** Starts `next`'s music afresh on the context, a new tune; false if it cannot. */
  function begin(next: Scene): boolean {
    const c = context();
    if (!c) return false;
    halt();
    try {
      fresh(c);
      ctx = c;
      scene = next;
      track = pickTrack(next, random, track?.id ?? null);
      loopsLeft = LOOPS;
      step = 0;
      const { volume, muffle: hz } = levels();
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(hz, c.currentTime);
      filter.connect(c.destination);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(volume, c.currentTime + FADE_IN);
      gain.connect(filter);
      master = gain;
      muffle = filter;
      nextAt = c.currentTime + 0.05;
      timer = timers.setInterval(wake, WAKE_MS);
      wake();
      notify();
      return true;
    } catch {
      halt();
      scene = null;
      return false;
    }
  }

  return {
    /**
     * Plays `next`'s music (a random tune of it), or none (null). Asked for the scene
     * playing, it goes on. During a beam-up the change waits for it to end. True if
     * the scene plays (or will, after the beam-up).
     */
    setScene(next: Scene | null): boolean {
      if (beaming) {
        after = next;
        return true;
      }
      if (next === null) {
        halt();
        scene = null;
        return true;
      }
      if (next === scene && timer !== null) return true;
      return begin(next);
    },

    /** Paused, the music goes on quieter, slower and muffled; unpaused, as it was. */
    setPaused(on: boolean) {
      if (on === paused) return;
      paused = on;
      if (!ctx || !master || !muffle) return;
      try {
        const now = ctx.currentTime;
        const { volume, muffle: hz } = levels();
        master.gain.cancelScheduledValues?.(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(volume, now + GLIDE);
        muffle.frequency.setValueAtTime(muffle.frequency.value, now);
        muffle.frequency.exponentialRampToValueAtTime(hz, now + GLIDE);
      } catch {
        // A context gone: nothing to glide.
      }
    },

    /**
     * A boss was sent home: its music stops and the mothership beams it up. Whatever
     * scene is asked for meanwhile plays when that ends (by default the one playing,
     * with a new tune). False if there is no music playing to end.
     */
    beamUp(): boolean {
      if (!ctx || timer === null || beaming) return false;
      const c = ctx;
      after = scene;
      halt();
      scene = null;
      try {
        beamSound(c, c.currentTime + 0.05);
      } catch {
        // Nothing to beam with: the music simply goes on below.
      }
      beaming = true;
      timers.setTimeout(() => {
        beaming = false;
        if (after) begin(after);
        after = null;
      }, BEAM_UP * 1000);
      return true;
    },

    /**
     * Skips to another tune of the scene playing (never the same one), from its
     * start; false if nothing is playing (or a beam-up is).
     */
    next(): boolean {
      if (beaming || timer === null || !scene) return false;
      return begin(scene);
    },

    /** The scene and tune playing, or null. */
    playing: (): { scene: Scene; track: string } | null =>
      timer !== null && scene && track ? { scene, track: track.id } : null,

    /** For useSyncExternalStore: told whenever the tune playing changes (or stops). */
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Whether a beam-up is playing. */
    beaming: () => beaming,
  };
}

let shared: MusicPlayer | null = null;

/** The page's one music player, on the sound player's AudioContext (sounds.ts). */
export function sharedMusic(): MusicPlayer {
  shared ??= createMusicPlayer(() => sharedSoundPlayer().context());
  return shared;
}

/** A tune's name, by its id (the settings' "Now playing"). */
export const trackName = (id: string) => TRACKS.find((t) => t.id === id)?.name ?? id;
