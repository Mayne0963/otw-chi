'use client';

import { useState } from 'react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function MigratePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runMigration = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Migration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run migration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Database Migration" 
        subtitle="Run Prisma migrations to create or update database tables." 
      />
      
      <div className="mt-6">
        <OtwCard className="p-6">
          <div className="space-y-4">
            <div className="text-sm text-white/80">
              <p className="mb-2">This will run all pending Prisma migrations on your Neon database.</p>
              <p className="mb-4 text-white/60">
                <strong>Warning:</strong> Only run this if you know what you&apos;re doing. This will modify your database schema.
              </p>
            </div>

            <OtwButton
              onClick={runMigration}
              disabled={loading}
              variant="gold"
              className="w-auto"
            >
              {loading ? 'Running Migration...' : 'Run Migration'}
            </OtwButton>

            {result && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-green-400 font-medium mb-2">✓ Migration Successful</div>
                <div className="text-sm text-white/80 whitespace-pre-wrap font-mono">
                  {result.output || result.message}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-red-400 font-medium mb-2">✗ Migration Failed</div>
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
