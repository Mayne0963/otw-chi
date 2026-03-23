import { describe, expect, it } from 'vitest';
import {
  buildBusinessAddressSummary,
  businessMembershipInvoiceRequestSchema,
  businessMembershipProfileFormSchema,
  formatBusinessCountryLabel,
  formatBusinessIndustryLabel,
  getBusinessAddressFieldsFromGeocodedAddress,
  selectedBusinessAddressMatchesForm,
} from './business-membership-profile';

const validBusinessProfileInput = {
  businessLegalName: 'Acme Logistics Group LLC',
  employeeCount: '25',
  primaryBusinessStreetAddress: '123 Main Street',
  primaryBusinessCity: 'Fort Wayne',
  primaryBusinessStateProvince: 'Indiana',
  primaryBusinessPostalCode: '46802',
  primaryBusinessCountry: 'US',
  industryType: 'LOGISTICS',
  primaryContactFullName: 'Jordan Smith',
  primaryContactEmail: 'membership@acme.com',
  primaryContactPhone: '(260) 555-0123',
  businessWebsiteUrl: 'www.acme.com',
  taxIdVatNumber: '',
};

describe('business membership profile form', () => {
  it('normalizes valid business membership details for storage', () => {
    const parsed = businessMembershipProfileFormSchema.parse(validBusinessProfileInput);

    expect(parsed.employeeCount).toBe(25);
    expect(parsed.businessWebsiteUrl).toBe('https://www.acme.com');
    expect(parsed.taxIdVatNumber).toBeNull();
    expect(parsed.primaryBusinessCountry).toBe('US');
    expect(parsed.industryType).toBe('LOGISTICS');
  });

  it('rejects invalid employee counts, phones, and website urls', () => {
    const parsed = businessMembershipProfileFormSchema.safeParse({
      ...validBusinessProfileInput,
      employeeCount: '25.5',
      primaryContactPhone: '555-1234',
      businessWebsiteUrl: 'https://',
    });

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      throw new Error('Expected invalid business membership profile input to fail validation.');
    }

    const fieldErrors = parsed.error.flatten().fieldErrors;
    expect(fieldErrors.employeeCount?.[0]).toBe('Employee count must be a whole number.');
    expect(fieldErrors.primaryContactPhone?.[0]).toBe('Phone number must include at least 10 digits.');
    expect(fieldErrors.businessWebsiteUrl?.[0]).toBe('Enter a valid website URL.');
  });

  it('builds readable business labels and address summaries', () => {
    expect(formatBusinessIndustryLabel('PROFESSIONAL_SERVICES')).toBe('Professional Services');
    expect(formatBusinessCountryLabel('US')).toBe('United States');
    expect(
      buildBusinessAddressSummary({
        primaryBusinessStreetAddress: '123 Main Street',
        primaryBusinessCity: 'Fort Wayne',
        primaryBusinessStateProvince: 'Indiana',
        primaryBusinessPostalCode: '46802',
        primaryBusinessCountry: 'US',
      }),
    ).toBe('123 Main Street, Fort Wayne, Indiana 46802, United States');
  });

  it('derives a complete street address from a selected geocoded result', () => {
    const mapped = getBusinessAddressFieldsFromGeocodedAddress({
      formattedAddress:
        "Broski's Kitchen LLC, 30 E Main St, Fort Wayne, Indiana 46806, United States",
      placeName: "Broski's Kitchen LLC",
      streetAddress: '30',
      city: 'Fort Wayne',
      state: 'Indiana',
      zipCode: '46806',
      latitude: 41.0,
      longitude: -85.0,
      serviceAreaName: 'Fort Wayne',
      distanceFromServiceArea: 1,
      distanceFromFortWayne: 1,
      isWithinServiceArea: true,
    });

    expect(mapped.primaryBusinessStreetAddress).toBe('30 E Main St');
    expect(mapped.primaryBusinessCity).toBe('Fort Wayne');
    expect(mapped.primaryBusinessStateProvince).toBe('Indiana');
    expect(mapped.primaryBusinessPostalCode).toBe('46806');
    expect(mapped.primaryBusinessCountry).toBe('US');
  });

  it('accepts a selected searched address as the exact validated address when it matches the form', () => {
    expect(
      selectedBusinessAddressMatchesForm(validBusinessProfileInput, {
        formattedAddress: '123 Main Street, Fort Wayne, Indiana 46802, United States',
        streetAddress: '123 Main Street',
        city: 'Fort Wayne',
        state: 'Indiana',
        zipCode: '46802',
        latitude: 41.0,
        longitude: -85.0,
        serviceAreaName: 'Fort Wayne',
        distanceFromServiceArea: 1,
        distanceFromFortWayne: 1,
        isWithinServiceArea: true,
      }),
    ).toBe(true);
  });

  it('accepts invoice request metadata with the shared business fields', () => {
    const parsed = businessMembershipInvoiceRequestSchema.parse({
      ...validBusinessProfileInput,
      planName: 'OTW BUSINESS PRO',
      planId: 'plan_123',
    });

    expect(parsed.planName).toBe('OTW BUSINESS PRO');
    expect(parsed.planId).toBe('plan_123');
    expect(parsed.employeeCount).toBe(25);
  });
});
