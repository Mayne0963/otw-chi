import { redirect } from "next/navigation";

export default function AdminDriverRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, v);
      } else {
        qs.set(key, value);
      }
    }
  }

  const suffix = qs.size ? `?${qs.toString()}` : "";
  redirect(`/admin/drivers${suffix}`);
}
