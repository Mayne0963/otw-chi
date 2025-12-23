import { getPrisma } from '@/lib/db';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { clerkClient } from '@clerk/nextjs/server';
import { Role } from '@/lib/generated/prisma';

type ClerkUserEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserData = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: ClerkUserEmailAddress[];
};

type ClerkWebhookEvent = {
  type: 'user.created' | 'user.updated' | string;
  data: ClerkUserData;
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Missing CLERK_WEBHOOK_SECRET' }, { status: 500 });
  }

  const prisma = getPrisma();
  const payload = await req.text();
  const headerList = await headers();

  const svixId = headerList.get('svix-id');
  const svixTimestamp = headerList.get('svix-timestamp');
  const svixSignature = headerList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  const webhook = new Webhook(secret);

  let event: ClerkWebhookEvent;
  try {
    event = webhook.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'user.created' && event.type !== 'user.updated') {
    return NextResponse.json({ ok: true });
  }

  const clerkUserId = event.data.id;
  const primaryEmailId = event.data.primary_email_address_id;
  const primaryEmail =
    event.data.email_addresses.find((e) => e.id === primaryEmailId)?.email_address ??
    event.data.email_addresses[0]?.email_address ??
    null;

  if (!primaryEmail) {
    return NextResponse.json({ error: 'Missing primary email' }, { status: 400 });
  }

  // First, upsert the user in Neon DB
  const user = await prisma.user.upsert({
    where: { clerkId: clerkUserId },
    create: {
      email: primaryEmail,
      clerkId: clerkUserId,
      role: 'CUSTOMER' as Role, // Default role
    },
    update: {
      email: primaryEmail,
    },
  });

  // Then sync the role back to Clerk publicMetadata
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    const currentRole = String(clerkUser.publicMetadata?.role || '').toUpperCase();
    const dbRole = user.role;

    // Only update if role has changed or is missing
    if (currentRole !== dbRole) {
      await client.users.updateUser(clerkUserId, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          role: dbRole
        }
      });

      console.warn(`[ClerkWebhook] Synced role for user ${clerkUserId}: ${currentRole} -> ${dbRole}`);
    }
  } catch (error) {
    console.error('[ClerkWebhook] Failed to sync role to Clerk:', error);
    // Don't fail the webhook if role sync fails - user is still created/updated in DB
  }

  return NextResponse.json({ ok: true });
}