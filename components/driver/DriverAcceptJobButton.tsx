'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import OtwButton from '@/components/ui/otw/OtwButton';
import { acceptJob, DRIVER_OWN_REQUEST_ERROR } from '@/app/actions/driver';

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
    startTransition(async () => {
      const result = await acceptJob(requestId);

      if (!result.ok) {
        if (result.code === 'OWN_REQUEST' || result.error.includes(DRIVER_OWN_REQUEST_ERROR)) {
          window.alert("You can't accept your own request.");
          return;
        }

        window.alert(result.error || 'Unable to accept this request right now.');
        return;
      }

      router.refresh();
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
