// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vanish } from '@/app/ui/xenocats/effects';
import {
  HIDE_CURSOR_CLASS,
  type XenocatCursor,
  XenocatCursorProvider,
  useXenocatCursor,
} from '@/app/ui/xenocats/fake-cursor';

function mockPointer(fine: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: fine,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

let clock = 0;
let cursor: XenocatCursor;

function CaptureCursor() {
  const current = useXenocatCursor();
  useEffect(() => {
    cursor = current;
  }, [current]);
  return null;
}

function renderPage(onClick = vi.fn()) {
  render(
    <XenocatCursorProvider now={() => clock}>
      <CaptureCursor />
      <button onClick={onClick}>Save</button>
    </XenocatCursorProvider>
  );
  return onClick;
}

beforeEach(() => {
  clock = 0;
});

afterEach(() => {
  cleanup();
});

describe('XenocatCursorProvider', () => {
  it('keeps the system cursor until the pointer moves, so there is always a cursor', () => {
    mockPointer(true);
    renderPage();
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(false);
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(true);
  });

  it('draws a fake cursor hidden from assistive technology', () => {
    mockPointer(true);
    renderPage();
    // The cursor and its decoys sit inside one aria-hidden layer.
    expect(screen.getByTestId('fake-cursor').closest('[aria-hidden="true"]')).not.toBeNull();
    for (const decoy of screen.getAllByTestId('fake-cursor-decoy')) {
      expect(decoy.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('gives the system cursor back when it unmounts', () => {
    mockPointer(true);
    renderPage();
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    cleanup();
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(false);
  });

  it('does nothing on a touch screen', () => {
    mockPointer(false);
    renderPage();
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(false);
    expect(screen.queryByTestId('fake-cursor')).toBeNull();
  });

  it('blocks clicks while an effect runs, and only then', () => {
    mockPointer(true);
    const onClick = renderPage();
    fireEvent.pointerMove(window, { clientX: 50, clientY: 60 });

    fireEvent.click(screen.getByText('Save'), { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);

    act(() => {
      expect(cursor.attack(vanish, { x: 0, y: 0 })).toBe(true);
    });
    expect(cursor.isBusy()).toBe(true);
    fireEvent.click(screen.getByText('Save'), { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);

    clock = vanish.durationMs;
    expect(cursor.isBusy()).toBe(false);
    fireEvent.click(screen.getByText('Save'), { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('never blocks the keyboard', () => {
    mockPointer(true);
    const onKeyDown = vi.fn();
    render(
      <XenocatCursorProvider now={() => clock}>
        <CaptureCursor />
        <input aria-label="Amount" onKeyDown={onKeyDown} />
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('lets keyboard activation through during an effect: Enter/Space clicks, submit, menu key', () => {
    mockPointer(true);
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onContextMenu = vi.fn();
    render(
      <XenocatCursorProvider now={() => clock}>
        <CaptureCursor />
        <form onSubmit={onSubmit}>
          <input aria-label="Search" onContextMenu={onContextMenu} />
          <button onClick={onClick}>Save</button>
        </form>
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    // Keyboard-made events carry detail 0: they must reach the page.
    fireEvent.click(screen.getByText('Save'), { detail: 0 });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.contextMenu(screen.getByLabelText('Search'), { detail: 0 });
    expect(onContextMenu).toHaveBeenCalledTimes(1);
    // The same click made by the pointer is blocked.
    fireEvent.click(screen.getByText('Save'), { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('never lets an unfinished pointer press swallow a later keyboard activation', () => {
    mockPointer(true);
    const onClick = renderPage();
    const save = screen.getByText('Save');
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    fireEvent.pointerDown(save); // a press that never produces a click
    clock = vanish.durationMs + 100;
    fireEvent.click(save, { detail: 0 }); // Enter on the focused button
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forgets a press the browser cancelled', () => {
    mockPointer(true);
    const onClick = renderPage();
    const save = screen.getByText('Save');
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    fireEvent.pointerDown(save);
    fireEvent.pointerCancel(save);
    clock = vanish.durationMs + 100;
    fireEvent.click(save, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lets keyboard text selection start during an effect', () => {
    mockPointer(true);
    render(
      <XenocatCursorProvider now={() => clock}>
        <CaptureCursor />
        <p>text</p>
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    const event = new Event('selectstart', { bubbles: true, cancelable: true });
    screen.getByText('text').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('refuses a second attack while one runs', () => {
    mockPointer(true);
    renderPage();
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      expect(cursor.attack(vanish, { x: 0, y: 0 })).toBe(true);
      expect(cursor.attack(vanish, { x: 0, y: 0 })).toBe(false);
    });
  });

  it('swallows a press that began during an effect, even if it ends after', () => {
    mockPointer(true);
    const onClick = renderPage();
    const save = screen.getByText('Save');
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    fireEvent.pointerDown(save);
    fireEvent.mouseDown(save);
    clock = vanish.durationMs + 100; // the effect is over before the button is released
    fireEvent.pointerUp(save);
    fireEvent.mouseUp(save);
    fireEvent.click(save, { detail: 1 });
    expect(onClick).not.toHaveBeenCalled();
    // The next, ordinary press works again.
    fireEvent.pointerDown(save);
    fireEvent.click(save, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks drag-and-drop during an effect', () => {
    mockPointer(true);
    const onDrop = vi.fn();
    render(
      <XenocatCursorProvider now={() => clock}>
        <CaptureCursor />
        <div data-testid="target" onDrop={onDrop} />
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    fireEvent.drop(screen.getByTestId('target'));
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('shares one seeded random source, so a seed repeats the same numbers', () => {
    mockPointer(true);
    const draws: number[][] = [];
    for (let i = 0; i < 2; i++) {
      render(
        <XenocatCursorProvider now={() => clock} seed={123}>
          <CaptureCursor />
        </XenocatCursorProvider>
      );
      draws.push([cursor.random.next(), cursor.random.next()]);
      cleanup();
    }
    expect(draws[0]).toEqual(draws[1]);
  });

  it('draws room for decoy cursors, all hidden until an effect places them', () => {
    mockPointer(true);
    renderPage();
    const decoys = screen.getAllByTestId('fake-cursor-decoy');
    expect(decoys).toHaveLength(4);
    for (const decoy of decoys) expect(decoy.style.opacity).toBe('0');
  });

  it('hides the fake cursor when the pointer leaves the page, and matches what it hovers', async () => {
    mockPointer(true);
    renderPage();
    const fake = screen.getByTestId('fake-cursor');
    fireEvent.pointerMove(screen.getByText('Save'), { clientX: 5, clientY: 5 });
    await waitFor(() => expect(fake.style.opacity).toBe('1'));
    expect(fake.dataset.kind).toBe('pointer');
    fireEvent.pointerOut(document.body, { relatedTarget: null });
    await waitFor(() => expect(fake.style.opacity).toBe('0'));
  });
  it('every attack also hits the page near the pointer, and puts it back exactly when it ends', async () => {
    mockPointer(true);
    renderPage();
    const save = screen.getByText('Save');
    save.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
    const before = save.outerHTML;
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(cursor.position()).not.toBeNull());
    act(() => {
      cursor.attack(vanish, { x: 300, y: 300 });
    });
    expect(save.getAttribute('data-xenocat-hit')).toBe('blur');
    clock = vanish.durationMs - 1;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(save.getAttribute('data-xenocat-hit')).toBe('blur');
    clock = vanish.durationMs;
    await waitFor(() => expect(save.outerHTML).toBe(before));
  });

  it('puts the page back if it goes away mid-attack', async () => {
    mockPointer(true);
    renderPage();
    const save = screen.getByText('Save');
    save.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(cursor.position()).not.toBeNull());
    act(() => {
      cursor.attack(vanish, { x: 300, y: 300 });
    });
    expect(save.hasAttribute('data-xenocat-hit')).toBe(true);
    // Unmounting the provider removes the button too; keep a handle and check it.
    cleanup();
    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
  });
});
