import { describe, expect, it, vi } from 'vitest';
import {
  TRACKS,
  TRACK_IDS,
  createMusicPlayer,
  midiToHz,
  noteToMidi,
  parseChord,
  pickTrack,
} from '@/app/ui/xenocats/music';

describe('the notation', () => {
  it('names notes as MIDI numbers, sharps and flats too', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('C#5')).toBe(73);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(81)).toBeCloseTo(880, 6);
    expect(() => noteToMidi('H4')).toThrow();
  });

  it('reads chords as a root and intervals', () => {
    expect(parseChord('C')).toEqual({ root: 0, tones: [0, 4, 7] });
    expect(parseChord('Am')).toEqual({ root: 9, tones: [0, 3, 7] });
    expect(parseChord('Bb')).toEqual({ root: 10, tones: [0, 4, 7] });
    expect(parseChord('Gm7').tones).toEqual([0, 3, 7, 10]);
    expect(() => parseChord('Cwhatever')).toThrow();
  });
});

describe('the five tunes', () => {
  it('are five different kinds, each with its own name', () => {
    expect(TRACKS).toHaveLength(5);
    expect(new Set(TRACK_IDS).size).toBe(5);
    expect(new Set(TRACKS.map((t) => t.name)).size).toBe(5);
    expect(new Set(TRACKS.map((t) => t.kind)).size).toBe(5);
    expect(new Set(TRACKS.map((t) => t.bpm)).size).toBe(5);
  });

  it('every voice plays, within the loop, in a range a speaker carries', () => {
    for (const t of TRACKS) {
      expect(t.steps % 16, t.id).toBe(0);
      for (const voice of ['lead', 'harmony', 'bass'] as const) {
        expect(t[voice].length, `${t.id} ${voice}`).toBeGreaterThan(8);
        for (const note of t[voice]) {
          expect(note.step + note.steps, `${t.id} ${voice}`).toBeLessThanOrEqual(t.steps);
          // From about 41 Hz (E1) to about 2.1 kHz (C7).
          expect(note.midi, `${t.id} ${voice}`).toBeGreaterThanOrEqual(28);
          expect(note.midi, `${t.id} ${voice}`).toBeLessThanOrEqual(96);
        }
      }
      expect(t.drums.length, t.id).toBeGreaterThan(8);
      expect(t.drums.every((h) => h.step < t.steps)).toBe(true);
    }
  });

  it('the lead never plays two notes at once', () => {
    for (const t of TRACKS) {
      const lead = [...t.lead].sort((a, b) => a.step - b.step);
      for (let i = 1; i < lead.length; i++) {
        expect(lead[i].step, t.id).toBeGreaterThanOrEqual(lead[i - 1].step + lead[i - 1].steps);
      }
    }
  });

  it('shuffle never draws the last run’s tune again, and can draw every other', () => {
    for (const last of TRACK_IDS) {
      const drawn = new Set<string>();
      for (let k = 0; k < 40; k++) drawn.add(pickTrack(() => k / 40, last));
      expect(drawn.has(last)).toBe(false);
      expect(drawn.size).toBe(4);
    }
    expect(pickTrack(() => 0.999999, null)).toBe(TRACK_IDS[4]);
  });
});

/** A stand-in AudioContext whose clock the test moves, counting what it is asked for. */
function fakeContext() {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    oscillators: 0,
    sources: 0,
    gains: [] as { disconnect: ReturnType<typeof vi.fn> }[],
    createGain: () => {
      const gain = { ...node(), gain: param() };
      ctx.gains.push(gain);
      return gain;
    },
    createOscillator: () => {
      ctx.oscillators++;
      return {
        ...node(),
        type: 'sine',
        frequency: param(),
        detune: param(),
        setPeriodicWave: vi.fn(),
      };
    },
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => {
      ctx.sources++;
      return { ...node(), buffer: null, loop: false };
    },
    createPeriodicWave: vi.fn(() => ({})),
  };
  return ctx;
}

/** Timers the test runs by hand. */
function handTimers() {
  let wake: (() => void) | null = null;
  const later: (() => void)[] = [];
  return {
    timers: {
      setInterval: (fn: () => void) => {
        wake = fn;
        return 1;
      },
      clearInterval: () => {
        wake = null;
      },
      setTimeout: (fn: () => void) => later.push(fn),
    },
    tick: () => wake?.(),
    running: () => wake !== null,
    flushLater: () => later.splice(0).forEach((fn) => fn()),
  };
}

describe('the music player', () => {
  it('plays nothing, and says so, without a context to play on', () => {
    const { timers, running } = handTimers();
    const player = createMusicPlayer(() => null, timers);
    expect(player.play('overworld')).toBe(false);
    expect(player.playing()).toBeNull();
    expect(running()).toBe(false);
  });

  it('schedules a little ahead as the clock moves, and stops when stopped', () => {
    const ctx = fakeContext();
    const { timers, tick, running, flushLater } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    expect(player.play('showdown')).toBe(true);
    expect(player.playing()).toBe('showdown');
    const first = ctx.oscillators;
    expect(first).toBeGreaterThan(0);
    // The clock stands still (a suspended context): waking schedules nothing more.
    for (let k = 0; k < 50; k++) tick();
    expect(ctx.oscillators).toBe(first);
    // It moves: more is scheduled, about as much as the time that passed holds.
    for (let k = 0; k < 40; k++) {
      ctx.currentTime += 0.025;
      tick();
    }
    expect(ctx.oscillators).toBeGreaterThan(first);
    expect(ctx.sources).toBeGreaterThan(0);
    player.stop();
    expect(player.playing()).toBeNull();
    expect(running()).toBe(false);
    const stopped = ctx.oscillators;
    ctx.currentTime += 1;
    tick();
    expect(ctx.oscillators).toBe(stopped);
    // Its volume fades, then lets go.
    flushLater();
    expect(ctx.gains[0].disconnect).toHaveBeenCalled();
  });

  it('a clock far ahead (a hidden tab) skips what it missed instead of playing it all at once', () => {
    const ctx = fakeContext();
    const { timers, tick } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.play('hyperspace');
    const before = ctx.oscillators;
    ctx.currentTime += 30;
    tick();
    // 30 seconds at 176 bpm is 352 sixteenths: far fewer notes than that come.
    expect(ctx.oscillators - before).toBeLessThan(20);
  });

  it('asked for the tune it is playing, it goes on; another tune starts afresh', () => {
    const ctx = fakeContext();
    const { timers } = handTimers();
    const make = vi.fn(() => ctx as never);
    const player = createMusicPlayer(make, timers);
    player.play('lounge');
    player.play('lounge');
    expect(make).toHaveBeenCalledTimes(1);
    player.play('catacombs');
    expect(player.playing()).toBe('catacombs');
  });

  it('paused, it goes quiet; played again, the same tune goes on', () => {
    const ctx = fakeContext();
    const { timers, running } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.play('overworld');
    player.pause();
    expect(running()).toBe(false);
    expect(player.playing()).toBeNull();
    expect(player.play('overworld')).toBe(true);
    expect(player.playing()).toBe('overworld');
  });

  it('a context that throws leaves it quiet, never thrown', () => {
    const ctx = fakeContext();
    ctx.createOscillator = () => {
      throw new Error('closed');
    };
    const { timers, running } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    expect(() => player.play('overworld')).not.toThrow();
    expect(running()).toBe(false);
  });
});
