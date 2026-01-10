import { permanentRedirect } from 'next/navigation';

export default async function AdminRequestAliasPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/admin/requests/${id}`);
}
