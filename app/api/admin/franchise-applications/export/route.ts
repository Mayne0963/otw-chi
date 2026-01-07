import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const escapeCsv = (value: unknown) => {
  if (value == null) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export async function GET() {
  try {
    await requireRole(['ADMIN']);
  } catch (_error) {
    return new Response('Forbidden', { status: 403 });
  }

  const prisma = getPrisma();
  const applications = await prisma.franchiseApplication.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const header = [
    'id',
    'createdAt',
    'status',
    'fullName',
    'email',
    'cityZones',
    'message',
    'userId',
    'userName',
    'userEmail',
  ];

  const rows = applications.map((app) =>
    [
      app.id,
      app.createdAt.toISOString(),
      app.status,
      app.fullName,
      app.email,
      app.cityZones,
      app.message ?? '',
      app.userId ?? '',
      app.user?.name ?? '',
      app.user?.email ?? '',
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csv = [header.join(','), ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="franchise-applications.csv"',
    },
  });
}
