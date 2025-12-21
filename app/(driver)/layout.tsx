import { AppShell } from '@/components/layout/AppShell';
import { RoleNav } from '@/components/layout/RoleNav';
import { requireRole } from '@/lib/authz';
import { 
  LayoutDashboard, 
  Truck, 
  DollarSign, 
  User 
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Jobs', href: '/jobs', icon: Truck },
  { label: 'Earnings', href: '/earnings', icon: DollarSign },
  { label: 'Profile', href: '/profile', icon: User },
];

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['DRIVER', 'ADMIN']);

  return (
    <AppShell 
      title="Driver Portal"
      nav={<RoleNav items={navItems} />}
    >
      {children}
    </AppShell>
  );
}
