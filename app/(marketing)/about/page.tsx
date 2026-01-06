import { Check, Compass, Package, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
    step: 'Step 01',
    title: 'Request arrives',
    body: 'Members and one-time customers submit details and pickup windows.',
  },
  {
    step: 'Step 02',
    title: 'Driver matched',
    body: 'The closest qualified driver is assigned and notified instantly.',
  },
  {
    step: 'Step 03',
    title: 'Live tracking',
    body: 'Customers see status updates and location pings in real time.',
  },
  {
    step: 'Step 04',
    title: 'Delivery complete',
    body: 'Proof of completion and follow-up notes are captured.',
  },
];

export default function AboutPage() {
  return (
    <div className="otw-container otw-section space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-otwBlack via-black to-otwGold/20 p-10 sm:p-14">
        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-otwGold/20 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-secondary/12 blur-3xl" />
        <div className="relative space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.25em] text-white/60">
            <Package className="h-3.5 w-3.5 text-otwGold" />
            On The Way
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-otwOffWhite">
            Built for premium deliveries that never feel random.
          </h1>
          <p className="text-lg text-white/70">
            OTW connects concierge-level service with modern dispatching. We obsess over
            reliability, communication, and speed so every delivery feels intentional.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-otwGold text-otwBlack hover:bg-otwGold/90">
              <Link href="/order">Order Now</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/driver/apply">Become a Driver</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
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
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-otwOffWhite">Fast facts</h3>
          <div className="space-y-4 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span>Average dispatch time</span>
              <span className="text-otwGold font-semibold">Under 5 min</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Service radius</span>
              <span className="text-otwGold font-semibold">25 miles</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delivery status updates</span>
              <span className="text-otwGold font-semibold">Real-time</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-semibold text-otwOffWhite">What makes OTW different</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {VALUE_CARDS.map((value) => {
            const Icon = value.icon;
            return (
              <div key={value.title} className="rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-otwGold/15 text-otwGold">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-otwOffWhite">{value.title}</h3>
                <p className="text-sm text-white/70">{value.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] items-start">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-otwOffWhite">How it works</h3>
          <p className="text-sm text-white/60 mt-2">
            A quick look at our concierge flow, optimized for clear handoffs.
          </p>
        </div>
        <div className="grid gap-4">
          {TIMELINE.map((step) => (
            <div key={step.step} className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-otwGold">{step.step}</div>
              <div className="mt-2 text-lg font-semibold text-otwOffWhite">{step.title}</div>
              <div className="mt-1 text-sm text-white/70">{step.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
