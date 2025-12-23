'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export default function DriverApplyPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    phone: '',
    city: '',
    vehicleType: '',
    availability: '',
    message: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/driver/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to submit application');

      toast({
        title: "Application Submitted",
        description: "We'll be in touch shortly!",
      });
      
      router.push('/');
    } catch (_error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Apply as OTW Driver" subtitle="Join the team and earn fair payouts." />
      
      <div className="mt-6 max-w-xl mx-auto">
        <OtwCard className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-otwOffWhite block mb-1">Full Name</label>
              <input 
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-otwOffWhite focus:border-otwGold focus:outline-none" 
                placeholder="John Doe" 
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-otwOffWhite block mb-1">Email</label>
              <input 
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-otwOffWhite focus:border-otwGold focus:outline-none" 
                placeholder="john@example.com" 
              />
            </div>

            <div>
              <label className="text-sm font-medium text-otwOffWhite block mb-1">Phone</label>
              <input 
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-otwOffWhite focus:border-otwGold focus:outline-none" 
                placeholder="(555) 123-4567" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-otwOffWhite block mb-1">City</label>
                <input 
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-otwOffWhite focus:border-otwGold focus:outline-none" 
                  placeholder="Chicago" 
                />
              </div>
              <div>
                <label className="text-sm font-medium text-otwOffWhite block mb-1">Vehicle Type</label>
                <select 
                  name="vehicleType"
                  required
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-otwOffWhite focus:border-otwGold focus:outline-none" 
                >
                  <option value="">Select...</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Van">Van</option>
                  <option value="Truck">Truck</option>
                  <option value="Bike">Bike/Scooter</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-otwOffWhite block mb-1">Availability</label>
              <select 
                name="availability"
                required
                value={formData.availability}
                onChange={handleChange}
                className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-otwOffWhite focus:border-otwGold focus:outline-none" 
              >
                <option value="">Select...</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Weekends">Weekends Only</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-otwOffWhite block mb-1">Why OTW? (Optional)</label>
              <textarea 
                name="message"
                rows={3}
                value={formData.message}
                onChange={handleChange}
                className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-otwOffWhite focus:border-otwGold focus:outline-none" 
                placeholder="Tell us a bit about yourself..." 
              />
            </div>

            <OtwButton type="submit" variant="gold" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Submit Application"}
            </OtwButton>
          </form>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
