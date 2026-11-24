import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { Button } from './Button';
import { Spinner } from './Spinner';

/** Muestra la salud agregada del gateway; informa si el gateway o alguna herramienta no responde. */
export function HealthBanner() {
  const { data, error, loading, reload } = useAsync((signal) => api.health(signal));

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-background-200 bg-background-100 p-3">
        <Spinner label="Comprobando el estado de la plataforma…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-100 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        <p>
          <span className="font-bold">El gateway no responde.</span> Comprueba que esté en marcha (
          <span className="font-mono text-sm">npm run dev</span>).
        </p>
        <Button variant="secondary" onClick={reload}>
          Reintentar
        </Button>
      </div>
    );
  }

  const down = data.tools.filter((tool) => !tool.ok);
  if (down.length === 0) {
    return (
      <div
        role="status"
        className="rounded-xl border border-accent-300 bg-accent-100 p-3 text-accent-900"
      >
        Todas las herramientas responden.
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-100 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <p>
        <span className="font-bold">Herramientas que no responden:</span>{' '}
        {down.map((tool) => tool.id).join(', ')}.
      </p>
      <Button variant="secondary" onClick={reload}>
        Reintentar
      </Button>
    </div>
  );
}
