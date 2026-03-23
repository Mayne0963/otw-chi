import { cn } from '@/lib/utils';
import { getRequestRouteStopLabel, type RequestRouteStop } from '@/lib/request-stops';

type Props = {
  stops: RequestRouteStop[];
  className?: string;
};

function getStopTypeLabel(stop: RequestRouteStop) {
  if (stop.type === 'pickup') return 'Pickup';
  if (stop.type === 'dropoff') return 'Final dropoff';
  return 'Stop';
}

export default function RequestRouteStopList({ stops, className }: Props) {
  if (!stops.length) return null;

  return (
    <div className={cn('space-y-4 rounded-lg border border-white/10 bg-black/20 p-4', className)}>
      {stops.map((stop, index) => {
        const isLast = index === stops.length - 1;
        return (
          <div key={`${stop.type}-${stop.address}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-otwGold/20 text-xs font-semibold text-otwGold">
                {index + 1}
              </div>
              {!isLast ? <div className="my-1 h-full w-px bg-white/10" /> : null}
            </div>
            <div className={cn('min-w-0', !isLast && 'pb-4')}>
              <div className="text-sm font-medium text-white">{getRequestRouteStopLabel(stop, index)}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                {getStopTypeLabel(stop)}
              </div>
              <div className="mt-1 text-sm text-white/80">{stop.address}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
