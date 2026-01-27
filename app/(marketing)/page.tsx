import { ArrowRight, ShoppingBag, Truck, Package, Flag, ShieldCheck, Clock } from 'lucide-react';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwCard from '@/components/ui/otw/OtwCard';

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
            Subscription-Based Concierge
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Own Your Time.
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-otwGold via-yellow-200 to-otwGold">
              We’ll Handle the Rest.
            </span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
            OTW is a subscription-based concierge service powered by Service Miles — not distance.
            You choose the service. We handle the inconvenience.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6 pt-4">
            <OtwButton 
              as="a" 
              href="/pricing"
              variant="gold" 
              className="h-14 px-8 text-base rounded-full shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-all hover:scale-105"
            >
              Pick a Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </OtwButton>
            <OtwButton 
              as="a" 
              href="/how-it-works"
              variant="outline" 
              className="h-14 px-8 text-base rounded-full border-otwGold/50 bg-otwGold/10 hover:bg-otwGold/20 backdrop-blur-sm transition-all hover:scale-105 text-otwGold"
            >
              How It Works
              <ArrowRight className="ml-2 h-4 w-4" />
            </OtwButton>
          </div>
          
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
            <h2 className="text-3xl font-bold tracking-tight">Use Service Miles for any request</h2>
            <p className="text-muted-foreground mt-2">Time is universal. Distance varies. OTW charges by time.</p>
          </div>
          <OtwButton as="a" href="/pricing" variant="ghost" className="text-otwGold p-0 h-auto hover:no-underline hover:opacity-80">
            View plans <ArrowRight className="ml-2 h-4 w-4" />
          </OtwButton>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { 
              title: 'Ride Service', 
              desc: 'Comfortable rides to your destination.',
              icon: Truck,
              color: 'text-otwGold',
              bg: 'bg-otwGold/10'
            },
            { 
              title: 'Food Pickup', 
              desc: 'Hot & fresh from your favorite spots.',
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
              desc: 'Custom requests, handled professionally.',
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
            desc: "See the Service Miles cost before the work starts. Accept or decline — no disputes.",
            icon: ShieldCheck
          },
          {
            title: "Time-Based Economy",
            desc: "1 Service Mile = 5 minutes of human time + effort absorbed on your behalf.",
            icon: Clock
          },
          {
            title: "Retention-Safe Drivers",
            desc: "Drivers are paid per Service Mile with clear bonuses for tough jobs and 5-star service.",
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
        <h2 className="text-3xl font-bold mb-4">Life doesn’t charge by the mile. Neither do we.</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Pick a plan, approve the Service Miles cost, and let OTW handle it.
        </p>
        <OtwButton as="a" href="/pricing" variant="gold" className="h-12 px-8 text-base rounded-full">
          View Plans
        </OtwButton>
      </section>
    </div>
  );
}
