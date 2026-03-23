import { z } from 'zod';
import { countPhoneDigits, formatPhoneNumber } from '@/lib/phone';

export const BUSINESS_COUNTRY_VALUES = [
  'US',
  'CA',
  'MX',
  'GB',
  'IE',
  'AU',
  'NZ',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'BE',
  'SE',
  'NO',
  'DK',
  'FI',
  'CH',
  'AT',
  'PL',
  'IN',
  'JP',
  'SG',
  'AE',
  'OTHER',
] as const;

export type BusinessCountryValue = (typeof BUSINESS_COUNTRY_VALUES)[number];

export const BUSINESS_COUNTRY_LABELS: Record<BusinessCountryValue, string> = {
  US: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
  GB: 'United Kingdom',
  IE: 'Ireland',
  AU: 'Australia',
  NZ: 'New Zealand',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BE: 'Belgium',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  CH: 'Switzerland',
  AT: 'Austria',
  PL: 'Poland',
  IN: 'India',
  JP: 'Japan',
  SG: 'Singapore',
  AE: 'United Arab Emirates',
  OTHER: 'Other',
};

export const BUSINESS_COUNTRY_OPTIONS = BUSINESS_COUNTRY_VALUES.map((value) => ({
  value,
  label: BUSINESS_COUNTRY_LABELS[value],
}));

export const BUSINESS_INDUSTRY_VALUES = [
  'PROFESSIONAL_SERVICES',
  'REAL_ESTATE',
  'HEALTHCARE',
  'LEGAL',
  'CONSTRUCTION',
  'HOSPITALITY',
  'RETAIL',
  'MANUFACTURING',
  'LOGISTICS',
  'AUTOMOTIVE',
  'EDUCATION',
  'NONPROFIT',
  'GOVERNMENT',
  'FINANCIAL_SERVICES',
  'TECHNOLOGY',
  'PROPERTY_MANAGEMENT',
  'RELIGIOUS_ORGANIZATION',
  'OTHER',
] as const;

export type BusinessIndustryValue = (typeof BUSINESS_INDUSTRY_VALUES)[number];

export const BUSINESS_INDUSTRY_LABELS: Record<BusinessIndustryValue, string> = {
  PROFESSIONAL_SERVICES: 'Professional Services',
  REAL_ESTATE: 'Real Estate',
  HEALTHCARE: 'Healthcare',
  LEGAL: 'Legal',
  CONSTRUCTION: 'Construction',
  HOSPITALITY: 'Hospitality',
  RETAIL: 'Retail',
  MANUFACTURING: 'Manufacturing',
  LOGISTICS: 'Logistics',
  AUTOMOTIVE: 'Automotive',
  EDUCATION: 'Education',
  NONPROFIT: 'Nonprofit',
  GOVERNMENT: 'Government',
  FINANCIAL_SERVICES: 'Financial Services',
  TECHNOLOGY: 'Technology',
  PROPERTY_MANAGEMENT: 'Property Management',
  RELIGIOUS_ORGANIZATION: 'Religious Organization',
  OTHER: 'Other',
};

export const BUSINESS_INDUSTRY_OPTIONS = BUSINESS_INDUSTRY_VALUES.map((value) => ({
  value,
  label: BUSINESS_INDUSTRY_LABELS[value],
}));

const businessCountryValueSet = new Set<string>(BUSINESS_COUNTRY_VALUES);
const businessIndustryValueSet = new Set<string>(BUSINESS_INDUSTRY_VALUES);
const MAX_EMPLOYEE_COUNT = 1_000_000;
const MAX_WEBSITE_LENGTH = 200;
const MAX_TAX_ID_LENGTH = 64;

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWebsiteUrl(value: string | null | undefined): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const businessMembershipProfileFormSchema = z.object({
  businessLegalName: z
    .string()
    .trim()
    .min(2, 'Enter the full legal business name.')
    .max(160, 'Business legal name is too long.'),
  employeeCount: z
    .string()
    .trim()
    .min(1, 'Enter the number of employees.')
    .refine((value) => /^\d+$/.test(value), 'Employee count must be a whole number.')
    .transform((value) => Number(value))
    .refine((value) => value >= 1, 'Employee count must be at least 1.')
    .refine((value) => value <= MAX_EMPLOYEE_COUNT, 'Employee count is too large.'),
  primaryBusinessStreetAddress: z
    .string()
    .trim()
    .min(3, 'Enter the primary business street address.')
    .max(160, 'Street address is too long.'),
  primaryBusinessCity: z.string().trim().min(2, 'Enter the city.').max(100, 'City is too long.'),
  primaryBusinessStateProvince: z
    .string()
    .trim()
    .min(2, 'Enter the state or province.')
    .max(100, 'State or province is too long.'),
  primaryBusinessPostalCode: z
    .string()
    .trim()
    .min(3, 'Enter the postal code.')
    .max(20, 'Postal code is too long.'),
  primaryBusinessCountry: z
    .string()
    .trim()
    .min(1, 'Select a country.')
    .refine((value) => businessCountryValueSet.has(value), 'Select a valid country.')
    .transform((value) => value as BusinessCountryValue),
  industryType: z
    .string()
    .trim()
    .min(1, 'Select an industry type.')
    .refine((value) => businessIndustryValueSet.has(value), 'Select a valid industry type.')
    .transform((value) => value as BusinessIndustryValue),
  primaryContactFullName: z
    .string()
    .trim()
    .min(2, 'Enter the full name for the primary membership contact.')
    .max(120, 'Contact name is too long.'),
  primaryContactEmail: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(160, 'Email address is too long.'),
  primaryContactPhone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number.')
    .max(32, 'Phone number is too long.')
    .transform((value) => formatPhoneNumber(value))
    .refine((value) => countPhoneDigits(value) >= 10, 'Phone number must include at least 10 digits.'),
  businessWebsiteUrl: z
    .string()
    .trim()
    .max(MAX_WEBSITE_LENGTH, 'Website URL is too long.')
    .optional()
    .or(z.literal(''))
    .transform((value) => normalizeWebsiteUrl(value))
    .refine((value) => value === null || URL.canParse(value), 'Enter a valid website URL.'),
  taxIdVatNumber: z
    .string()
    .trim()
    .max(MAX_TAX_ID_LENGTH, 'Tax ID / VAT number is too long.')
    .optional()
    .or(z.literal(''))
    .transform((value) => normalizeOptionalText(value)),
});

export type BusinessMembershipProfileFormInput = z.input<typeof businessMembershipProfileFormSchema>;
export type BusinessMembershipProfileFormValues = z.output<typeof businessMembershipProfileFormSchema>;

export const businessMembershipInvoiceRequestSchema = businessMembershipProfileFormSchema.extend({
  planName: z
    .string()
    .trim()
    .min(2, 'Select a business membership plan.')
    .max(120, 'Plan name is too long.'),
  planId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((value) => normalizeOptionalText(value)),
});

export type BusinessMembershipInvoiceRequestInput = z.input<typeof businessMembershipInvoiceRequestSchema>;
export type BusinessMembershipInvoiceRequestValues = z.output<typeof businessMembershipInvoiceRequestSchema>;

export function getBusinessMembershipProfileFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([key, messages]) => [key, messages?.[0] ?? 'Invalid value.'])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
  );
}

export function formatBusinessIndustryLabel(value: string | null | undefined): string {
  if (!value) return 'Unspecified';
  return BUSINESS_INDUSTRY_LABELS[value as BusinessIndustryValue] ?? value.replaceAll('_', ' ');
}

export function formatBusinessCountryLabel(value: string | null | undefined): string {
  if (!value) return 'Unspecified';
  return BUSINESS_COUNTRY_LABELS[value as BusinessCountryValue] ?? value;
}

export function buildBusinessAddressSummary(values: {
  primaryBusinessStreetAddress: string | null | undefined;
  primaryBusinessCity: string | null | undefined;
  primaryBusinessStateProvince: string | null | undefined;
  primaryBusinessPostalCode: string | null | undefined;
  primaryBusinessCountry: string | null | undefined;
}): string {
  return [
    values.primaryBusinessStreetAddress,
    `${values.primaryBusinessCity}, ${values.primaryBusinessStateProvince} ${values.primaryBusinessPostalCode}`.trim(),
    formatBusinessCountryLabel(values.primaryBusinessCountry),
  ]
    .filter(Boolean)
    .join(', ');
}

export function shouldValidateBusinessAddress(country: BusinessCountryValue): boolean {
  return country === 'US';
}
