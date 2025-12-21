import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen bg-otw-bg">
      <div className="bg-otw-gradient text-otw-text">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Reliable Delivery <br />
              <span className="text-otw-primary">On The Way</span>
            </h1>
            <p className="text-xl text-otw-textMuted mb-10">
              Get your packages delivered on time, every time. Same-day service available in select cities with real-time tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="rounded-full text-lg px-8" asChild>
                <Link href="/how-it-works">Learn More</Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full text-lg px-8" asChild>
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-otw-panel p-8 rounded-3xl border border-otw-border hover:border-otw-primary transition-colors">
            <h3 className="text-2xl font-bold mb-4 text-otw-text">Fast Delivery</h3>
            <p className="text-otw-textMuted">Same-day service in select cities. We prioritize speed without compromising safety.</p>
          </div>
          <div className="bg-otw-panel p-8 rounded-3xl border border-otw-border hover:border-otw-primary transition-colors">
            <h3 className="text-2xl font-bold mb-4 text-otw-text">Secure Handling</h3>
            <p className="text-otw-textMuted">Every package is tracked and insured. Real-time updates at every step of the journey.</p>
          </div>
          <div className="bg-otw-panel p-8 rounded-3xl border border-otw-border hover:border-otw-primary transition-colors">
            <h3 className="text-2xl font-bold mb-4 text-otw-text">Fair Pricing</h3>
            <p className="text-otw-textMuted">Transparent rates with no hidden fees. Choose the plan that fits your needs.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
