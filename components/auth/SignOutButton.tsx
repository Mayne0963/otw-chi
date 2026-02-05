'use client';

import { authClient } from '@/lib/auth/client';
import OtwButton from '@/components/ui/otw/OtwButton';
import { useRouter } from 'next/navigation';

interface SignOutButtonProps {
  className?: string;
  variant?: 'gold' | 'red' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children?: React.ReactNode;
}

export function SignOutButton({ className, variant = 'ghost', size = 'md', children }: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <OtwButton 
      variant={variant} 
      size={size}
      className={className} 
      onClick={handleSignOut}
    >
      {children || 'Sign Out'}
    </OtwButton>
  );
}
