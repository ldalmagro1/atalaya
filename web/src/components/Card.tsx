import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-background-200 bg-background-100 p-4 shadow-sm ${className}`}
      {...rest}
    />
  );
}
