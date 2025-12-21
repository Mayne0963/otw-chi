import { AppShell } from '@/components/layout/AppShell';
import { RoleNav } from '@/components/layout/RoleNav';
import { requireUser } from '@/lib/authz';
import { 
  LayoutDashboard, 
  Package, 
  Wallet, 
  Crown, 
  User 
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Requests', href: '/requests', icon: Package },
  { label: 'Wallet', href: '/wallet/nip', icon: Wallet },
  { label: 'Membership', href: '/membership', icon: Crown },
  { label: 'Profile', href: '/profile', icon: User },
];

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <AppShell 
      title="Customer Portal"
      nav={<RoleNav items={navItems} />}
    >
      {children}
    </AppShell>
  );
}
