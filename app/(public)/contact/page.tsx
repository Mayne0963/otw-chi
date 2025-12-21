import Link from 'next/link';

export default function Contact() {
  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">OTW</h1>
        <nav className="space-x-4">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/how-it-works" className="hover:underline">How It Works</Link>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/services" className="hover:underline">Services</Link>
          <Link href="/sign-in" className="hover:underline">Sign In</Link>
          <Link href="/sign-up" className="bg-white text-blue-600 px-3 py-1 rounded">Sign Up</Link>
        </nav>
      </header>
      <section className="p-8 max-w-lg mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Contact Us</h1>
        <form className="space-y-4">
          <div>
            <label htmlFor="name" className="block mb-1">Name</label>
            <input id="name" type="text" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label htmlFor="email" className="block mb-1">Email</label>
            <input id="email" type="email" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label htmlFor="message" className="block mb-1">Message</label>
            <textarea id="message" className="w-full p-2 border rounded h-32"></textarea>
          </div>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded w-full">Send Message</button>
        </form>
        <div className="mt-8 text-center">
          <p>Email: support@otw.com</p>
          <p>Phone: (123) 456-7890</p>
        </div>
      </section>
      <footer className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 OTW. All rights reserved.</p>
      </footer>
    </main>
  );
}