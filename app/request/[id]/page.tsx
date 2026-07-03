import { permanentRedirect } from 'next/navigation';

export default async function RequestAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        if (typeof value === 'string') {
          query.append(key, value);
        }
      }
      continue;
    }
    if (typeof rawValue === 'string') {
      query.append(key, rawValue);
    }
  }

  const queryString = query.toString();
  permanentRedirect(queryString ? `/requests/${id}?${queryString}` : `/requests/${id}`);
}
