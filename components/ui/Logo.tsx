import Link from 'next/link';
import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <Link href="/" className={cn("font-bold tracking-tighter text-otw-text hover:text-otw-primary transition-colors", sizeClasses[size], className)}>
      <span className="text-otw-primary">OTW</span>
      <span className="text-otw-text">DELIVERY</span>
    </Link>
  );
}
