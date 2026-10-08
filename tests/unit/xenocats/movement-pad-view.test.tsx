// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAD_SIZE } from '@/app/ui/xenocats/movement-pad';
import { MovementPad } from '@/app/ui/xenocats/movement-pad-view';

afterEach(cleanup);

/** Renders the pad with a fixed box (jsdom has no layout): its centre at (100, 100). */
function renderPad() {
  const onDirection = vi.fn();
  render(<MovementPad onDirection={onDirection} />);
  const pad = screen.getByTestId('movement-pad');
  pad.getBoundingClientRect = () =>
    ({
      left: 100 - PAD_SIZE / 2,
      top: 100 - PAD_SIZE / 2,
      right: 100 + PAD_SIZE / 2,
      bottom: 100 + PAD_SIZE / 2,
      width: PAD_SIZE,
      height: PAD_SIZE,
    }) as DOMRect;
  // jsdom has no pointer capture.
  pad.setPointerCapture = vi.fn();
  return { pad, onDirection };
}

const touch = (x: number, y: number) => ({ pointerId: 1, clientX: x, clientY: y });

describe('the movement pad', () => {
  it('is hidden from assistive technology, and takes no part in scrolling or zooming', () => {
    const { pad } = renderPad();
    expect(pad.getAttribute('aria-hidden')).toBe('true');
    expect(pad.className).toContain('touch-none');
  });

  it('reports the way a held thumb points, each change once, and zero when let go', () => {
    const { pad, onDirection } = renderPad();
    fireEvent.pointerDown(pad, touch(150, 100));
    expect(onDirection).toHaveBeenLastCalledWith({ x: 1, y: 0 });
    expect(pad.dataset.held).toBe('true');
    // Still east: nothing new to report.
    fireEvent.pointerMove(pad, touch(160, 102));
    expect(onDirection).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(pad, touch(100, 160));
    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 1 });
    fireEvent.pointerUp(pad, touch(100, 160));
    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 0 });
    expect(pad.dataset.held).toBe('false');
  });

  it('ignores a second finger while one holds it, and stops on a cancelled touch', () => {
    const { pad, onDirection } = renderPad();
    fireEvent.pointerDown(pad, touch(150, 100));
    fireEvent.pointerDown(pad, { ...touch(50, 100), pointerId: 2 });
    fireEvent.pointerMove(pad, { ...touch(50, 100), pointerId: 2 });
    expect(onDirection).toHaveBeenLastCalledWith({ x: 1, y: 0 });
    fireEvent.pointerCancel(pad, touch(150, 100));
    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });

  it('stops the page scrolling or zooming while held, and only then', () => {
    const { pad } = renderPad();
    const swipe = () => {
      const event = new Event('touchmove', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(swipe()).toBe(false);
    fireEvent.pointerDown(pad, touch(150, 100));
    expect(swipe()).toBe(true);
    fireEvent.pointerUp(pad, touch(150, 100));
    expect(swipe()).toBe(false);
  });

  it('stops the character if it is taken off the page while held', () => {
    const { pad, onDirection } = renderPad();
    fireEvent.pointerDown(pad, touch(150, 100));
    cleanup();
    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });
});
