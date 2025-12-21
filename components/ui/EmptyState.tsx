import { LucideIcon, PackageOpen } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  icon: Icon = PackageOpen, 
  actionLabel, 
  onAction,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center border border-dashed border-otw-border rounded-2xl bg-otw-panel/50", className)}>
      <div className="bg-otw-panel p-4 rounded-full mb-4">
        <Icon className="w-8 h-8 text-otw-textMuted" />
      </div>
      <h3 className="text-lg font-semibold text-otw-text mb-2">{title}</h3>
      <p className="text-otw-textMuted max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
