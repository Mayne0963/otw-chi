import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function SupportPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Support" subtitle="Create a ticket or get help." />
      <OtwCard className="mt-3 space-y-3">
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Subject" />
        <textarea className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Describe your issue" />
        <OtwButton variant="gold">Submit Ticket</OtwButton>
      </OtwCard>
    </OtwPageShell>
  );
}

