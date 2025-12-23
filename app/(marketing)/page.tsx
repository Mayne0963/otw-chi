import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="bg-otwRed rounded-3xl shadow-otwGlow px-6 py-8 mt-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h1 className="text-3xl md:text-4xl font-extrabold">On The Way</h1>
            <p className="text-otwOffWhite/90">Luxury delivery concierge for the block, the business, and the busy.</p>
            <p className="text-otwOffWhite/75 text-sm">Your need moves when you do.</p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard" className="inline-flex justify-center items-center rounded-2xl px-4 py-3 bg-otwGold text-otwBlack font-semibold">Request a Delivery</Link>
              <Link href="/membership/manage" className="inline-flex justify-center items-center rounded-2xl px-4 py-3 border border-otwGold text-otwGold">Become a Member</Link>
              <Link href="/" className="inline-flex justify-center items-center rounded-2xl px-4 py-3 text-otwOffWhite underline">Track My Driver</Link>
            </div>
          </div>

          <div className="flex-1 flex md:justify-end">
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-full bg-otwBlack/20 border border-otwGold/40" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Service Tiles */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Food Pickup', emoji: '🍔' },
            { title: 'Store / Grocery', emoji: '🛒' },
            { title: 'Fragile Delivery', emoji: '📦' },
            { title: 'Custom Concierge', emoji: '🏁' },
          ].map(({ title, emoji }) => (
            <div key={title} className="bg-otwBlack rounded-2xl border border-otwRedDark p-4 transition transform hover:shadow-otwSoft hover:scale-[1.01]">
              <div className="text-xl font-semibold flex items-center gap-2">
                <span>{emoji}</span>
                <span>{title}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why OTW */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Why OTW?</h2>
        <ul className="list-disc pl-5 space-y-1 text-otwOffWhite/85">
          <li>Membership-based savings</li>
          <li>Fair driver payouts</li>
          <li>TIREM coin rewards for the youth</li>
        </ul>
      </section>
    </div>
  );
}
