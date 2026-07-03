'use client';

import { useState } from 'react';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { trackOtwEvent, type OtwServiceType } from '@/lib/analytics/otwTrack';

export type OtwLeadInterestType =
  | 'SERVICE_REQUEST'
  | 'MEMBERSHIP_INTEREST'
  | 'DRIVER_INTEREST'
  | 'BUSINESS_ACCOUNT'
  | 'FRAGILE_DELIVERY'
  | 'STORE_PICKUP'
  | 'FOOD_DELIVERY'
  | 'ERRAND_SERVICE'
  | 'PEER_TO_PEER_DELIVERY'
  | 'GENERAL_CONTACT'
  | 'LAUNCH_LIST';

export default function OtwLeadCaptureCard({
  title,
  subtitle,
  interestType,
  serviceType,
  ctaLabel = 'Submit',
  compact = false,
}: {
  title: string;
  subtitle?: string;
  interestType: OtwLeadInterestType;
  serviceType?: OtwServiceType;
  ctaLabel?: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (loading) return;
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedEmail && !trimmedPhone) {
      toast({
        title: 'Email or phone required',
        description: 'Enter an email address or phone number so we can follow up.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim() || undefined,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined,
        interestType,
        serviceType: serviceType ?? undefined,
        sourcePage: window.location.pathname,
        message: trimmedMessage || undefined,
        metadata: {
          compact,
        },
      };

      const res = await fetch('/api/otw/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Lead submission failed (${res.status})`);
      }

      toast({
        title: 'Thanks',
        description: 'We received your info and will follow up soon.',
      });

      void trackOtwEvent('CONTACT_SUBMITTED', {
        page: window.location.pathname,
        serviceType: serviceType ?? undefined,
        metadata: { interestType },
      });

      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (error) {
      toast({
        title: 'Unable to submit',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <OtwCard className="bg-card/50 border-white/5">
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <div className="text-lg font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Name (optional)</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Email</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Phone (optional)</div>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Message (optional)</div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What do you need help with?"
              className="min-h-[90px]"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <OtwButton onClick={() => void submit()} disabled={loading} variant="gold">
            {loading ? 'Sending...' : ctaLabel}
          </OtwButton>
        </div>
      </div>
    </OtwCard>
  );
}

