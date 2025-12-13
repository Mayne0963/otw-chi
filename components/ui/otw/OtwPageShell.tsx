import React from 'react';

type Props = {
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function OtwPageShell({ header, children, className }: Props) {
  return (
    <div className={`relative mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-8 py-6 sm:py-8 ${className ?? ''}`}>
      {header ? (
        <div className="mb-6 sm:mb-8">{header}</div>
      ) : null}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="h-full w-full opacity-[0.35] bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(800px_circle_at_80%_20%,rgba(176,0,23,0.14),transparent_50%)]" />
      </div>
      {children}
    </div>
  );
}

