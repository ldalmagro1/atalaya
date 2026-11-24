import type { ReactNode } from 'react';

export function ErrorBox({
  title = 'Algo salió mal',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-100 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <p className="font-bold">{title}</p>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
