'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/components/auth/use-current-user';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

type DriverApplicationStatus = 'PENDING' | 'APPROVED' | 'WAITLIST' | 'DENIED';

type ExistingDriverApplication = {
  id: string;
  status: DriverApplicationStatus;
  city: string;
  vehicleType: string;
  fullName: string;
  email: string;
  phone: string;
  availability: string | null;
  whyOtwAnswer: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatApplicationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

export default function DriverApplyPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [existingApplication, setExistingApplication] = useState<ExistingDriverApplication | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    vehicleType: '',
    availability: '',
    whyOtwAnswer: ''
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.name || prev.fullName,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setExistingApplication(null);
      setStatusLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setStatusLoading(true);
    fetch('/api/driver/apply', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | { application?: ExistingDriverApplication | null }
          | null;
        if (!res.ok) {
          throw new Error('Failed to load application status');
        }
        return payload?.application ?? null;
      })
      .then((application) => {
        if (cancelled) return;
        setExistingApplication(application);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[DriverApplyPage] Failed to load application status', error);
      })
      .finally(() => {
        if (cancelled) return;
        setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleWithdraw = async () => {
    if (!existingApplication || existingApplication.status !== 'PENDING') return;
    if (!confirm('Withdraw your pending driver application?')) return;

    setWithdrawing(true);
    try {
      const response = await fetch('/api/driver/apply', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existingApplication.id }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to withdraw application');
      }

      setExistingApplication((prev) =>
        prev ? { ...prev, status: 'DENIED', updatedAt: new Date().toISOString() } : prev
      );
      toast({
        title: 'Application Withdrawn',
        description: 'Your pending application was withdrawn. You can submit a new one anytime.',
      });
    } catch (_error) {
      const description =
        _error instanceof Error && _error.message
          ? _error.message
          : 'Unable to withdraw application right now.';
      toast({
        title: 'Withdraw Failed',
        description,
        variant: 'destructive',
      });
    } finally {
      setWithdrawing(false);
    }
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

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to submit application');
      }

      const payload = (await res.json().catch(() => null)) as
        | { success?: boolean; application?: ExistingDriverApplication }
        | null;

      toast({
        title: "Application Submitted",
        description: "We'll be in touch shortly!",
      });

      if (payload?.application) {
        setExistingApplication(payload.application);
      }
      setSubmitted(true);
    } catch (_error) {
      const description =
        _error instanceof Error && _error.message
          ? _error.message
          : 'Something went wrong. Please try again.';
      toast({
        title: "Error",
        description,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const hasActiveApplication =
    existingApplication?.status === 'PENDING' ||
    existingApplication?.status === 'WAITLIST' ||
    existingApplication?.status === 'APPROVED';

  const statusTone =
    existingApplication?.status === 'APPROVED'
      ? 'text-green-300 border-green-500/30 bg-green-500/10'
      : existingApplication?.status === 'WAITLIST'
        ? 'text-yellow-200 border-yellow-500/30 bg-yellow-500/10'
        : existingApplication?.status === 'DENIED'
          ? 'text-red-200 border-red-500/30 bg-red-500/10'
          : 'text-white/80 border-white/20 bg-white/5';

  const statusCopy = existingApplication
    ? {
        APPROVED: 'You have been approved. Watch your email for onboarding and next steps.',
        WAITLIST: 'You are on the waitlist right now. We will reach back out if a spot opens.',
        DENIED: 'This application is closed. You can submit a new one later if circumstances change.',
        PENDING: 'Your application is in review. You can withdraw it if needed.',
      }[existingApplication.status]
    : '';

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Apply as OTW Driver" subtitle="Join the team and earn fair payouts." />
      
      <div className="mt-6 max-w-xl mx-auto">
        <Card className="space-y-4 p-5 sm:p-6">
          {statusLoading ? (
            <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white/70">
              Checking your application status...
            </div>
          ) : existingApplication ? (
            <div className="space-y-4 rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{existingApplication.fullName}</div>
                  <div className="text-xs text-white/60">
                    Submitted {formatApplicationDate(existingApplication.createdAt)}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone}`}
                >
                  {existingApplication.status}
                </span>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                  Status
                </div>
                <div className="mt-2 text-sm text-white/80">{statusCopy}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Email</div>
                  <div className="mt-2 text-sm text-white">{existingApplication.email}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Phone</div>
                  <div className="mt-2 text-sm text-white">{existingApplication.phone}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">City</div>
                  <div className="mt-2 text-sm text-white">{existingApplication.city}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Vehicle Type</div>
                  <div className="mt-2 text-sm text-white">{existingApplication.vehicleType}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Availability</div>
                  <div className="mt-2 text-sm text-white">
                    {existingApplication.availability || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Why OTW?</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">
                  {existingApplication.whyOtwAnswer || 'No response on file.'}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/55">
                <span>Last updated {formatApplicationDate(existingApplication.updatedAt)}</span>
              </div>

              {existingApplication.status === 'PENDING' ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={withdrawing}
                    onClick={handleWithdraw}
                    className="w-full"
                  >
                    {withdrawing ? 'Withdrawing...' : 'Withdraw Application'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {submitted ? (
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-semibold text-foreground">Thanks for applying!</h2>
              <p className="text-sm text-muted-foreground">
                Your application is under review. We will contact you with next steps.
              </p>
            </div>
          ) : hasActiveApplication ? (
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold text-foreground">Application In Progress</h2>
              <p className="text-sm text-muted-foreground">
                You already have an active application. We&apos;ll update you by email.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground block mb-1">Full Name</label>
              <input 
                id="fullName"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                className="w-full rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
              />
            </div>
            
            <div>
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground block mb-1">Email</label>
              <input 
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
              />
            </div>

            <div>
              <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground block mb-1">Phone</label>
              <input 
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground block mb-1">City</label>
                <input 
                  id="city"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
                />
              </div>
              <div>
                <label htmlFor="vehicleType" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground block mb-1">Vehicle Type</label>
                <select 
                  id="vehicleType"
                  name="vehicleType"
                  required
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
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
              <label htmlFor="availability" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground block mb-1">Availability</label>
              <select 
                id="availability"
                name="availability"
                required
                value={formData.availability}
                onChange={handleChange}
                className="w-full rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
              >
                <option value="">Select...</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Weekends">Weekends Only</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>

            <div>
              <label htmlFor="whyOtwAnswer" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground block mb-1">Why OTW?</label>
              <textarea 
                id="whyOtwAnswer"
                name="whyOtwAnswer"
                rows={3}
                required
                value={formData.whyOtwAnswer}
                onChange={handleChange}
                className="w-full rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background" 
              />
            </div>

            <Button type="submit" variant="gold" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Submit Application"}
            </Button>
          </form>
          )}
        </Card>
      </div>
    </OtwPageShell>
  );
}
