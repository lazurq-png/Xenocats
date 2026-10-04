'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type CursorController, createCursorController } from './cursor-controller';
import { type CursorKind, cursorKindFor } from './cursor-kind';
import { type CursorLook, type Effect, MAX_DECOYS, type Vec } from './effects';
import { getIntensity } from './intensity';
import { HIT_LEVELS, hitPage, hitText, pickTargets } from './page-hits';
import { createPuppetTheatre } from './puppets';
import { type Random, createRandom, freshSeed } from './random';

export type XenocatCursor = {
  /**
   * Starts `effect` from a cat centred at `cat`, on top of any still running (or
   * fused with one into a combo). False before the pointer has been seen, and, on a
   * touch screen, while another attack still hits the page.
   */
  attack(effect: Effect, cat: Vec): boolean;
  /** True while an effect runs (on a touch screen: while an attack hits the page). */
  isBusy(): boolean;
  /** Where the fake cursor is, or null before the pointer has been seen. */
  position(): Vec | null;
  /**
   * On a touch screen (no fake cursor): where the screen was last touched, or null.
   * An attack there hits only the page elements around that point.
   */
  touchPoint(): Vec | null;
  /** False while the pointer is outside the page; nobody would see an attack. */
  isPresent(): boolean;
  /** The clock the cursor runs on; cats use the same one. */
  now(): number;
  /** The page's one seeded random source, shared with the cats. */
  random: Random;
  /** Hides the fake cursor while the page draws a pointer of its own (pointer lock). */
  hide(hidden: boolean): void;
  /** True while hidden: no cat may attack a cursor nobody can see. */
  isHidden(): boolean;
};

const CursorContext = createContext<XenocatCursor | null>(null);

export function useXenocatCursor(): XenocatCursor {
  const cursor = useContext(CursorContext);
  if (!cursor) throw new Error('useXenocatCursor must be used inside <XenocatCursorProvider>.');
  return cursor;
}

export const HIDE_CURSOR_CLASS = 'xenocat-cursor-hidden';

// What each cursor element was last drawn as: a frame that would draw the same again
// writes nothing, so a cursor at rest costs no style work and no repaint.
const lastDrawn = new WeakMap<HTMLElement, string>();

/** Draws a cursor element (or one of its decoys) at `at`, looking as `look` says. */
export function placeCursor(element: HTMLElement, at: Vec, look: CursorLook) {
  const filter = [
    look.blur > 0 ? `blur(${look.blur}px)` : '',
    look.tint ? `drop-shadow(0 0 3px ${look.tint}) drop-shadow(0 0 6px ${look.tint})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const transform = `translate3d(${at.x}px, ${at.y}px, 0) scale(${look.scale})`;
  const opacity = String(look.visible ? look.opacity : 0);
  const drawn = `${transform}|${opacity}|${filter}`;
  if (lastDrawn.get(element) === drawn) return;
  lastDrawn.set(element, drawn);
  element.style.transform = transform;
  element.style.opacity = opacity;
  element.style.filter = filter;
}

/** Hides a cursor element (an unused decoy), through the same record as placeCursor. */
export function hideCursor(element: HTMLElement) {
  if (lastDrawn.get(element) === 'hidden') return;
  lastDrawn.set(element, 'hidden');
  element.style.opacity = '0';
}

/**
 * Hides the system cursor, draws a fake one that follows the pointer, and lets cats
 * attack it. Only on devices with a precise pointer: there is no cursor to fake on
 * a touch screen.
 */
export function XenocatCursorProvider({
  children,
  now = () => performance.now(),
  seed,
}: {
  children: React.ReactNode;
  /** The clock. Tests pass their own. */
  now?: () => number;
  /** Seeds the page's random source. Tests pass their own; the live page gets a fresh one. */
  seed?: number;
}) {
  const [random] = useState<Random>(() => createRandom(seed ?? freshSeed()));
  const [controller] = useState<CursorController>(() =>
    // The page's cats attack at the same time: their effects stack.
    createCursorController({ viewport: { width: 0, height: 0 }, random, stack: true })
  );
  // The page elements an attack makes puppets of the mouse (puppets.ts).
  const [theatre] = useState(() => createPuppetTheatre({ random }));
  const [enabled, setEnabled] = useState(false);
  const [kind, setKind] = useState<CursorKind>('arrow');
  const cursorRef = useRef<HTMLDivElement>(null);
  const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nowRef = useRef(now);
  const hiddenRef = useRef(false);
  // Asks for a frame of the draw loop, which sleeps while there is nothing to draw.
  const wakeRef = useRef<() => void>(() => {});
  // Puts back the page elements the running attack hit (page-hits.ts).
  const restoreHitsRef = useRef<(() => void) | null>(null);
  // Touch screens: the last touch, and until when a touch attack runs.
  const touchRef = useRef<Vec | null>(null);
  const touchUntilRef = useRef(0);
  const touchTimerRef = useRef(0);

  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const finePointer = window.matchMedia('(pointer: fine)');
    const update = () => setEnabled(finePointer.matches);
    update();
    finePointer.addEventListener('change', update);
    return () => finePointer.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;

    // The draw loop runs only while there is something to draw: the pointer moved,
    // left, or an effect is playing. A cursor at rest asks for no frames at all.
    let frameId = 0;
    const wake = () => {
      if (!frameId) frameId = requestAnimationFrame(draw);
    };
    wakeRef.current = wake;

    // A pointer moving over the same element needs no new cursor shape: the lookup
    // (three selector matches up the tree) runs only when the target changes.
    let lastTarget: EventTarget | null = null;
    const onMove = (event: PointerEvent) => {
      // Hide the system cursor only once the fake one knows where to draw: until the
      // first move after load there would otherwise be no cursor on screen at all.
      if (lastTarget === null) root.classList.add(HIDE_CURSOR_CLASS);
      controller.pointerMove({ x: event.clientX, y: event.clientY });
      if (event.target !== lastTarget) {
        lastTarget = event.target;
        setKind(cursorKindFor(event.target));
      }
      wake();
    };
    const onOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      controller.pointerLeave();
      wake();
    };
    const onBlur = () => {
      controller.pointerLeave();
      wake();
    };
    const onResize = () => {
      controller.resize({ width: window.innerWidth, height: window.innerHeight });
      wake();
    };

    // Clicks are never blocked: one made while an effect runs lands where the real
    // pointer is, not where the cursor is drawn, on whatever has moved there.
    onResize();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onOut);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);

    function draw() {
      frameId = 0;
      const time = nowRef.current();
      // The page is put back on the first frame no effect runs.
      if (restoreHitsRef.current && !controller.isActive(time)) {
        restoreHitsRef.current();
        restoreHitsRef.current = null;
      }
      // Elements attacked as the cursor is move on their own (puppets.ts); the
      // frame also frees those whose attack is over.
      theatre.frame(time, { width: window.innerWidth, height: window.innerHeight });
      const drawn = controller.frame(time);
      const look = hiddenRef.current ? { ...drawn, visible: false, decoys: undefined } : drawn;
      const place = (element: HTMLElement, at: Vec) => placeCursor(element, at, look);

      const cursor = cursorRef.current;
      if (cursor) {
        place(cursor, look);
        const effect = controller.activeEffectId(time) ?? '';
        if (cursor.dataset.effect !== effect) cursor.dataset.effect = effect;
      }
      const decoys = look.decoys ?? [];
      decoyRefs.current.forEach((decoy, i) => {
        if (!decoy) return;
        if (i < decoys.length) place(decoy, decoys[i]);
        else hideCursor(decoy);
      });
      // An effect animates on its own, and its end must still be drawn (and the page
      // put back): keep going while one plays. Otherwise sleep until woken.
      if (controller.isActive(time) || theatre.isActive(time)) wake();
    }
    wake();

    return () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      wakeRef.current = () => {};
      root.classList.remove(HIDE_CURSOR_CLASS);
      restoreHitsRef.current?.();
      restoreHitsRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled, controller, theatre]);

  // Touch screens: no fake cursor, but cats still attack the page around the last
  // touch. Taps go through, onto whatever has moved under them.
  useEffect(() => {
    if (enabled) return;
    const endTouchHit = () => {
      window.clearTimeout(touchTimerRef.current);
      touchUntilRef.current = 0;
      restoreHitsRef.current?.();
      restoreHitsRef.current = null;
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') touchRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    return () => {
      endTouchHit();
      window.removeEventListener('pointerdown', onDown, { capture: true });
    };
  }, [enabled]);

  const api = useMemo<XenocatCursor>(
    () => ({
      attack: (effect, cat) => {
        if (!enabled) {
          // A touch screen: hit the page around the last touch, for the effect's time.
          const touch = touchRef.current;
          const time = nowRef.current();
          if (!touch || time < touchUntilRef.current) return false;
          restoreHitsRef.current?.();
          restoreHitsRef.current = hitPage(document.body, effect.id, touch, cat, random);
          // Nothing near the touch: the cat pounces at nothing.
          if (!restoreHitsRef.current) return true;
          touchUntilRef.current = time + effect.durationMs;
          window.clearTimeout(touchTimerRef.current);
          touchTimerRef.current = window.setTimeout(() => {
            touchUntilRef.current = 0;
            restoreHitsRef.current?.();
            restoreHitsRef.current = null;
          }, effect.durationMs);
          return true;
        }
        const time = nowRef.current();
        if (!controller.attack(effect, cat, time)) return false;
        // Every attack also hits the page around the pointer, until no effect runs:
        // calm, with a nudge; above it, attacking the elements as it does the cursor
        // (page-hits.ts, puppets.ts). Stacked attacks pile their hits up; they are
        // put back newest first, so each element ends as it was before the first.
        const pointer = controller.position();
        const earlier = restoreHitsRef.current;
        const level = HIT_LEVELS[getIntensity()];
        let hits: (() => void) | null = null;
        if (pointer && level.puppets) {
          const targets = pickTargets(document.body, pointer, level.reach, random);
          theatre.add(targets, effect, cat, time, level.puppets);
          const text = hitText(targets, effect.id, random);
          hits = () => {
            text?.();
            theatre.clear();
          };
        } else if (pointer) {
          hits = hitPage(document.body, effect.id, pointer, cat, random);
        }
        restoreHitsRef.current =
          earlier && hits
            ? () => {
                hits();
                earlier();
              }
            : (hits ?? earlier);
        wakeRef.current();
        return true;
      },
      isBusy: () =>
        enabled ? controller.isActive(nowRef.current()) : nowRef.current() < touchUntilRef.current,
      position: () => controller.position(),
      touchPoint: () => (enabled ? null : touchRef.current),
      isPresent: () => controller.isPresent(),
      now: () => nowRef.current(),
      random,
      hide: (hidden) => {
        hiddenRef.current = hidden;
        wakeRef.current();
      },
      isHidden: () => hiddenRef.current,
    }),
    [controller, theatre, random, enabled]
  );

  const layer = 'pointer-events-none fixed left-0 top-0 z-[9999] origin-top-left';

  return (
    <CursorContext.Provider value={api}>
      {children}
      {enabled && (
        <div aria-hidden="true">
          {Array.from({ length: MAX_DECOYS }, (_, i) => (
            <div
              key={i}
              ref={(element) => {
                decoyRefs.current[i] = element;
              }}
              data-testid="fake-cursor-decoy"
              className={layer}
              style={{ opacity: 0 }}
            >
              <CursorShape kind={kind} />
            </div>
          ))}
          <div
            ref={cursorRef}
            data-testid="fake-cursor"
            data-kind={kind}
            className={layer}
            style={{ opacity: 0 }}
          >
            <CursorShape kind={kind} />
          </div>
        </div>
      )}
    </CursorContext.Provider>
  );
}

// Each shape is drawn so that its hotspot sits at the element's origin.
export function CursorShape({ kind }: { kind: CursorKind }) {
  const stroke = { stroke: '#ffffff', strokeWidth: 1.3, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'pointer':
      return (
        <svg width="22" height="24" viewBox="0 0 22 24" className="-translate-x-[7px]">
          <path
            d="M7 1.5c1.1 0 2 .9 2 2V10l1.2-.3c1-.2 1.9.3 2.2 1.2l.1.3 1.1-.2c1-.2 1.9.4 2.1 1.3l1-.1c1.1-.1 2 .7 2 1.8V17c0 3.6-2.9 6.5-6.5 6.5h-1.4c-2.2 0-4.2-1.1-5.4-2.9L2 15.2c-.6-.9-.3-2.1.6-2.6.8-.5 1.8-.3 2.4.4l0 0V3.5c0-1.1.9-2 2-2Z"
            fill="#111827"
            {...stroke}
          />
        </svg>
      );
    case 'text':
      return (
        <svg
          width="12"
          height="22"
          viewBox="0 0 12 22"
          className="-translate-x-[6px] -translate-y-[11px]"
        >
          <path
            d="M2 1.5h3l1 1 1-1h3M6 2.5v17M2 20.5h3l1-1 1 1h3"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
          />
          <path
            d="M2 1.5h3l1 1 1-1h3M6 2.5v17M2 20.5h3l1-1 1 1h3"
            fill="none"
            stroke="#111827"
            strokeWidth="1.4"
          />
        </svg>
      );
    case 'not-allowed':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" className="-translate-x-px -translate-y-px">
          <path
            d="M1 1 L1 15 L4.8 11.6 L7.4 17 L9.7 16 L7.2 10.6 L12.4 10.6 Z"
            fill="#111827"
            {...stroke}
          />
          <circle cx="15" cy="15" r="5" fill="#ffffff" stroke="#dc2626" strokeWidth="2" />
          <path d="M11.6 18.4 L18.4 11.6" stroke="#dc2626" strokeWidth="2" />
        </svg>
      );
    default:
      // The tip sits at (1, 1), so the drawn tip and the real hotspot line up.
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" className="-translate-x-px -translate-y-px">
          <path
            d="M1 1 L1 17 L5.5 13 L8.5 19.5 L11.2 18.3 L8.3 12 L14.5 12 Z"
            fill="#111827"
            {...stroke}
          />
        </svg>
      );
  }
}
