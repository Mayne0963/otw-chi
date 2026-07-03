export function getFounderDriverEmails() {
  const raw = process.env.FOUNDER_DRIVER_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isFounderDriverEmail(email: string | null | undefined) {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  const allowed = getFounderDriverEmails();
  return allowed.includes(normalized);
}
