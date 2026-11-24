import type { ReactNode } from 'react';

export type BadgeVariant = 'critical' | 'major' | 'minor' | 'nit' | 'success' | 'error' | 'neutral';

const variants: Record<BadgeVariant, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  major: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  minor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  nit: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  success: 'bg-accent-100 text-accent-900',
  error: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  neutral: 'bg-background-200 text-text-800',
};

export function Badge({
  variant = 'neutral',
  children,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-xl px-2 py-0.5 text-sm font-bold ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
