export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-text-600">
      <svg
        className="h-5 w-5 animate-spin text-accent-600"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-25"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span>{label}</span>
    </span>
  );
}
