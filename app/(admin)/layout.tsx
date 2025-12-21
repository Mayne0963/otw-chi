import { AppShell } from '@/components/layout/AppShell';
import { RoleNav } from '@/components/layout/RoleNav';
import { requireRole } from '@/lib/authz';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  Map, 
  Package, 
  DollarSign, 
  FileText, 
  Settings 
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Drivers', href: '/drivers', icon: Truck },
  { label: 'Cities & Zones', href: '/cities-zones', icon: Map },
  { label: 'Requests', href: '/requests', icon: Package },
  { label: 'Payouts', href: '/payouts', icon: DollarSign },
  { label: 'NIP Ledger', href: '/nip-ledger', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['ADMIN']);

  return (
    <AppShell 
      title="Admin Panel"
      nav={<RoleNav items={navItems} />}
    >
      {children}
    </AppShell>
  );
}
