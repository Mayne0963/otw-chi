import Link from 'next/link';

export default function Terms() {
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
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="mb-4">Last updated: December 21, 2025</p>
        <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
        <p className="mb-4">Welcome to OTW. These terms govern your use of our services.</p>
        <h2 className="text-2xl font-semibold mb-4">2. User Accounts</h2>
        <p className="mb-4">You must create an account to use certain features.</p>
        // More sections...
      </section>
      <footer className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 OTW. All rights reserved.</p>
      </footer>
    </main>
  );
}