'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import OtwButton from '@/components/ui/otw/OtwButton';

type BackNavButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export function BackNavButton({
  fallbackHref = '/',
  label = 'Back',
  className,
}: BackNavButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <OtwButton type="button" variant="ghost" size="sm" className={className} onClick={handleBack}>
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </OtwButton>
  );
}
