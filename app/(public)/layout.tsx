import OtwBrandLink from '@/components/branding/OtwBrandLink';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="otw-container flex h-16 items-center">
          <OtwBrandLink
            imageClassName="h-10 w-10 rounded-lg"
            labelClassName="text-sm tracking-[0.28em]"
            subtitle="On The Way"
          />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
