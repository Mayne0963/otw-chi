'use client';

import { Home } from 'lucide-react';
import OtwButton from '@/components/ui/otw/OtwButton';
import { BackNavButton } from '@/components/layout/BackNavButton';
import OtwBrandLink from '@/components/branding/OtwBrandLink';

export default function AuthNavButtons() {
  return (
    <div className="absolute left-4 top-4 z-20 flex items-center gap-2 sm:left-6 sm:top-6">
      <OtwBrandLink
        className="pr-3"
        imageClassName="h-10 w-10 rounded-lg"
        labelClassName="hidden text-sm tracking-[0.28em] sm:block"
        showWordmark={false}
      />
      <BackNavButton fallbackHref="/" className="h-9 px-3" />
      <OtwButton as="a" href="/" variant="ghost" size="sm" className="h-9 px-3">
        <Home className="h-4 w-4" />
        <span>Home</span>
      </OtwButton>
    </div>
  );
}
