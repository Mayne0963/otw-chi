import { cn } from '@/lib/utils';

type OtwNavbarLogoProps = {
  className?: string;
  imageClassName?: string;
  alt?: string;
};

export default function OtwNavbarLogo({
  className,
  imageClassName,
  alt = 'OTW logo',
}: OtwNavbarLogoProps) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src="/icons/otw-512.svg"
        alt={alt}
        className={cn('h-8 w-8 rounded-md object-contain', imageClassName)}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}
