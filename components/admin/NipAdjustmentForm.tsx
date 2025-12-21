'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createAdjustment, lookupUser } from '@/app/actions/wallet';
import { Search, Plus, Minus, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export function NipAdjustmentForm() {
  const [identifier, setIdentifier] = useState('');
  const [user, setUser] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleLookup = async () => {
    if (!identifier) return;
    setLoading(true);
    setMessage(null);
    try {
      const found = await lookupUser(identifier);
      if (found) {
        setUser(found);
        setMessage(null);
      } else {
        setUser(null);
        setMessage({ type: 'error', text: 'User not found' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error looking up user' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !reason) return;

    setLoading(true);
    try {
      await createAdjustment(user.id, parseInt(amount), reason);
      setMessage({ type: 'success', text: 'Adjustment created successfully' });
      // Reset form
      setAmount('');
      setReason('');
      setUser(null);
      setIdentifier('');
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to create adjustment' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-otw-panel border border-otw-border rounded-3xl p-6 shadow-otwSoft">
      <h3 className="text-lg font-bold text-otw-text mb-4">Create Manual Adjustment</h3>
      
      <div className="space-y-4">
        {/* Step 1: Find User */}
        {!user ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="User Email or ID"
              className="flex-1 bg-otw-bg border border-otw-border rounded-xl px-4 py-2 text-otw-text focus:outline-none focus:ring-2 focus:ring-otw-primary"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            />
            <Button onClick={handleLookup} disabled={loading || !identifier}>
              {loading ? '...' : <Search className="w-4 h-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-otw-bg p-3 rounded-xl border border-otw-border">
            <div>
              <p className="font-semibold text-otw-text">{user.name || 'Unknown Name'}</p>
              <p className="text-xs text-otw-textMuted">{user.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setUser(null)}>Change</Button>
          </div>
        )}

        {/* Step 2: Details */}
        {user && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-otw-textMuted mb-1">Amount (+/-)</label>
                <input
                  type="number"
                  placeholder="-100 or 500"
                  required
                  className="w-full bg-otw-bg border border-otw-border rounded-xl px-4 py-2 text-otw-text focus:outline-none focus:ring-2 focus:ring-otw-primary"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-otw-textMuted mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Refund, Bonus"
                  required
                  className="w-full bg-otw-bg border border-otw-border rounded-xl px-4 py-2 text-otw-text focus:outline-none focus:ring-2 focus:ring-otw-primary"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Submit Adjustment'}
            </Button>
          </form>
        )}

        {/* Feedback Message */}
        {message && (
          <div className={cn(
            "p-3 rounded-xl flex items-center gap-2 text-sm",
            message.type === 'success' ? "bg-otw-success/10 text-otw-success" : "bg-otw-error/10 text-otw-error"
          )}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
