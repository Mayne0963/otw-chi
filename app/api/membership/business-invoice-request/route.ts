import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { validateAddress } from '@/lib/geocoding';
import {
  buildBusinessAddressSummary,
  businessMembershipInvoiceRequestSchema,
  getBusinessMembershipProfileFieldErrors,
  selectedBusinessAddressMatchesForm,
  selectedBusinessAddressSchema,
  shouldValidateBusinessAddress,
} from '@/lib/business-membership-profile';
import { isBusinessMembershipPlanName } from '@/lib/membership';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    const body = await req.json().catch(() => null);
    const parsed = businessMembershipInvoiceRequestSchema.safeParse(body);
    const selectedAddress = selectedBusinessAddressSchema.safeParse(
      body && typeof body === 'object' && 'selectedBusinessAddress' in body
        ? (body as Record<string, unknown>).selectedBusinessAddress
        : undefined,
    );

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
    const prisma = getPrisma();
    const planRecord = data.planId
      ? await prisma.membershipPlan.findUnique({
          where: { id: data.planId },
          select: { id: true, name: true },
        })
      : await prisma.membershipPlan.findFirst({
          where: { name: data.planName },
          select: { id: true, name: true },
        });

    const resolvedPlanName = planRecord?.name ?? data.planName;
    if (!isBusinessMembershipPlanName(resolvedPlanName)) {
      return NextResponse.json(
        { error: 'Select a valid business membership plan before requesting an invoice.' },
        { status: 400 },
      );
    }

    let validatedAddress: string | null = null;
    let addressValidatedAt: Date | null = null;

    if (shouldValidateBusinessAddress(data.primaryBusinessCountry)) {
      const matchedSelectedAddress =
        selectedAddress.success &&
        selectedBusinessAddressMatchesForm(data, selectedAddress.data)
          ? selectedAddress.data
          : null;

      if (matchedSelectedAddress) {
        validatedAddress = matchedSelectedAddress.formattedAddress;
        addressValidatedAt = new Date();
      } else {
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
    }

    const invoiceRequest = await prisma.businessMembershipInvoiceRequest.create({
      data: {
        userId: currentUser?.id ?? null,
        planName: resolvedPlanName,
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
        id: true,
        planName: true,
        validatedAddress: true,
      },
    });

    revalidatePath('/admin/memberships');

    return NextResponse.json({
      success: true,
      message: `Invoice request received for ${invoiceRequest.planName}. OTW will follow up with your business contact shortly.`,
      invoiceRequest,
    });
  } catch (error) {
    console.error('[BusinessMembershipInvoiceRequest] Failed to create invoice request:', error);
    return NextResponse.json(
      { error: 'Unable to submit your business invoice request right now. Please try again.' },
      { status: 500 },
    );
  }
}
