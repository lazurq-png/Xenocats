// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SURVIVAL_AIM_KEY, parseAim, readAim, writeAim } from '@/app/ui/xenocats/arena-storage';
import { GameSettings } from '@/app/ui/xenocats/game-settings';
import { SOUND_KEY } from '@/app/ui/xenocats/sounds';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the aim setting, stored', () => {
  it('is automatic unless the crosshair was chosen; anything unreadable is automatic', () => {
    expect(parseAim(null)).toBe('auto');
    expect(parseAim('crosshair')).toBe('crosshair');
    expect(parseAim('auto')).toBe('auto');
    expect(parseAim('CROSSHAIR')).toBe('auto');
    expect(parseAim('{"x":1}')).toBe('auto');
  });

  it('is kept in the browser, under its own key', () => {
    expect(readAim()).toBe('auto');
    writeAim('crosshair');
    expect(localStorage.getItem(SURVIVAL_AIM_KEY)).toBe('crosshair');
    expect(readAim()).toBe('crosshair');
    writeAim('auto');
    expect(readAim()).toBe('auto');
  });
});

describe('Survival’s settings', () => {
  it('a computer gets Sound and Aim; switching them stores the site’s and the game’s settings', () => {
    render(<GameSettings where="lobby" touch={false} />);
    const sound = screen.getByRole('checkbox', { name: 'Sound' });
    expect((sound as HTMLInputElement).checked).toBe(true);
    fireEvent.click(sound);
    expect(localStorage.getItem(SOUND_KEY)).toBe('off');
    expect((screen.getByRole('checkbox', { name: 'Sound' }) as HTMLInputElement).checked).toBe(
      false
    );

    const crosshair = screen.getByRole('radio', { name: /^Crosshair/ });
    expect((screen.getByRole('radio', { name: /^Automatic/ }) as HTMLInputElement).checked).toBe(
      true
    );
    fireEvent.click(crosshair);
    expect(localStorage.getItem(SURVIVAL_AIM_KEY)).toBe('crosshair');
    expect((screen.getByRole('radio', { name: /^Crosshair/ }) as HTMLInputElement).checked).toBe(
      true
    );
  });

  it('a touch screen gets Sound and Graphics but no Aim: it has no pointer to aim with', () => {
    render(<GameSettings where="pause" touch />);
    expect(screen.getByRole('checkbox', { name: 'Sound' })).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('data-testid'))).toEqual([
      'survival-pause-graphics-full',
      'survival-pause-graphics-light',
    ]);
    expect(screen.queryByTestId('survival-pause-aim-crosshair')).toBeNull();
  });

  it('the lobby and the pause menu show the same setting', () => {
    render(
      <>
        <GameSettings where="lobby" touch={false} />
        <GameSettings where="pause" touch={false} />
      </>
    );
    fireEvent.click(screen.getByTestId('survival-pause-sound'));
    expect((screen.getByTestId('survival-lobby-sound') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId('survival-lobby-aim-crosshair'));
    expect((screen.getByTestId('survival-pause-aim-crosshair') as HTMLInputElement).checked).toBe(
      true
    );
  });
});
