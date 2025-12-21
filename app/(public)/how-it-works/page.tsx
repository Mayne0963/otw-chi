import Link from 'next/link';

export default function HowItWorks() {
  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">OTW</h1>
        <nav className="space-x-4">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/services" className="hover:underline">Services</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
          <Link href="/sign-in" className="hover:underline">Sign In</Link>
          <Link href="/sign-up" className="bg-white text-blue-600 px-3 py-1 rounded">Sign Up</Link>
        </nav>
      </header>
      <section className="p-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">How OTW Works</h1>
        <div className="space-y-12">
          <div className="step flex items-center">
            <div className="number bg-blue-500 text-white w-12 h-12 flex items-center justify-center rounded-full mr-4">1</div>
            <div>
              <h2 className="text-2xl font-semibold">Sign Up</h2>
              <p>Create an account in minutes</p>
            </div>
          </div>
          <div className="step flex items-center">
            <div className="number bg-blue-500 text-white w-12 h-12 flex items-center justify-center rounded-full mr-4">2</div>
            <div>
              <h2 className="text-2xl font-semibold">Request a Ride</h2>
              <p>Enter your location and destination</p>
            </div>
          </div>
          <div className="step flex items-center">
            <div className="number bg-blue-500 text-white w-12 h-12 flex items-center justify-center rounded-full mr-4">3</div>
            <div>
              <h2 className="text-2xl font-semibold">Enjoy the Trip</h2>
              <p>Track your driver in real-time</p>
            </div>
          </div>
        </div>
      </section>
      <footer className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 OTW. All rights reserved.</p>
      </footer>
    </main>
  );
}