"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface RoleNavProps {
  items: NavItem[];
  collapsed?: boolean;
}

export function RoleNav({ items, collapsed }: RoleNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-2">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
              isActive 
                ? "bg-otw-primary text-white shadow-lg shadow-otw-primary/20" 
                : "text-otw-textMuted hover:bg-otw-panelHover hover:text-otw-text"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon 
              className={cn(
                "flex-shrink-0 w-5 h-5 transition-colors",
                isActive ? "text-white" : "text-otw-textMuted group-hover:text-otw-text",
                !collapsed && "mr-3"
              )} 
            />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
