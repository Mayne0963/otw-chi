import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SettingsSearchParams = {
  saved?: string;
  error?: string;
};

const FIELD_LIMITS = {
  name: 80,
  phone: 40,
  defaultPickup: 255,
  defaultDropoff: 255,
} as const;

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) return '';
  return value.toISOString().slice(0, 10);
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSettingsErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case 'invalid_dob':
      return 'Date of birth must be a valid date.';
    case 'future_dob':
      return 'Date of birth cannot be in the future.';
    case 'underage_dob':
      return 'Date of birth must indicate an age of at least 13 years.';
    case 'save_failed':
      return 'Unable to save your settings right now. Please try again.';
    default:
      return null;
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SettingsSearchParams>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const saved = readSearchParam(params.saved);
  const errorCode = readSearchParam(params.error);
  const saveSucceeded = saved === '1' || saved === 'true';
  const errorMessage = getSettingsErrorMessage(errorCode);

  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Account Settings" subtitle="Manage your account details." />
        <Card className="mt-3 p-5 sm:p-6">
          <div className="text-sm">Please sign in.</div>
        </Card>
      </OtwPageShell>
    );
  }

  const prisma = getPrisma();
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
    select: {
      phone: true,
      defaultPickup: true,
      defaultDropoff: true,
    },
  });

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Account Settings" subtitle="Manage your profile and saved addresses." />

      {saveSucceeded ? (
        <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-400">
          Settings saved successfully.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white">Profile</h3>
          <p className="mt-1 text-sm text-white/60">
            Update your contact info and default pickup/dropoff addresses.
          </p>

          <form action={saveSettings} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="settings-name"
                  className="text-xs font-semibold uppercase tracking-wide text-white/55"
                >
                  Full Name
                </label>
                <Input
                  id="settings-name"
                  name="name"
                  maxLength={FIELD_LIMITS.name}
                  defaultValue={user.name ?? ''}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="settings-phone"
                  className="text-xs font-semibold uppercase tracking-wide text-white/55"
                >
                  Phone
                </label>
                <Input
                  id="settings-phone"
                  name="phone"
                  maxLength={FIELD_LIMITS.phone}
                  defaultValue={profile?.phone ?? ''}
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="settings-email"
                className="text-xs font-semibold uppercase tracking-wide text-white/55"
              >
                Email
              </label>
              <Input
                id="settings-email"
                value={user.email}
                readOnly
                disabled
                className="opacity-80"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="settings-dob"
                className="text-xs font-semibold uppercase tracking-wide text-white/55"
              >
                Date of Birth
              </label>
              <Input
                id="settings-dob"
                type="date"
                name="dob"
                defaultValue={formatDateOnly(user.dob)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="settings-default-pickup"
                  className="text-xs font-semibold uppercase tracking-wide text-white/55"
                >
                  Default Pickup
                </label>
                <Input
                  id="settings-default-pickup"
                  name="defaultPickup"
                  maxLength={FIELD_LIMITS.defaultPickup}
                  defaultValue={profile?.defaultPickup ?? ''}
                  placeholder="Saved pickup address"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="settings-default-dropoff"
                  className="text-xs font-semibold uppercase tracking-wide text-white/55"
                >
                  Default Dropoff
                </label>
                <Input
                  id="settings-default-dropoff"
                  name="defaultDropoff"
                  maxLength={FIELD_LIMITS.defaultDropoff}
                  defaultValue={profile?.defaultDropoff ?? ''}
                  placeholder="Saved dropoff address"
                />
              </div>
            </div>

            <Button variant="gold" type="submit">
              Save Settings
            </Button>
          </form>
        </Card>

        <Card className="p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-white">Account</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Role</span>
              <span className="font-medium text-white">{user.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Member Since</span>
              <span className="font-medium text-white">
                {user.createdAt.toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Terms Accepted</span>
              <span className="font-medium text-white">
                {user.termsAcceptedAt ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Privacy Accepted</span>
              <span className="font-medium text-white">
                {user.privacyAcceptedAt ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60">
            Authentication is managed securely through Neon Auth for this account.
          </div>
        </Card>
      </div>
    </OtwPageShell>
  );
}

export async function saveSettings(formData: FormData) {
  'use server';

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/sign-in');
  }

  const name = normalizeOptionalText(formData.get('name'), FIELD_LIMITS.name);
  const phone = normalizeOptionalText(formData.get('phone'), FIELD_LIMITS.phone);
  const defaultPickup = normalizeOptionalText(
    formData.get('defaultPickup'),
    FIELD_LIMITS.defaultPickup,
  );
  const defaultDropoff = normalizeOptionalText(
    formData.get('defaultDropoff'),
    FIELD_LIMITS.defaultDropoff,
  );
  const dobInput = typeof formData.get('dob') === 'string' ? String(formData.get('dob')).trim() : '';

  let dob: Date | null = null;
  if (dobInput.length > 0) {
    const parsedDob = new Date(`${dobInput}T00:00:00.000Z`);
    if (Number.isNaN(parsedDob.getTime())) {
      redirect('/settings?error=invalid_dob');
    }

    const now = new Date();
    if (parsedDob.getTime() > now.getTime()) {
      redirect('/settings?error=future_dob');
    }

    let age = now.getUTCFullYear() - parsedDob.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - parsedDob.getUTCMonth();
    const dayDelta = now.getUTCDate() - parsedDob.getUTCDate();
    if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
      age -= 1;
    }
    if (age < 13) {
      redirect('/settings?error=underage_dob');
    }

    dob = parsedDob;
  }

  const prisma = getPrisma();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          name,
          dob,
        },
      });

      await tx.customerProfile.upsert({
        where: { userId: currentUser.id },
        update: {
          phone,
          defaultPickup,
          defaultDropoff,
        },
        create: {
          userId: currentUser.id,
          phone,
          defaultPickup,
          defaultDropoff,
        },
      });
    });
  } catch (error) {
    console.error('[settings] Failed to save account settings', error);
    redirect('/settings?error=save_failed');
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings?saved=1');
}
