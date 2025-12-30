import { redirect } from 'next/navigation';

export default async function AdminDriverAliasEditPage({
  params
}: {
  params: { id: string };
}) {
  redirect(`/admin/drivers/${params.id}/edit`);
}
