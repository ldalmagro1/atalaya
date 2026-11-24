export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'atalaya-theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Tema guardado, o el del sistema (`prefers-color-scheme`) si no hay ninguno válido. */
export function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // localStorage puede estar bloqueado; se sigue con el valor del sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin persistencia: el tema vale solo para esta sesión.
  }
}
