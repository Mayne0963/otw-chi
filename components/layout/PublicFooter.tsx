import Link from 'next/link';
import Logo from '@/components/ui/Logo';

export function PublicFooter() {
  return (
    <footer className="bg-otw-panel border-t border-otw-border pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <Logo size="lg" />
            <p className="text-otw-textMuted text-sm max-w-xs">
              Reliable, fast, and secure delivery services for modern businesses and individuals.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-otw-text mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-otw-textMuted">
              <li><Link href="/about" className="hover:text-otw-primary">About Us</Link></li>
              <li><Link href="/careers" className="hover:text-otw-primary">Careers</Link></li>
              <li><Link href="/blog" className="hover:text-otw-primary">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-otw-primary">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-otw-text mb-4">Services</h4>
            <ul className="space-y-2 text-sm text-otw-textMuted">
              <li><Link href="/services" className="hover:text-otw-primary">Same Day</Link></li>
              <li><Link href="/services" className="hover:text-otw-primary">Scheduled</Link></li>
              <li><Link href="/pricing" className="hover:text-otw-primary">Pricing</Link></li>
              <li><Link href="/cities/nyc" className="hover:text-otw-primary">Coverage</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-otw-text mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-otw-textMuted">
              <li><Link href="/terms" className="hover:text-otw-primary">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-otw-primary">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-otw-primary">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-otw-border pt-8 text-center text-sm text-otw-textMuted">
          <p>&copy; {new Date().getFullYear()} OTW Delivery. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
