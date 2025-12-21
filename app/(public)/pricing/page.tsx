import Link from 'next/link';

export default function Pricing() {
  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">OTW</h1>
        <nav className="space-x-4">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/how-it-works" className="hover:underline">How It Works</Link>
          <Link href="/services" className="hover:underline">Services</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
          <Link href="/sign-in" className="hover:underline">Sign In</Link>
          <Link href="/sign-up" className="bg-white text-blue-600 px-3 py-1 rounded">Sign Up</Link>
        </nav>
      </header>
      <section className="p-8 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Pricing Plans</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="plan p-6 bg-white shadow-lg rounded-lg text-center">
            <h2 className="text-2xl font-semibold mb-4">Basic</h2>
            <p className="text-xl mb-4">$0/month</p>
            <ul className="space-y-2 mb-6">
              <li>Standard rides</li>
              <li>Basic support</li>
            </ul>
            <button className="bg-blue-500 text-white px-4 py-2 rounded">Choose Plan</button>
          </div>
          <div className="plan p-6 bg-white shadow-lg rounded-lg text-center border-2 border-blue-500">
            <h2 className="text-2xl font-semibold mb-4">Premium</h2>
            <p className="text-xl mb-4">$9.99/month</p>
            <ul className="space-y-2 mb-6">
              <li>Priority rides</li>
              <li>24/7 support</li>
              <li>Discounts</li>
            </ul>
            <button className="bg-blue-500 text-white px-4 py-2 rounded">Choose Plan</button>
          </div>
          <div className="plan p-6 bg-white shadow-lg rounded-lg text-center">
            <h2 className="text-2xl font-semibold mb-4">Enterprise</h2>
            <p className="text-xl mb-4">Custom</p>
            <ul className="space-y-2 mb-6">
              <li>Dedicated fleet</li>
              <li>Custom features</li>
            </ul>
            <button className="bg-blue-500 text-white px-4 py-2 rounded">Contact Us</button>
          </div>
        </div>
      </section>
      <footer className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 OTW. All rights reserved.</p>
      </footer>
    </main>
  );
}