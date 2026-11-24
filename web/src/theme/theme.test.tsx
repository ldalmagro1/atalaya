import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInitialTheme } from './theme';
import { ThemeProvider, useTheme } from './ThemeProvider';

function stubSystemDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );
}

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tema', () => {
  it('toma prefers-color-scheme como valor inicial', () => {
    stubSystemDark(true);
    expect(getInitialTheme()).toBe('dark');
    stubSystemDark(false);
    expect(getInitialTheme()).toBe('light');
  });

  it('prefiere el valor guardado', () => {
    stubSystemDark(true);
    window.localStorage.setItem('atalaya-theme', 'light');
    expect(getInitialTheme()).toBe('light');
  });

  it('ignora un valor guardado inválido', () => {
    stubSystemDark(false);
    window.localStorage.setItem('atalaya-theme', 'violeta');
    expect(getInitialTheme()).toBe('light');
  });

  it('funciona aunque localStorage falle', () => {
    stubSystemDark(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(getInitialTheme()).toBe('dark');
  });

  it('alterna la clase dark en <html> y persiste', async () => {
    stubSystemDark(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await act(async () => {
      await userEvent.click(screen.getByRole('button'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('atalaya-theme')).toBe('dark');
    await act(async () => {
      await userEvent.click(screen.getByRole('button'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('no se rompe si guardar falla', async () => {
    stubSystemDark(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota');
    });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await act(async () => {
      await userEvent.click(screen.getByRole('button'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
