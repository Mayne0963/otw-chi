import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ShieldAlert } from 'lucide-react';

export default function AccessDenied() {
  return (
    <div className="min-h-screen bg-otw-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-otw-panel border border-otw-border rounded-3xl p-8 text-center shadow-otwSoft">
        <div className="bg-otw-bg p-4 rounded-full inline-flex mb-6 border border-otw-border">
          <ShieldAlert className="w-12 h-12 text-otw-error" />
        </div>
        
        <h1 className="text-2xl font-bold text-otw-text mb-4">Access Denied</h1>
        <p className="text-otw-textMuted mb-8">
          You don't have permission to view this page. Please contact an administrator if you believe this is a mistake.
        </p>
        
        <div className="flex flex-col gap-3">
          <Button asChild variant="default" className="w-full">
            <Link href="/">Return Home</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
