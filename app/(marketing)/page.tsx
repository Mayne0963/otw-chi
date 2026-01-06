import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="otw-container otw-section space-y-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 px-6 py-8 shadow-otwSoft sm:px-10 sm:py-10">
        <div className="absolute -top-24 right-0 h-52 w-52 rounded-full bg-secondary/14 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-primary/8 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="otw-pill">Premium Concierge</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl">On The Way</h1>
            <p className="text-foreground/80">
              Luxury delivery concierge for the block, the business, and the busy.
              Your need moves when you do.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild>
                <Link href="/request">Request a Delivery</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">Become a Member</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/order">Track My Driver</Link>
              </Button>
            </div>
          </div>

          <div className="flex-1 lg:flex lg:justify-end">
            <div className="h-32 w-32 rounded-full border border-secondary/40 bg-muted/40 sm:h-40 sm:w-40" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Service Tiles */}
      <section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Food Pickup', emoji: '🍔' },
            { title: 'Store / Grocery', emoji: '🛒' },
            { title: 'Fragile Delivery', emoji: '📦' },
            { title: 'Custom Concierge', emoji: '🏁' },
          ].map(({ title, emoji }) => (
            <div key={title} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-otwSoft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-otwElevated">
              <div className="text-lg font-semibold flex items-center gap-2">
                <span>{emoji}</span>
                <span>{title}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why OTW */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold font-display">Why OTW?</h2>
        <ul className="list-disc pl-5 space-y-1 text-foreground/80">
          <li>Membership-based savings</li>
          <li>Fair driver payouts</li>
          <li>TIREM coin rewards for the youth</li>
        </ul>
      </section>
    </div>
  );
}
