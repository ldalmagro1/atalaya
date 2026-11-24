import { Link, Outlet } from 'react-router-dom';
import { PROJECT_NAME } from '@atalaya/contracts';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'claro' : 'oscuro';

  return (
    <div className="min-h-screen">
      <header className="border-b border-background-200 bg-background-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="font-heading text-xl font-bold text-text-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            {PROJECT_NAME}
          </Link>
          <Button
            variant="ghost"
            aria-label={`Cambiar a tema ${next}`}
            title={`Cambiar a tema ${next}`}
            onClick={toggleTheme}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
