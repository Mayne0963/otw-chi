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

const OWN_REQUEST_ERROR = 'Drivers cannot accept their own requests';

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
      try {
        await acceptJob(requestId);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Unable to accept this request right now.';

        if (message.includes(OWN_REQUEST_ERROR)) {
          window.alert("You can't accept your own request.");
          return;
        }

        window.alert(message);
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
