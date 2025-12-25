import Link from 'next/link';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default function ApplicationSuccessPage() {
  return (
    <OtwPageShell>
      <div className="max-w-md mx-auto mt-12 text-center">
        <OtwCard className="p-8 flex flex-col items-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-6" />
            <h1 className="text-2xl font-bold text-otwOffWhite mb-2">Application Received!</h1>
            <p className="text-white/60 mb-8">
                Thank you for applying to be an OTW driver. Our team will review your application and contact you shortly.
            </p>
            <Button asChild className="bg-otwGold text-otwBlack hover:bg-otwGold/90">
                <Link href="/">Back to Home</Link>
            </Button>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
