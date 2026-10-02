// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CatError from '@/app/ui/cat-error';

// The dashboard's error state (each error.tsx renders it). The not-found and
// empty states are walked in a browser (tests/e2e/cat-states.spec.ts); an error
// cannot be caused there on purpose.
afterEach(() => cleanup());

describe('CatError', () => {
  it('says something went wrong, with a cat, and Try again calls reset', () => {
    const reset = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CatError error={new Error('boom')} reset={reset} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong!' })).toBeTruthy();
    // The cat is decoration: present, but hidden from assistive technology.
    const cat = document.querySelector('img')!;
    expect(cat.getAttribute('src')).toContain('cat-login-peek');
    expect(cat.getAttribute('alt')).toBe('');
    expect(cat.getAttribute('aria-hidden')).toBe('true');
    // The error goes to the console (as before), not on the page.
    expect(error).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('boom');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
