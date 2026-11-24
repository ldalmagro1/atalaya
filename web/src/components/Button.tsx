import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

// El texto del primario es oscuro y fijo en ambos temas (contraste >= 6:1). El hover aclara
// el fondo (400 en claro, 600 en oscuro, donde la escala está invertida) para no perder contraste.
const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 hover:bg-primary-400 dark:hover:bg-primary-600 text-[rgb(12,13,13)] font-bold',
  secondary: 'bg-background-200 hover:bg-background-300 text-text-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white font-bold dark:bg-red-700 dark:hover:bg-red-600',
  ghost: 'hover:bg-background-200 text-text-800',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
