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
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Drivers', href: '/admin/drivers', icon: Truck },
  { label: 'Cities & Zones', href: '/admin/cities-zones', icon: Map },
  { label: 'Requests', href: '/admin/requests', icon: Package },
  { label: 'Payouts', href: '/admin/payouts', icon: DollarSign },
  { label: 'NIP Ledger', href: '/admin/nip-ledger', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
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
