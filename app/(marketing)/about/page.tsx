import { Check, Compass, Package, Shield, Zap } from 'lucide-react';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwCard from '@/components/ui/otw/OtwCard';

const VALUE_CARDS = [
  {
    title: 'Precision Dispatch',
    description: 'Every pickup is routed with clear handoffs and real-time accountability.',
    icon: Compass,
  },
  {
    title: 'Protected Deliveries',
    description: 'Verified drivers and clear service windows keep high-value runs safe.',
    icon: Shield,
  },
  {
    title: 'Concierge Momentum',
    description: 'Fast handoffs, proactive updates, and a premium customer finish.',
    icon: Zap,
  },
];

const TIMELINE = [
  {
    title: 'Request arrives',
  },
  {
    title: 'Driver matched',
  },
  {
    title: 'Live tracking',
  },
  {
    title: 'Delivery complete',
  },
];

export default function AboutPage() {
  return (
    <div className="otw-container otw-section space-y-16">
      <section className="otw-inverse-surface relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#141518_0%,#050506_58%,rgba(191,149,63,0.28)_100%)] p-10 sm:p-14 shadow-otwElevated">
        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-otwGold/20 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-secondary/12 blur-3xl" />
        <div className="relative space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.25em] text-white/60">
            <Package className="h-3.5 w-3.5 text-otwGold" />
            On The Way
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Built for premium deliveries that never feel random.
          </h1>
          <p className="text-lg text-white/70">
            OTW connects concierge-level service with modern dispatching. We obsess over
            reliability, communication, and speed so every delivery feels intentional.
          </p>
          <div className="flex flex-wrap gap-3">
            <OtwButton as="a" href="/order" variant="gold">
              Order Now
            </OtwButton>
            <OtwButton as="a" href="/driver/apply" variant="outline">
              Become a Driver
            </OtwButton>
          </div>
        </div>
      </section>

      <section className="max-w-3xl">
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold text-otwOffWhite">Our mission</h2>
          <p className="text-white/70">
            We believe local delivery should feel like a white-glove service. Our dispatch
            model pairs customer expectations with driver focus, creating a consistent
            experience from the first tap to the final handoff.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {['Member-first pricing', 'Driver-first clarity', 'Live status transparency', 'Fort Wayne focused'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                <Check className="h-4 w-4 text-otwGold" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-semibold text-otwOffWhite">What makes OTW different</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {VALUE_CARDS.map((value) => {
            const Icon = value.icon;
            return (
              <OtwCard key={value.title} className="bg-black/40">
                <div className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-otwGold/15 text-otwGold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-otwOffWhite">{value.title}</h3>
                  <p className="text-sm text-white/70">{value.description}</p>
                </div>
              </OtwCard>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] items-start">
        <OtwCard className="bg-white/5">
          <h3 className="text-xl font-semibold text-otwOffWhite">How it works</h3>
          <p className="text-sm text-white/60 mt-2">
            A quick look at our concierge flow, optimized for clear handoffs.
          </p>
        </OtwCard>
        <div className="grid gap-4">
          {TIMELINE.map((step) => (
            <OtwCard key={step.title} className="bg-black/40">
              <h3 className="text-lg font-semibold text-otwOffWhite">{step.title}</h3>
            </OtwCard>
          ))}
        </div>
      </section>
    </div>
  );
}
