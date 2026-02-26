import { permanentRedirect } from 'next/navigation';

export default async function RequestAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/requests/${id}`);
}
