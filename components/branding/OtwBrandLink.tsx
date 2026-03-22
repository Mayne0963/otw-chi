import Link from 'next/link';
import OtwNavbarLogo from '@/components/branding/OtwNavbarLogo';
import { cn } from '@/lib/utils';

type OtwBrandLinkProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
  labelClassName?: string;
  subtitleClassName?: string;
  label?: string;
  subtitle?: string;
  showWordmark?: boolean;
};

export default function OtwBrandLink({
  href = '/',
  className,
  imageClassName,
  labelClassName,
  subtitleClassName,
  label = 'OTW',
  subtitle,
  showWordmark = true,
}: OtwBrandLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-white/5',
        className,
      )}
      aria-label="Go to OTW home"
    >
      <OtwNavbarLogo imageClassName={cn('h-12 w-12 rounded-lg', imageClassName)} />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className={cn('text-base font-semibold tracking-[0.22em] text-foreground', labelClassName)}>
            {label}
          </span>
          {subtitle ? (
            <span className={cn('text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70', subtitleClassName)}>
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
