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
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const header = [
    'id',
    'createdAt',
    'email',
    'message',
    'userId',
    'userName',
    'userEmail',
  ];

  const rows = messages.map((message) =>
    [
      message.id,
      message.createdAt.toISOString(),
      message.email,
      message.message,
      message.userId ?? '',
      message.user?.name ?? '',
      message.user?.email ?? '',
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csv = [header.join(','), ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contact-messages.csv"',
    },
  });
}
