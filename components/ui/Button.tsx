import React from 'react';
import clsx from 'clsx';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

/**
 * Basic OTW button – no business logic, purely presentational.
 */
export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-otw.primary text-white hover:bg-blue-600 focus:ring-blue-600',
    secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 focus:ring-neutral-400',
    ghost: 'bg-transparent text-neutral-900 hover:bg-neutral-100 focus:ring-neutral-300'
  };

  return <button className={clsx(base, variants[variant], className)} {...props} />;
}

export default Button;
