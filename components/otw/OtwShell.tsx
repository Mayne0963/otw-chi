import React from 'react';

export type OtwShellProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * OTW Shell: Base layout wrapper to unify page structure across public and dashboard routes.
 * - Header: nav, brand, status indicators
 * - Main: page content rendered via children
 * - Footer: global footer and system notices
 */
export function OtwShell({ header, footer, children }: OtwShellProps) {
  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr,auto] bg-white">
      {header ?? null}
      <main className="container mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      {footer ?? null}
    </div>
  );
}

export default OtwShell;
