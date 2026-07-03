import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrderStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/requests/${id}`);
}
