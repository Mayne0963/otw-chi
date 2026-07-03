'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import OtwButton from '@/components/ui/otw/OtwButton';
import { acceptJob } from '@/app/actions/driver';

type DriverAcceptJobButtonProps = {
  requestId: string;
  label?: string;
  variant?: 'gold' | 'red' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  className?: string;
};

export default function DriverAcceptJobButton({
  requestId,
  label = 'Accept',
  variant = 'outline',
  size = 'md',
  className,
}: DriverAcceptJobButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAccept = () => {
    const restoreScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const restoreScrollX = typeof window !== 'undefined' ? window.scrollX : 0;
    startTransition(async () => {
      const result = await acceptJob(requestId);

      if (!result.ok) {
        if (result.code === 'OWN_REQUEST') {
          window.alert("You can't accept your own request.");
          return;
        }

        window.alert(result.error || 'Unable to accept this request right now.');
        return;
      }

      if (typeof document !== 'undefined') {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }
      }
      router.refresh();
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          window.scrollTo({ top: restoreScrollY, left: restoreScrollX, behavior: 'auto' });
        });
        window.setTimeout(() => {
          window.scrollTo({ top: restoreScrollY, left: restoreScrollX, behavior: 'auto' });
        }, 120);
      }
    });
  };

  return (
    <OtwButton
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleAccept}
      disabled={isPending}
    >
      {isPending ? 'Accepting...' : label}
    </OtwButton>
  );
}
