import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

type ParsedCityRequestMessage = {
  city: string;
  why: string | null;
};

function parseCityRequestMessage(message: string): ParsedCityRequestMessage | null {
  if (!message.includes('CITY_REQUEST_VOTE')) return null;

  const lines = message.split('\n').map((line) => line.trim());
  const cityLine = lines.find((line) => line.startsWith('City:'));
  const whyLine = lines.find((line) => line.startsWith('Why:'));

  const city = cityLine?.replace(/^City:\s*/, '').trim() ?? '';
  const whyRaw = whyLine?.replace(/^Why:\s*/, '').trim() ?? '';
  const why = whyRaw && !whyRaw.startsWith('No additional context') ? whyRaw : null;

  if (!city) return null;
  return { city, why };
}

export default async function AdminCityRequestsPage() {
  await requireRole(['ADMIN']);

  const prisma = getPrisma();
  const messages = await prisma.contactMessage.findMany({
    where: {
      message: {
        contains: 'CITY_REQUEST_VOTE',
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const requests = messages
    .map((message) => {
      const parsed = parseCityRequestMessage(message.message);
      if (!parsed) return null;

      return {
        id: message.id,
        createdAt: message.createdAt,
        email: message.email,
        city: parsed.city,
        why: parsed.why,
        user: message.user,
      };
    })
    .filter((request): request is NonNullable<typeof request> => Boolean(request));

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7DayCount = requests.filter((request) => request.createdAt >= last7Days).length;

  const cityDemand = requests.reduce<Record<string, number>>((acc, request) => {
    const normalizedCity = request.city.toLowerCase();
    acc[normalizedCity] = (acc[normalizedCity] ?? 0) + 1;
    return acc;
  }, {});

  const uniqueCityCount = Object.keys(cityDemand).length;
  const topCities = Object.entries(cityDemand)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
    .slice(0, 8);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="City Requests"
        subtitle="Monitor customer demand for OTW expansion into new cities."
      />

      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{requests.length}</div>
            <div className="text-xs text-white/60">Total Requests</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-otwGold">{last7DayCount}</div>
            <div className="text-xs text-white/60">Last 7 Days</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{uniqueCityCount}</div>
            <div className="text-xs text-white/60">Unique Cities</div>
          </div>
        </div>
      </OtwCard>

      {topCities.length > 0 ? (
        <OtwCard className="mt-3 p-5 sm:p-6">
          <div className="text-sm font-medium text-white mb-3">Top Requested Cities</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topCities.map((entry) => (
              <div key={entry.city} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-semibold capitalize text-white">{entry.city}</div>
                <div className="mt-1 text-xs text-white/60">
                  {entry.count} request{entry.count === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        </OtwCard>
      ) : null}

      {requests.length === 0 ? (
        <OtwCard className="mt-3 p-8 text-center">
          <OtwEmptyState
            title="No city requests yet"
            subtitle="New city vote requests will appear here."
          />
        </OtwCard>
      ) : (
        <OtwCard className="mt-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="opacity-60 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3">Received</th>
                  <th className="text-left px-4 py-3">City</th>
                  <th className="text-left px-4 py-3">Why</th>
                  <th className="text-left px-4 py-3">Requester</th>
                  <th className="text-left px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{request.city}</td>
                    <td className="px-4 py-3 text-white/70 max-w-sm truncate" title={request.why ?? ''}>
                      {request.why ?? 'No additional context provided.'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{request.user?.name || 'Guest'}</div>
                      {request.user?.role ? (
                        <div className="text-xs text-white/40">{request.user.role}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-white/80">{request.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}
