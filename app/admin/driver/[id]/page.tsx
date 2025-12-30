import { redirect } from 'next/navigation';

export default async function AdminDriverAliasPage({
  params
}: {
  params: { id: string };
}) {
  redirect(`/admin/drivers/${params.id}`);
}
