'use client';

import { useTransition } from 'react';
import { cancelOrderAction } from '@/app/actions/request';
import { useToast } from '@/components/ui/use-toast';
import OtwButton from '@/components/ui/otw/OtwButton';
import { XCircle } from 'lucide-react';

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleCancel = () => {
    if (
      !confirm(
        'Cancel this request and submit a refund request? This action cannot be undone.'
      )
    ) {
        return;
    }
    startTransition(async () => {
      try {
        await cancelOrderAction(orderId);
        toast({
          title: 'Cancellation Requested',
          description: 'Your request was canceled and your refund request was submitted.',
          variant: 'default',
        });
      } catch (error) {
        toast({
          title: 'Cancellation Failed',
          description: error instanceof Error ? error.message : 'Something went wrong',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <OtwButton 
        variant="red" 
        onClick={handleCancel} 
        disabled={isPending}
        className="w-full"
    >
      <XCircle className="h-4 w-4 mr-2" />
      {isPending ? 'Cancelling...' : 'Cancel and Request Refund'}
    </OtwButton>
  );
}
