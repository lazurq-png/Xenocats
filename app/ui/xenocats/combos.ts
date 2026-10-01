// Cat combos: two cats waking close together, in place and in time, fuse their
// attacks into one combined effect (cat-engine.ts pairs them). Each combo is built
// from the two attacks it fuses, out of three pure ways of combining effects:
//
//   layer(a, b)    b applied to where a puts the cursor, while both last
//   chain(a, b)    a, then b
//   restyle(a, …)  a, with its look changed (a tint, a fade, a scale)

import {
  type CursorLook,
  type Effect,
  ICE,
  MAX_EFFECT_MS,
  blur,
  bounce,
  drunk,
  jitter,
  knockback,
  magnet,
  reverse,
  teleport,
  tiny,
} from './effects';

/** What a combined effect carries between frames: each part's own state and look. */
type Parts = { a?: unknown; b?: unknown; lookA?: CursorLook; lookB?: CursorLook };

/** `b` applied on top of `a`: `b` sees the cursor where `a` put it as the real pointer. */
export function layer(a: Effect, b: Effect): Omit<Effect<Parts>, 'id' | 'name' | 'description'> {
  return {
    // Only while both run: when one part ended first, the cursor would jump.
    durationMs: Math.min(a.durationMs, b.durationMs, MAX_EFFECT_MS),
    step(input) {
      const own = input.state ?? {};
      const first = a.step({ ...input, previous: own.lookA ?? input.previous, state: own.a });
      const second = b.step({
        ...input,
        real: { x: first.look.x, y: first.look.y },
        previous: own.lookB ?? first.look,
        state: own.b,
      });
      return {
        look: {
          ...second.look,
          visible: first.look.visible && second.look.visible,
          scale: first.look.scale * second.look.scale,
          blur: first.look.blur + second.look.blur,
          opacity: first.look.opacity * second.look.opacity,
          ...(first.look.tint || second.look.tint
            ? { tint: second.look.tint ?? first.look.tint }
            : {}),
          ...(first.look.decoys || second.look.decoys
            ? { decoys: second.look.decoys ?? first.look.decoys }
            : {}),
        },
        state: { a: first.state, b: second.state, lookA: first.look, lookB: second.look },
      };
    },
  };
}

/** `a`, then `b` for its own duration (from where `a` left the cursor). */
export function chain(a: Effect, b: Effect): Omit<Effect<Parts>, 'id' | 'name' | 'description'> {
  return {
    durationMs: Math.min(a.durationMs + b.durationMs, MAX_EFFECT_MS),
    step(input) {
      const own = input.state ?? {};
      if (input.elapsed < a.durationMs) {
        const frame = a.step({ ...input, previous: own.lookA ?? input.previous, state: own.a });
        return { look: frame.look, state: { ...own, a: frame.state, lookA: frame.look } };
      }
      // b starts as if its attack began where a left the cursor.
      const from = own.lookA ?? input.previous;
      const frame = b.step({
        ...input,
        start: { x: from.x, y: from.y },
        elapsed: input.elapsed - a.durationMs,
        previous: own.lookB ?? from,
        state: own.b,
      });
      return { look: frame.look, state: { ...own, b: frame.state, lookB: frame.look } };
    },
  };
}

/** `a` with every frame's look changed by `change`. */
export function restyle<S>(
  a: Effect<S>,
  change: (look: CursorLook, elapsed: number) => Partial<CursorLook>
): Omit<Effect<S>, 'id' | 'name' | 'description'> {
  return {
    durationMs: a.durationMs,
    amplify: a.amplify,
    step(input) {
      const frame = a.step(input);
      return { ...frame, look: { ...frame.look, ...change(frame.look, input.elapsed) } };
    },
  };
}

export type Combo = {
  /** The two attacks it fuses, by effect id (in either order). */
  pair: readonly [string, string];
  effect: Effect;
};

const combo = <S>(
  pair: readonly [string, string],
  id: string,
  name: string,
  description: string,
  parts: Omit<Effect<S>, 'id' | 'name' | 'description'>
): Combo => ({ pair, effect: { id, name, description, ...parts } });

export const COMBOS: readonly Combo[] = [
  combo(
    ['freeze', 'bounce'],
    'ice-puck',
    'Ice puck',
    'Your frosted cursor skids and ricochets off the edges like an ice puck.',
    restyle(bounce, () => ({ tint: ICE }))
  ),
  combo(
    ['knockback', 'magnet'],
    'slingshot',
    'Slingshot',
    'Your cursor is flung away, then reeled back in.',
    chain(knockback, magnet)
  ),
  combo(
    ['reverse', 'drunk'],
    'hangover',
    'Hangover',
    'Your cursor moves the wrong way and sways while it does.',
    layer(reverse, drunk)
  ),
  combo(
    ['vanish', 'teleport'],
    'ghost-jump',
    'Ghost jump',
    'A faint ghost of your cursor jumps about the screen.',
    restyle(teleport, () => ({ opacity: 0.35 }))
  ),
  combo(
    ['tiny', 'giant'],
    'pulsar',
    'Pulsar',
    'Your cursor swells to giant size and shrinks to a speck, over and over.',
    restyle(tiny, (_look, elapsed) => ({
      // Between a quarter and four times its size, about twice a second.
      scale: 4 ** Math.sin((2 * Math.PI * elapsed) / 450),
    }))
  ),
  combo(
    ['jitter', 'blur'],
    'static-fog',
    'Static fog',
    'Your cursor fizzes about in a haze.',
    // Blur leaves the cursor where jitter put it: still an offset from the pointer.
    { ...layer(jitter, blur), amplify: 'offset' }
  ),
];

/** The combo two attacks fuse into, by their effect ids, if they have one. */
export function findCombo(a: string, b: string): Combo | undefined {
  return COMBOS.find(
    ({ pair }) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a)
  );
}
