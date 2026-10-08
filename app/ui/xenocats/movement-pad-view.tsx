'use client';

import { useEffect, useRef, useState } from 'react';
import type { Vec } from './effects';
import { KNOB_SIZE, PAD_SIZE, knobOffset, padDirection } from './movement-pad';

/**
 * The movement pad for touch screens (movement-pad.ts): a thumb held on it walks
 * the character the way WASD does, and `onDirection` hears every change of way,
 * zero when it is let go. Hidden from assistive technology like the rest of a
 * game's visuals: the keyboard is the accessible way to walk. While it is held the
 * page neither scrolls nor zooms.
 */
export function MovementPad({
  onDirection,
  className,
}: {
  onDirection: (direction: Vec) => void;
  className?: string;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<Vec>({ x: 0, y: 0 });
  const [held, setHeld] = useState(false);
  const lastRef = useRef<Vec>({ x: 0, y: 0 });
  const pointerRef = useRef<number | null>(null);
  // The latest listener, without re-running the effects below when it changes.
  const onDirectionRef = useRef(onDirection);
  useEffect(() => {
    onDirectionRef.current = onDirection;
  }, [onDirection]);

  const report = (direction: Vec) => {
    const last = lastRef.current;
    if (last.x === direction.x && last.y === direction.y) return;
    lastRef.current = direction;
    onDirectionRef.current(direction);
  };

  const follow = (event: React.PointerEvent) => {
    const pad = padRef.current;
    if (!pad) return;
    const box = pad.getBoundingClientRect();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const touch = { x: event.clientX, y: event.clientY };
    const radius = box.width / 2;
    setKnob(knobOffset(touch, centre, radius));
    report(padDirection(touch, centre, radius));
  };

  const release = () => {
    pointerRef.current = null;
    setHeld(false);
    setKnob({ x: 0, y: 0 });
    report({ x: 0, y: 0 });
  };

  // A second finger elsewhere on the page would still pinch-zoom it, and a swipe
  // that wandered off the pad would scroll it: neither while the pad is held.
  useEffect(() => {
    if (!held) return;
    const stop = (event: TouchEvent) => event.preventDefault();
    document.addEventListener('touchmove', stop, { passive: false });
    return () => document.removeEventListener('touchmove', stop);
  }, [held]);

  // Taken off the page while held: the character stops.
  useEffect(() => () => onDirectionRef.current({ x: 0, y: 0 }), []);

  return (
    <div
      ref={padRef}
      aria-hidden="true"
      data-testid="movement-pad"
      data-held={held}
      className={`relative touch-none select-none rounded-full border-2 border-line bg-panel/70 ${className ?? ''}`}
      style={{ width: PAD_SIZE, height: PAD_SIZE }}
      onPointerDown={(event) => {
        if (pointerRef.current !== null) return;
        pointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setHeld(true);
        follow(event);
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointerRef.current) follow(event);
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointerRef.current) release();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointerRef.current) release();
      }}
    >
      <div
        className="absolute rounded-full bg-plasma/80 shadow-[0_0_12px_rgba(193,232,56,0.5)]"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: PAD_SIZE / 2 - KNOB_SIZE / 2 - 2,
          top: PAD_SIZE / 2 - KNOB_SIZE / 2 - 2,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
}
