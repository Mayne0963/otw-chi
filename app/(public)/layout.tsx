import { PublicNav } from '@/components/layout/PublicNav';
import { PublicFooter } from '@/components/layout/PublicFooter';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <PublicNav />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
