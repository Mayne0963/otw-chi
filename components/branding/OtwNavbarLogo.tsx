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
        src="/icons/image02.jpg"
        alt={alt}
        className={cn('h-24 w-24 rounded-md object-contain', imageClassName)}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}
