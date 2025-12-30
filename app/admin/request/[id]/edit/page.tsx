import { redirect } from 'next/navigation';

export default async function AdminRequestAliasEditPage({
  params
}: {
  params: { id: string };
}) {
  redirect(`/admin/requests/${params.id}/edit`);
}
