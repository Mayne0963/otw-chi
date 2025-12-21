import Link from 'next/link';

export default function Services() {
  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">OTW</h1>
        <nav className="space-x-4">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/how-it-works" className="hover:underline">How It Works</Link>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
          <Link href="/sign-in" className="hover:underline">Sign In</Link>
          <Link href="/sign-up" className="bg-white text-blue-600 px-3 py-1 rounded">Sign Up</Link>
        </nav>
      </header>
      <section className="p-8 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Our Services</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="service p-6 bg-white shadow-lg rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Ride Sharing</h2>
            <p>Share rides with others heading the same way</p>
          </div>
          <div className="service p-6 bg-white shadow-lg rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Private Rides</h2>
            <p>Exclusive rides for you and your group</p>
          </div>
          <div className="service p-6 bg-white shadow-lg rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Delivery Services</h2>
            <p>Fast delivery of packages and goods</p>
          </div>
          <div className="service p-6 bg-white shadow-lg rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Airport Transfers</h2>
            <p>Reliable transportation to and from airports</p>
          </div>
        </div>
      </section>
      <footer className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 OTW. All rights reserved.</p>
      </footer>
    </main>
  );
}