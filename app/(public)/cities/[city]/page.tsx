import Link from 'next/link';

export default function CityPage({ params }: { params: { city: string } }) {
  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">OTW</h1>
        <nav className="space-x-4">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/how-it-works" className="hover:underline">How It Works</Link>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/services" className="hover:underline">Services</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
          <Link href="/sign-in" className="hover:underline">Sign In</Link>
          <Link href="/sign-up" className="bg-white text-blue-600 px-3 py-1 rounded">Sign Up</Link>
        </nav>
      </header>
      <section className="p-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 capitalize">{params.city} Services</h1>
        <p className="mb-8">Discover OTW services available in {params.city}.</p>
        <div className="grid grid-cols-1 gap-4">
          <div className="card p-4 bg-white shadow rounded">
            <h2 className="text-xl font-semibold">Local Rides</h2>
            <p>Quick trips within the city</p>
          </div>
          <div className="card p-4 bg-white shadow rounded">
            <h2 className="text-xl font-semibold">Tourist Packages</h2>
            <p>Explore {params.city} with our guided tours</p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link href="/sign-up" className="bg-blue-500 text-white px-6 py-3 rounded">Book a Ride in {params.city}</Link>
        </div>
      </section>
      <footer className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 OTW. All rights reserved.</p>
      </footer>
    </main>
  );
}