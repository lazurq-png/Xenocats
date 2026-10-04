// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import {
  ATTACK_SOUNDS,
  SOUND_KEY,
  type Sound,
  createSoundPlayer,
  getSoundEnabled,
  setSoundEnabled,
  sharedSoundPlayer,
  soundsFor,
} from '@/app/ui/xenocats/sounds';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const valid = (sound: Sound) => {
  expect(sound.length).toBeGreaterThan(0);
  for (const t of sound) {
    if (t.wave !== 'noise') expect(t.freq).toBeGreaterThan(0);
    expect(t.duration).toBeGreaterThan(0);
    expect(t.at).toBeGreaterThanOrEqual(0);
    expect(t.gain).toBeGreaterThan(0);
    expect(t.gain).toBeLessThanOrEqual(1);
  }
};

describe('every cat type has its sounds', () => {
  it('an attack, a wake-up and an arrival, all playable', () => {
    for (const type of CAT_TYPES) {
      const sounds = soundsFor(type);
      valid(sounds.attack);
      valid(sounds.wake);
      valid(sounds.arrive);
      valid(sounds.purr);
      expect(ATTACK_SOUNDS[type.effect.id], type.id).toBe(sounds.attack);
    }
  });

  it('every attack sounds different', () => {
    const attacks = CAT_TYPES.map((type) => JSON.stringify(soundsFor(type).attack));
    expect(new Set(attacks).size).toBe(CAT_TYPES.length);
  });

  it('every cat wakes and arrives at its own pitch', () => {
    const wakes = CAT_TYPES.map((type) => soundsFor(type).wake[0].freq);
    const arrivals = CAT_TYPES.map((type) => soundsFor(type).arrive[0].freq);
    expect(new Set(wakes).size).toBe(CAT_TYPES.length);
    expect(new Set(arrivals).size).toBe(CAT_TYPES.length);
  });
});

/** A stand-in AudioContext that counts what it is asked to play. */
function fakeContext() {
  const param = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setValueCurveAtTime: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'suspended' as AudioContextState,
    destination: {},
    resume: vi.fn(() => {
      ctx.state = 'running';
      return Promise.resolve();
    }),
    oscillators: 0,
    noises: 0,
    createGain: () => ({ ...node(), gain: param() }),
    filters: 0,
    createOscillator: () => {
      ctx.oscillators++;
      return { ...node(), type: 'sine', frequency: param(), detune: param() };
    },
    createBiquadFilter: () => {
      ctx.filters++;
      return { ...node(), type: 'lowpass', frequency: param(), Q: param() };
    },
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => {
      ctx.noises++;
      return { ...node(), buffer: null, loop: false };
    },
  };
  return ctx;
}

const beep: Sound = [{ wave: 'sine', freq: 440, at: 0, duration: 0.1, gain: 0.5 }];

describe('the player', () => {
  it('plays nothing before the first gesture, and does not even make a context', () => {
    const make = vi.fn(fakeContext);
    const player = createSoundPlayer(make as never, () => true);
    expect(player.play(beep)).toBe(false);
    expect(make).not.toHaveBeenCalled();
  });

  it('after a gesture it resumes the context and plays every tone', () => {
    const ctx = fakeContext();
    const player = createSoundPlayer(
      () => ctx as never,
      () => true
    );
    player.unlock();
    expect(ctx.resume).toHaveBeenCalled();
    const knockback = ATTACK_SOUNDS.knockback;
    expect(player.play(knockback)).toBe(true);
    // A voice is an oscillator, and so is each vibrato and each pulse moving it.
    const count = (test: (t: Sound[number]) => boolean) => knockback.filter(test).length;
    expect(ctx.oscillators).toBe(
      count((t) => t.wave !== 'noise') + count((t) => !!t.vibrato) + count((t) => !!t.pulse)
    );
    expect(ctx.noises).toBe(count((t) => t.wave === 'noise'));
    // Every formant of every tone is a band of its own.
    expect(ctx.filters).toBe(knockback.reduce((n, t) => n + (t.formants?.length ?? 0), 0));
  });

  it('queues nothing on a context that is still suspended, and asks it to run', () => {
    const ctx = fakeContext();
    ctx.resume = vi.fn(() => Promise.resolve()); // stays suspended
    const player = createSoundPlayer(
      () => ctx as never,
      () => true
    );
    player.unlock();
    expect(player.play(beep)).toBe(false);
    expect(ctx.oscillators).toBe(0);
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  it('makes no audio context at all while sound is switched off', () => {
    const make = vi.fn(fakeContext);
    let on = false;
    const player = createSoundPlayer(make as never, () => on);
    player.unlock();
    expect(make).not.toHaveBeenCalled();
    on = true;
    player.unlock();
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('is one player for the whole page, however many providers mount', () => {
    expect(sharedSoundPlayer()).toBe(sharedSoundPlayer());
  });

  it('plays nothing while sound is switched off', () => {
    const ctx = fakeContext();
    const player = createSoundPlayer(
      () => ctx as never,
      () => false
    );
    player.unlock();
    expect(player.play(beep)).toBe(false);
    expect(ctx.oscillators).toBe(0);
  });

  it('fails silently without Web Audio, or when it throws', () => {
    const none = createSoundPlayer(
      () => null,
      () => true
    );
    none.unlock();
    expect(none.play(beep)).toBe(false);
    const throwing = createSoundPlayer(
      () => {
        throw new Error('no audio');
      },
      () => true
    );
    expect(() => throwing.unlock()).not.toThrow();
    expect(throwing.play(beep)).toBe(false);
    const broken = fakeContext();
    broken.createOscillator = () => {
      throw new Error('closed');
    };
    const player = createSoundPlayer(
      () => broken as never,
      () => true
    );
    player.unlock();
    expect(player.play(beep)).toBe(false);
  });
});

describe('the on/off switch', () => {
  it('is on by default, and remembers off', () => {
    expect(getSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(localStorage.getItem(SOUND_KEY)).toBe('off');
    expect(getSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(getSoundEnabled()).toBe(true);
  });
});
