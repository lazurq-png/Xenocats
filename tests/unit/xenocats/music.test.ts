import { describe, expect, it, vi } from 'vitest';
import {
  BEAM_UP,
  LOOPS,
  PAUSED,
  SCENES,
  TRACKS,
  VOLUME,
  createMusicPlayer,
  midiToHz,
  noteToMidi,
  parseChord,
  pickTrack,
  trackName,
  tracksFor,
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

describe('the tunes', () => {
  it('five for the menus, fifteen for a run, five for a boss, every one its own', () => {
    expect(tracksFor('menu')).toHaveLength(5);
    expect(tracksFor('combat')).toHaveLength(15);
    expect(tracksFor('boss')).toHaveLength(5);
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(25);
    expect(new Set(TRACKS.map((t) => t.name)).size).toBe(25);
    // Not one tune twice under two names.
    expect(new Set(TRACKS.map((t) => JSON.stringify(t.lead))).size).toBe(25);
    for (const t of TRACKS) expect(trackName(t.id)).toBe(t.name);
  });

  it('15% quieter than at first; paused, a tenth more of that, so a pause loses less', () => {
    expect(VOLUME).toBeCloseTo(0.11 * 0.85, 6);
    expect(PAUSED.volume).toBeCloseTo(0.35 * 1.1, 6);
    // Quieter paused than before, but by less than the 15% the rest lost.
    const before = 0.11 * 0.35;
    expect(VOLUME * PAUSED.volume).toBeLessThan(before);
    expect(VOLUME * PAUSED.volume).toBeGreaterThan(before * 0.85);
  });

  it('the menus’ are slow, a run’s upbeat, a boss’s the fastest of all', () => {
    const tempos = (scene: (typeof SCENES)[number]) => tracksFor(scene).map((t) => t.bpm);
    expect(Math.max(...tempos('menu'))).toBeLessThanOrEqual(100);
    expect(Math.min(...tempos('combat'))).toBeGreaterThanOrEqual(140);
    expect(Math.min(...tempos('boss'))).toBeGreaterThanOrEqual(160);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(tempos('boss'))).toBeGreaterThan(mean(tempos('combat')));
    // Lounge music is swung, mostly; a fight is straight.
    expect(tracksFor('menu').filter((t) => t.swing > 0).length).toBeGreaterThanOrEqual(3);
    for (const t of [...tracksFor('combat'), ...tracksFor('boss')]) expect(t.swing, t.id).toBe(0);
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

  it('a scene’s next tune is never the one just played, and can be any other', () => {
    for (const scene of SCENES) {
      for (const last of tracksFor(scene)) {
        const drawn = new Set<string>();
        for (let k = 0; k < 40; k++) drawn.add(pickTrack(scene, () => k / 40, last.id).id);
        expect(drawn.has(last.id)).toBe(false);
        expect(drawn.size).toBe(tracksFor(scene).length - 1);
        for (const id of drawn) expect(tracksFor(scene).some((t) => t.id === id)).toBe(true);
      }
    }
  });
});

/** A stand-in AudioContext whose clock the test moves, counting what it is asked for. */
function fakeContext() {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    oscillators: 0,
    sources: 0,
    gains: [] as { gain: ReturnType<typeof param>; disconnect: ReturnType<typeof vi.fn> }[],
    filters: [] as { type: string; frequency: ReturnType<typeof param> }[],
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
    createBiquadFilter: () => {
      const filter = { ...node(), type: 'lowpass', frequency: param(), Q: param() };
      ctx.filters.push(filter);
      return filter;
    },
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
  let later: { fn: () => void; ms: number }[] = [];
  return {
    timers: {
      setInterval: (fn: () => void) => {
        wake = fn;
        return 1;
      },
      clearInterval: () => {
        wake = null;
      },
      setTimeout: (fn: () => void, ms: number) => later.push({ fn, ms }),
    },
    tick: () => wake?.(),
    running: () => wake !== null,
    /** Runs the timeouts set so far that are due within `ms`. */
    runLater: (ms = Infinity) => {
      const due = later.filter((t) => t.ms <= ms);
      later = later.filter((t) => t.ms > ms);
      for (const t of due) t.fn();
    },
  };
}

/** Moves the clock on `seconds` in 25 ms wakes, counting the oscillators made. */
function play(ctx: ReturnType<typeof fakeContext>, tick: () => void, seconds: number) {
  const before = ctx.oscillators;
  for (let k = 0; k < seconds * 40; k++) {
    ctx.currentTime += 0.025;
    tick();
  }
  return ctx.oscillators - before;
}

describe('the music player', () => {
  it('Next song: another tune of the scene playing, never the same; nothing when none plays', () => {
    const ctx = fakeContext();
    const { timers, runLater } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    expect(player.next()).toBe(false);
    for (const scene of SCENES) {
      player.setScene(scene);
      for (let k = 0; k < 10; k++) {
        const before = player.playing()!.track;
        expect(player.next()).toBe(true);
        const after = player.playing()!;
        expect(after.scene).toBe(scene);
        expect(after.track).not.toBe(before);
      }
    }
    // Not over a beam-up.
    player.setScene('boss');
    player.beamUp();
    expect(player.next()).toBe(false);
    runLater();
    player.setScene(null);
    expect(player.next()).toBe(false);
  });

  it('tells its listeners when the tune changes: a scene, Next song, the next tune in turn, a stop', () => {
    const ctx = fakeContext();
    const { timers, tick } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    const heard = vi.fn();
    const stop = player.subscribe(heard);
    player.setScene('combat');
    expect(heard).toHaveBeenCalled();
    heard.mockClear();
    player.next();
    expect(heard).toHaveBeenCalled();
    heard.mockClear();
    // Round the tune enough times: the next one comes, and they hear.
    const track = TRACKS.find((t) => t.id === player.playing()!.track)!;
    play(ctx, tick, ((track.steps * 60) / track.bpm / 4) * LOOPS + 0.5);
    expect(heard).toHaveBeenCalled();
    heard.mockClear();
    player.setScene(null);
    expect(heard).toHaveBeenCalled();
    stop();
    heard.mockClear();
    player.setScene('menu');
    expect(heard).not.toHaveBeenCalled();
  });

  it('plays nothing, and says so, without a context to play on', () => {
    const { timers, running } = handTimers();
    const player = createMusicPlayer(() => null, timers);
    expect(player.setScene('menu')).toBe(false);
    expect(player.playing()).toBeNull();
    expect(running()).toBe(false);
  });

  it('a scene plays one of its own tunes, a little ahead as the clock moves', () => {
    for (const scene of SCENES) {
      const ctx = fakeContext();
      const { timers, tick } = handTimers();
      const player = createMusicPlayer(
        () => ctx as never,
        timers,
        () => 0.5
      );
      expect(player.setScene(scene)).toBe(true);
      const now = player.playing();
      expect(now?.scene).toBe(scene);
      expect(tracksFor(scene).some((t) => t.id === now?.track)).toBe(true);
      const first = ctx.oscillators;
      expect(first).toBeGreaterThan(0);
      // The clock stands still (a suspended context): waking schedules nothing more.
      for (let k = 0; k < 50; k++) tick();
      expect(ctx.oscillators).toBe(first);
      expect(play(ctx, tick, 1)).toBeGreaterThan(0);
      expect(ctx.sources).toBeGreaterThan(0);
    }
  });

  it('asked for the scene playing, it goes on; another scene changes the tune', () => {
    const ctx = fakeContext();
    const { timers } = handTimers();
    const make = vi.fn(() => ctx as never);
    const player = createMusicPlayer(make, timers);
    player.setScene('combat');
    const tune = player.playing()?.track;
    player.setScene('combat');
    expect(make).toHaveBeenCalledTimes(1);
    expect(player.playing()?.track).toBe(tune);
    player.setScene('boss');
    expect(player.playing()?.scene).toBe('boss');
  });

  it(`after ${LOOPS} times round a tune, the scene's next one plays`, () => {
    const ctx = fakeContext();
    const { timers, tick } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.setScene('combat');
    const first = player.playing()!.track;
    const track = TRACKS.find((t) => t.id === first)!;
    const loop = (track.steps * 60) / track.bpm / 4;
    play(ctx, tick, loop * (LOOPS - 0.5));
    expect(player.playing()!.track).toBe(first);
    play(ctx, tick, loop);
    const next = player.playing()!;
    expect(next.scene).toBe('combat');
    expect(next.track).not.toBe(first);
  });

  it('paused, it goes on quieter, slower and muffled; unpaused, as it was', () => {
    const ctx = fakeContext();
    const { timers, tick } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.setScene('combat');
    const master = ctx.gains[0];
    const muffle = ctx.filters.find((f) => f.type === 'lowpass')!;
    const playing = play(ctx, tick, 2);
    player.setPaused(true);
    expect(player.playing()?.scene).toBe('combat');
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      VOLUME * PAUSED.volume,
      expect.any(Number)
    );
    expect(muffle.frequency.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(
      PAUSED.muffle,
      expect.any(Number)
    );
    // Slower: fewer notes in the same time.
    const paused = play(ctx, tick, 2);
    expect(paused).toBeLessThan(playing * 0.85);
    player.setPaused(false);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      VOLUME,
      expect.any(Number)
    );
  });

  it('a scene started while paused starts quiet', () => {
    const ctx = fakeContext();
    const { timers } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.setPaused(true);
    player.setScene('menu');
    expect(ctx.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      VOLUME * PAUSED.volume,
      expect.any(Number)
    );
  });

  it('a boss sent home: its music stops for the beam-up, and the scene asked for meanwhile plays after', () => {
    const ctx = fakeContext();
    const { timers, tick, running, runLater } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.setScene('boss');
    const before = ctx.oscillators;
    expect(player.beamUp()).toBe(true);
    // The beam itself: a sweep, its wobble, sparkles and a chime.
    expect(ctx.oscillators - before).toBeGreaterThanOrEqual(10);
    expect(player.beaming()).toBe(true);
    expect(running()).toBe(false);
    expect(player.playing()).toBeNull();
    // The boss is gone: the run's music is asked for, and waits for the beam-up.
    expect(player.setScene('combat')).toBe(true);
    expect(player.playing()).toBeNull();
    expect(play(ctx, tick, 1)).toBe(0);
    // Not a second beam-up over the first.
    expect(player.beamUp()).toBe(false);
    runLater(BEAM_UP * 1000);
    expect(player.beaming()).toBe(false);
    expect(player.playing()?.scene).toBe('combat');
  });

  it('with no other scene asked for, a beam-up gives way to a new tune of the same scene', () => {
    const ctx = fakeContext();
    const { timers, runLater } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.setScene('boss');
    const tune = player.playing()!.track;
    player.beamUp();
    runLater();
    expect(player.playing()?.scene).toBe('boss');
    expect(player.playing()?.track).not.toBe(tune);
  });

  it('no beam-up without music playing', () => {
    const ctx = fakeContext();
    const { timers } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    expect(player.beamUp()).toBe(false);
    player.setScene('boss');
    player.setScene(null);
    expect(player.beamUp()).toBe(false);
  });

  it('stopped, it goes quiet, then lets go', () => {
    const ctx = fakeContext();
    const { timers, tick, running, runLater } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.setScene('menu');
    player.setScene(null);
    expect(running()).toBe(false);
    expect(play(ctx, tick, 1)).toBe(0);
    runLater();
    expect(ctx.gains[0].disconnect).toHaveBeenCalled();
  });

  it('a clock far ahead (a hidden tab) skips what it missed instead of playing it all at once', () => {
    const ctx = fakeContext();
    const { timers, tick } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    player.setScene('boss');
    const before = ctx.oscillators;
    ctx.currentTime += 30;
    tick();
    // 30 seconds of a boss's tune is hundreds of sixteenths: far fewer notes come.
    expect(ctx.oscillators - before).toBeLessThan(20);
  });

  it('a context that throws leaves it quiet, never thrown', () => {
    const ctx = fakeContext();
    ctx.createOscillator = () => {
      throw new Error('closed');
    };
    const { timers, running } = handTimers();
    const player = createMusicPlayer(() => ctx as never, timers);
    expect(() => player.setScene('combat')).not.toThrow();
    expect(running()).toBe(false);
  });
});
