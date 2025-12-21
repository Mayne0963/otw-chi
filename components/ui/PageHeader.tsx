import { cn } from '@/lib/cn';
import { Button } from './Button';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8", className)}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-otw-text">{title}</h1>
        {description && <p className="mt-2 text-otw-textMuted">{description}</p>}
      </div>
      {action && (
        action.href ? (
          <Button asChild variant="default">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button onClick={action.onClick} variant="default">
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
