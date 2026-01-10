import { redirect, RedirectType } from 'next/navigation';

export default async function AdminRequestAliasPage({
  params
}: {
  params: { id: string };
}) {
  redirect(`/admin/requests/${params.id}`, RedirectType.Permanent);
}
