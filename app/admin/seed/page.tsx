'use client';

import { useState } from 'react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runSeed = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Seed failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run seed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Database Seed" 
        subtitle="Populate the database with initial test data." 
      />
      
      <div className="mt-6">
        <OtwCard className="p-6">
          <div className="space-y-4">
            <div className="text-sm text-white/80">
              <p className="mb-2">This will create initial data for testing:</p>
              <ul className="list-disc list-inside mb-4 text-white/60 space-y-1">
                <li>Cities: Chicago, Fort Wayne</li>
                <li>Zones: South Side, West Side, Downtown, North OTW, South OTW, East OTW, West OTW</li>
                <li>Membership Plans: OTW BASIC, OTW PLUS, OTW PRO, OTW ELITE, OTW BLACK, OTW BUSINESS CORE, OTW BUSINESS PRO, OTW ENTERPRISE</li>
              </ul>
              <p className="text-white/60">
                <strong>Note:</strong> This uses upsert, so running it multiple times is safe.
              </p>
            </div>

            <OtwButton
              onClick={runSeed}
              disabled={loading}
              variant="gold"
              className="w-auto"
            >
              {loading ? 'Seeding Database...' : 'Seed Database'}
            </OtwButton>

            {result && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-green-400 font-medium mb-2">✓ Seed Successful</div>
                <div className="text-sm text-white/80 space-y-2">
                  <p>{result.message}</p>
                  {result.data && (
                    <div className="mt-2 space-y-1">
                      <div><strong>Cities:</strong> {result.data.cities.join(', ')}</div>
                      <div><strong>Zones:</strong> {result.data.zones.join(', ')}</div>
                      <div><strong>Plans:</strong> {result.data.plans.join(', ')}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-red-400 font-medium mb-2">✗ Seed Failed</div>
                <div className="text-sm text-white/80">
                  {error}
                </div>
              </div>
            )}
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
