import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { validateAddress } from '@/lib/geocoding';
import {
  buildBusinessAddressSummary,
  businessMembershipProfileFormSchema,
  getBusinessMembershipProfileFieldErrors,
  shouldValidateBusinessAddress,
} from '@/lib/business-membership-profile';
import { getActiveSubscriptionUncached, isBusinessMembershipPlanName } from '@/lib/membership';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'You must be signed in to manage a business membership profile.' }, { status: 401 });
    }

    const subscription = await getActiveSubscriptionUncached(currentUser.id);
    if (!subscription?.plan || !isBusinessMembershipPlanName(subscription.plan.name)) {
      return NextResponse.json(
        { error: 'An active business membership is required before submitting business details.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = businessMembershipProfileFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Please correct the highlighted fields and try again.',
          fieldErrors: getBusinessMembershipProfileFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    let validatedAddress: string | null = null;
    let addressValidatedAt: Date | null = null;

    if (shouldValidateBusinessAddress(data.primaryBusinessCountry)) {
      const validationCandidate = buildBusinessAddressSummary(data);
      const verifiedAddress = await validateAddress(validationCandidate).catch(() => null);
      if (!verifiedAddress) {
        return NextResponse.json(
          {
            error: 'We could not verify the business address provided.',
            fieldErrors: {
              primaryBusinessStreetAddress:
                'We could not verify this U.S. address. Check the street, city, state, and postal code.',
            },
          },
          { status: 400 },
        );
      }

      validatedAddress = verifiedAddress.formattedAddress;
      addressValidatedAt = new Date();
    }

    const prisma = getPrisma();
    const profile = await prisma.businessMembershipProfile.upsert({
      where: { membershipId: subscription.id },
      update: {
        userId: currentUser.id,
        businessLegalName: data.businessLegalName,
        employeeCount: data.employeeCount,
        primaryBusinessStreetAddress: data.primaryBusinessStreetAddress,
        primaryBusinessCity: data.primaryBusinessCity,
        primaryBusinessStateProvince: data.primaryBusinessStateProvince,
        primaryBusinessPostalCode: data.primaryBusinessPostalCode,
        primaryBusinessCountry: data.primaryBusinessCountry,
        industryType: data.industryType,
        primaryContactFullName: data.primaryContactFullName,
        primaryContactEmail: data.primaryContactEmail,
        primaryContactPhone: data.primaryContactPhone,
        businessWebsiteUrl: data.businessWebsiteUrl,
        taxIdVatNumber: data.taxIdVatNumber,
        validatedAddress,
        addressValidatedAt,
      },
      create: {
        membershipId: subscription.id,
        userId: currentUser.id,
        businessLegalName: data.businessLegalName,
        employeeCount: data.employeeCount,
        primaryBusinessStreetAddress: data.primaryBusinessStreetAddress,
        primaryBusinessCity: data.primaryBusinessCity,
        primaryBusinessStateProvince: data.primaryBusinessStateProvince,
        primaryBusinessPostalCode: data.primaryBusinessPostalCode,
        primaryBusinessCountry: data.primaryBusinessCountry,
        industryType: data.industryType,
        primaryContactFullName: data.primaryContactFullName,
        primaryContactEmail: data.primaryContactEmail,
        primaryContactPhone: data.primaryContactPhone,
        businessWebsiteUrl: data.businessWebsiteUrl,
        taxIdVatNumber: data.taxIdVatNumber,
        validatedAddress,
        addressValidatedAt,
      },
      select: {
        businessLegalName: true,
        employeeCount: true,
        primaryBusinessStreetAddress: true,
        primaryBusinessCity: true,
        primaryBusinessStateProvince: true,
        primaryBusinessPostalCode: true,
        primaryBusinessCountry: true,
        industryType: true,
        primaryContactFullName: true,
        primaryContactEmail: true,
        primaryContactPhone: true,
        businessWebsiteUrl: true,
        taxIdVatNumber: true,
        validatedAddress: true,
        updatedAt: true,
      },
    });

    revalidatePath('/membership/manage');
    revalidatePath('/admin/memberships');

    return NextResponse.json({
      success: true,
      message: 'Business membership details saved successfully.',
      profile,
    });
  } catch (error) {
    console.error('[BusinessMembershipProfile] Failed to save business profile:', error);
    return NextResponse.json(
      { error: 'Unable to save your business membership details right now. Please try again.' },
      { status: 500 },
    );
  }
}
