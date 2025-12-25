'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@clerk/nextjs';

export default function DriverApplyPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      city: formData.get('city'),
      vehicleType: formData.get('vehicleType'),
      availability: formData.get('availability'),
      message: formData.get('message'),
    };

    try {
      const res = await fetch('/api/driver/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to submit application');
      }

      router.push('/driver/apply/success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OtwPageShell>
      <div className="max-w-2xl mx-auto">
        <OtwSectionHeader 
            title="Become a Driver" 
            subtitle="Join the OTW fleet and earn on your schedule." 
        />
        
        <OtwCard className="mt-8">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-otwOffWhite">Full Name</Label>
                            <Input 
                                id="fullName" 
                                name="fullName" 
                                required 
                                defaultValue={user?.fullName || ''}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-otwOffWhite">Email</Label>
                            <Input 
                                id="email" 
                                name="email" 
                                type="email" 
                                required 
                                defaultValue={user?.primaryEmailAddress?.emailAddress || ''}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-otwOffWhite">Phone Number</Label>
                            <Input 
                                id="phone" 
                                name="phone" 
                                type="tel" 
                                required 
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="city" className="text-otwOffWhite">City</Label>
                            <Input 
                                id="city" 
                                name="city" 
                                required 
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="vehicleType" className="text-otwOffWhite">Vehicle Type</Label>
                        <Input 
                            id="vehicleType" 
                            name="vehicleType" 
                            placeholder="e.g. 2020 Honda Civic" 
                            required 
                            className="bg-white/5 border-white/10 text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="availability" className="text-otwOffWhite">Availability (Optional)</Label>
                        <Input 
                            id="availability" 
                            name="availability" 
                            placeholder="e.g. Weekends, Evenings" 
                            className="bg-white/5 border-white/10 text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="message" className="text-otwOffWhite">Why do you want to join? (Optional)</Label>
                        <Textarea 
                            id="message" 
                            name="message" 
                            className="bg-white/5 border-white/10 text-white"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded">
                        {error}
                    </div>
                )}

                <Button 
                    type="submit" 
                    className="w-full bg-otwGold hover:bg-otwGold/90 text-otwBlack font-bold"
                    disabled={loading || !isLoaded}
                >
                    {loading ? 'Submitting...' : 'Submit Application'}
                </Button>
            </form>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
