import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function ContactPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Contact OTW" subtitle="Reach the team for support or ops." />
      <OtwCard className="mt-3 space-y-3">
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Email" />
        <textarea className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Message" />
        <OtwButton variant="gold" className="w-full">Send</OtwButton>
      </OtwCard>
    </OtwPageShell>
  );
}

