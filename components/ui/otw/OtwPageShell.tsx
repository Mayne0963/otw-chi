import React from 'react';

type Props = {
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function OtwPageShell({ header, children, className }: Props) {
  return (
    <div className={`relative otw-container py-6 sm:py-8 ${className ?? ''}`}>
      {header ? (
        <div className="mb-6 sm:mb-8">{header}</div>
      ) : null}
      {children}
    </div>
  );
}
