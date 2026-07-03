'use client';

import { authClient } from '@/lib/auth/client';
import OtwButton from '@/components/ui/otw/OtwButton';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SignOutButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  variant?: 'gold' | 'red' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children?: React.ReactNode;
}

export function SignOutButton({
  className,
  variant = 'ghost',
  size = 'md',
  children,
  onClick,
  disabled,
  ...props
}: SignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || isSigningOut || disabled) return;

    setIsSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result?.error) {
        throw new Error(result.error.message || 'Sign out failed');
      }
      router.replace('/');
      router.refresh();
    } catch (error) {
      console.error('Sign out failed:', error);
      // Force a full navigation so auth state is re-evaluated by middleware.
      window.location.assign('/');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <OtwButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleSignOut}
      disabled={disabled || isSigningOut}
      {...props}
    >
      {children || (isSigningOut ? 'Signing Out...' : 'Sign Out')}
    </OtwButton>
  );
}
