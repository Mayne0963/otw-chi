'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, ChevronUp, Package, ShieldCheck, ShoppingBag, Truck, Users } from 'lucide-react';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwLeadCaptureCard from '@/components/analytics/OtwLeadCaptureCard';
import { trackOtwEvent, type OtwServiceType } from '@/lib/analytics/otwTrack';

type ServiceCard = {
  serviceType: OtwServiceType;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  bullets: string[];
};

export const dynamic = 'force-dynamic';

export default function ServicesPage() {
  const router = useRouter();
  const cards = useMemo<ServiceCard[]>(
    () => [
      {
        serviceType: 'FOOD_DELIVERY',
        title: 'Food Pickup',
        subtitle: 'Hot food pickup and handoff, handled like concierge.',
        icon: ShoppingBag,
        bullets: ['Pickup only (no hidden markups)', 'Fast handoff', 'Real-time tracking'],
      },
      {
        serviceType: 'STORE_PICKUP',
        title: 'Store / Grocery Pickup',
        subtitle: 'Errands and store pickups that keep your day moving.',
        icon: Package,
        bullets: ['Retail and grocery pickup', 'Multiple stops on eligible plans', 'Proof of delivery'],
      },
      {
        serviceType: 'FRAGILE_ITEM',
        title: 'Fragile Delivery',
        subtitle: 'White-glove handling for items that cannot be damaged.',
        icon: ShieldCheck,
        bullets: ['Care-first handling', 'Extra communication', 'Photo confirmations'],
      },
      {
        serviceType: 'PERSONAL_ERRAND',
        title: 'Personal Errands',
        subtitle: 'Custom requests, professional coordination.',
        icon: Truck,
        bullets: ['Errand running', 'Drop-offs and returns', 'Time-saving concierge'],
      },
      {
        serviceType: 'PEER_TO_PEER',
        title: 'Peer-to-Peer Delivery',
        subtitle: 'Deliver something to a friend, client, or teammate.',
        icon: Users,
        bullets: ['Fast local handoff', 'Tracking link', 'Secure confirmation'],
      },
      {
        serviceType: 'RIDE_SERVICE',
        title: 'Ride Service',
        subtitle: 'Comfortable rides when you need to move quickly.',
        icon: Truck,
        bullets: ['Simple pickup and drop-off', 'Professional drivers', 'Reliable timing'],
      },
    ],
    [],
  );

  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggleDetails = (serviceType: OtwServiceType) => {
    setOpen((current) => {
      const next = { ...current, [serviceType]: !current[serviceType] };
      return next;
    });

    void trackOtwEvent('SERVICE_VIEW', {
      page: '/services',
      serviceType,
      metadata: { source: 'services_page' },
    });
  };

  const requestService = (serviceType: OtwServiceType) => {
    void trackOtwEvent('SERVICE_SELECTED', {
      page: '/services',
      serviceType,
      metadata: { source: 'services_page', action: 'request_service' },
    });
    void trackOtwEvent('CTA_CLICK', {
      page: '/services',
      serviceType,
      metadata: { ctaId: 'services_request', ctaLocation: `services_card_${serviceType}` },
    });
    router.push('/order');
  };

  return (
    <div className="otw-container space-y-10 py-6 sm:py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight">OTW Services</h1>
        <p className="text-white/70 max-w-2xl mx-auto">
          Concierge-style delivery and service miles for the tasks that slow your day down.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          const isOpen = Boolean(open[card.serviceType]);
          return (
            <OtwCard key={card.serviceType} className="bg-card/50 border-white/5">
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-otwGold/10 text-otwGold">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{card.title}</div>
                    <div className="text-sm text-muted-foreground">{card.subtitle}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <OtwButton
                    variant="ghost"
                    className="justify-start text-otwGold px-0"
                    onClick={() => toggleDetails(card.serviceType)}
                  >
                    {isOpen ? (
                      <>
                        Hide details <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Learn more <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </OtwButton>
                  <OtwButton variant="gold" onClick={() => requestService(card.serviceType)}>
                    Request this service <ArrowRight className="h-4 w-4" />
                  </OtwButton>
                </div>

                {isOpen ? (
                  <ul className="space-y-2 text-sm text-white/70">
                    {card.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-otwGold/70" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </OtwCard>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto">
        <OtwLeadCaptureCard
          title="Request a Service (No Pressure)"
          subtitle="If you are not ready to submit a request yet, leave your info and we will follow up."
          interestType="SERVICE_REQUEST"
          ctaLabel="Send Request Interest"
        />
      </div>
    </div>
  );
}

