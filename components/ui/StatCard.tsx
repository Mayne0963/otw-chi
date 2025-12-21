import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn("bg-otw-panel p-6 rounded-2xl border border-otw-border shadow-otwSoft", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-otw-textMuted font-medium text-sm">{title}</h3>
        {Icon && <Icon className="text-otw-primary w-5 h-5" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-otw-text">{value}</span>
        {trend && (
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", 
            trendUp ? "bg-otw-success/20 text-otw-success" : "bg-otw-error/20 text-otw-error"
          )}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
