import { ArrowRight, ShoppingBag, Truck, Package, Flag, ShieldCheck, Clock } from 'lucide-react';
import OtwCard from '@/components/ui/otw/OtwCard';
import TrackedOtwButtonLink from '@/components/analytics/TrackedOtwButtonLink';
import OtwLeadCaptureCard from '@/components/analytics/OtwLeadCaptureCard';

export default function HomePage() {
  return (
    <div className="otw-container space-y-12 sm:space-y-24 py-6 sm:py-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-card/40 px-4 py-8 shadow-2xl backdrop-blur-xl sm:px-12 sm:py-20">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-otwGold/10 blur-[100px]" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]" aria-hidden="true" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center rounded-full border border-otwGold/30 bg-otwGold/10 px-3 py-1 text-xs font-medium text-otwGold backdrop-blur-md">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-otwGold animate-pulse"></span>
            Delivery & Dispatch
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Local Delivery,
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-otwGold via-yellow-200 to-otwGold">
              Handled Clean.
            </span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
            OTW handles per-delivery pickup, food, catering, and business handoffs in Fort Wayne.
            Broski&apos;s Kitchen customers order through Broski&apos;s; OTW runs the last mile behind the scenes.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap sm:gap-6 pt-4">
            <TrackedOtwButtonLink
              href="/order"
              ctaId="home_start_request"
              ctaLocation="home_hero"
              variant="gold"
              className="h-14 px-8 text-base rounded-full shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-all hover:scale-105"
            >
              Request Delivery
              <ArrowRight className="ml-2 h-4 w-4" />
            </TrackedOtwButtonLink>
            <TrackedOtwButtonLink
              href="/pricing"
              ctaId="home_pick_plan"
              ctaLocation="home_hero"
              variant="outline"
              className="h-14 px-8 text-base rounded-full border-otwGold/50 bg-otwGold/10 hover:bg-otwGold/20 backdrop-blur-sm transition-all hover:scale-105 text-otwGold"
            >
              View Delivery Options
              <ArrowRight className="ml-2 h-4 w-4" />
            </TrackedOtwButtonLink>
            <TrackedOtwButtonLink
              href="/driver/apply"
              ctaId="home_become_driver"
              ctaLocation="home_hero"
              variant="ghost"
              className="h-14 px-8 text-base rounded-full border-otwGold/30 bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-all hover:scale-105 text-otwOffWhite"
            >
              Become a Driver
              <ArrowRight className="ml-2 h-4 w-4" />
            </TrackedOtwButtonLink>
          </div>

          <p className="pt-4 text-sm text-muted-foreground">
            One-time delivery <span className="font-semibold text-otwGold">starting at $9.99</span> — final fee confirmed before dispatch.
          </p>

          <div className="pt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground/60">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>Insured</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Real-time Tracking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Service Tiles */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Use OTW for any request</h2>
            <p className="text-muted-foreground mt-2">Food, catering, pickups, and business handoffs without sending customers to a third-party app.</p>
          </div>
          <TrackedOtwButtonLink
            href="/pricing"
            ctaId="home_view_plans"
            ctaLocation="home_service_tiles_header"
            variant="ghost"
            className="text-otwGold p-0 h-auto hover:no-underline hover:opacity-80"
          >
            View delivery options <ArrowRight className="ml-2 h-4 w-4" />
          </TrackedOtwButtonLink>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { 
              title: 'Broski’s Delivery',
              desc: 'Last-mile handoff for Broski’s Kitchen orders and catering.',
              icon: ShoppingBag,
              color: 'text-otwGold',
              bg: 'bg-otwGold/10'
            },
            { 
              title: 'Food Pickup', 
              desc: 'Per-delivery food pickup after the customer orders direct.',
              icon: ShoppingBag,
              color: 'text-orange-400',
              bg: 'bg-orange-400/10'
            },
            { 
              title: 'Store / Grocery', 
              desc: 'Errands run, shopping done.',
              icon: Package,
              color: 'text-blue-400',
              bg: 'bg-blue-400/10'
            },
            { 
              title: 'Fragile Delivery', 
              desc: 'White-glove care for delicate items.',
              icon: ShieldCheck,
              color: 'text-purple-400',
              bg: 'bg-purple-400/10'
            },
            { 
              title: 'Concierge', 
              desc: 'Business handoffs and custom local delivery requests.',
              icon: Flag,
              color: 'text-emerald-400',
              bg: 'bg-emerald-400/10'
            },
          ].map(({ title, desc, icon: Icon, color, bg }) => (
            <OtwCard key={title} className="bg-card/50 border-white/5">
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${bg} ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </OtwCard>
          ))}
        </div>
      </section>

      {/* Why OTW */}
      <section className="grid gap-8 lg:grid-cols-3">
        {[
          {
            title: "Clear Pricing",
            desc: "Quote each delivery clearly before dispatch.",
            icon: ShieldCheck
          },
          {
            title: "Flexible Support",
            desc: "Use per-delivery requests now; memberships can stay optional for recurring users.",
            icon: Clock
          },
          {
            title: "Retention-Safe Drivers",
            desc: "Drivers get the details needed for a clean pickup, handoff, and confirmation.",
            icon: Truck
          }
        ].map((feature, i) => (
          <OtwCard key={i} className="flex flex-row gap-4 bg-white/[0.02] border-white/5 items-start">
            <div className="shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-otwGold">
                <feature.icon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          </OtwCard>
        ))}
      </section>
      
      {/* Footer CTA */}
      <section className="rounded-[2rem] bg-otwGold/10 border border-otwGold/20 px-6 py-16 text-center backdrop-blur-sm">
        <h2 className="text-3xl font-bold mb-4">Reliable help when the day gets full.</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Submit the delivery details, confirm the fee, and let OTW handle the handoff.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <TrackedOtwButtonLink
            href="/pricing"
            ctaId="home_footer_view_plans"
            ctaLocation="home_footer_cta"
          variant="gold"
          className="h-12 px-8 text-base rounded-full"
        >
            View Delivery Options
          </TrackedOtwButtonLink>
          <TrackedOtwButtonLink
            href="/services"
            ctaId="home_footer_services"
            ctaLocation="home_footer_cta"
            variant="outline"
            className="h-12 px-8 text-base rounded-full"
          >
            View Services
          </TrackedOtwButtonLink>
        </div>
      </section>

      <section className="max-w-3xl mx-auto">
        <OtwLeadCaptureCard
          title="Join the OTW Launch List"
          subtitle="Get notified when OTW expands to your area and new service tiers open."
          interestType="LAUNCH_LIST"
          ctaLabel="Join Launch List"
        />
      </section>
    </div>
  );
}
