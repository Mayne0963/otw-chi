import type { PrismaClient, User } from '@prisma/client';

/**
 * Shared-secret auth for partner (restaurant) order intake, e.g. Broski's Kitchen
 * handing off delivery orders to OTW.
 *
 * The partner sends:
 *   Authorization: Bearer <OTW_PARTNER_API_KEY>
 *   X-Restaurant-ID: <partner restaurant id>
 */
export function isAuthorizedPartnerRequest(req: Request): boolean {
  const configured = process.env.OTW_PARTNER_API_KEY;
  if (!configured) return false;

  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim();
  if (!provided) return false;

  // Constant-time-ish comparison
  if (provided.length !== configured.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ configured.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Find or auto-provision the OTW customer account for a partner-originated order.
 *
 * Customers who order through Broski's automatically get a linked OTW account
 * keyed on their email. Placing the order records their acceptance of terms.
 *
 * NOTE: the account is DB-linked but not yet claimable via Neon Auth login. When
 * the customer later signs up with the same email, that flow must reconcile /
 * attach this record (synthesized neonAuthId `broskis-partner:<email>`).
 */
export async function findOrCreatePartnerCustomer(
  prisma: PrismaClient,
  input: { email: string; name?: string | null },
): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error('Customer email is required to link an OTW account');
  }

  // Case-insensitive match so this reconciles with the same record getCurrentUser()
  // will later claim when the customer signs up via Neon Auth with this email.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existing) return existing;

  const now = new Date();
  const created = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      neonAuthId: `broskis-partner:${email}`,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    },
  });

  // Parity with a natively-created customer (best-effort; non-fatal).
  await prisma.customerProfile
    .create({ data: { userId: created.id } })
    .catch((profileError) => {
      console.error('[partner-auth] Failed to create customerProfile:', profileError);
    });

  return created;
}
