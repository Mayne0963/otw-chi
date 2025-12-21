import { cn } from '@/lib/cn';
import { LucideIcon } from 'lucide-react';

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T>({ 
  data, 
  columns, 
  keyExtractor, 
  emptyMessage = "No data available",
  onRowClick,
  className 
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center p-8 text-otw-textMuted bg-otw-panel rounded-2xl border border-otw-border">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-otw-border bg-otw-panel", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-otw-border bg-otw-panelHover">
              {columns.map((col, idx) => (
                <th key={idx} className={cn("p-4 font-medium text-otw-textMuted", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-otw-border">
            {data.map((item) => (
              <tr 
                key={keyExtractor(item)} 
                className={cn("transition-colors hover:bg-otw-panelHover/50", onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col, idx) => (
                  <td key={idx} className={cn("p-4 text-otw-text", col.className)}>
                    {col.cell ? col.cell(item) : (item[col.accessorKey as keyof T] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
