'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, PencilLine, Save } from 'lucide-react';
import OtwButton from '@/components/ui/otw/OtwButton';
import { Input } from '@/components/ui/input';
import PhoneInput from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AddressSearch } from '@/components/ui/address-search';
import {
  BUSINESS_COUNTRY_OPTIONS,
  BUSINESS_INDUSTRY_OPTIONS,
  buildBusinessAddressSummary,
  businessMembershipProfileFormSchema,
  formatBusinessCountryLabel,
  formatBusinessIndustryLabel,
  getBusinessAddressFieldsFromGeocodedAddress,
  getBusinessMembershipProfileFieldErrors,
} from '@/lib/business-membership-profile';
import { formatAddressLines, type GeocodedAddress } from '@/lib/geocoding';

type BusinessMembershipProfileDraft = {
  businessLegalName: string;
  employeeCount: string;
  primaryBusinessStreetAddress: string;
  primaryBusinessCity: string;
  primaryBusinessStateProvince: string;
  primaryBusinessPostalCode: string;
  primaryBusinessCountry: string;
  industryType: string;
  primaryContactFullName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  businessWebsiteUrl: string;
  taxIdVatNumber: string;
};

type BusinessMembershipProfileDraftSource = {
  businessLegalName?: string | null;
  employeeCount?: number | string | null;
  primaryBusinessStreetAddress?: string | null;
  primaryBusinessCity?: string | null;
  primaryBusinessStateProvince?: string | null;
  primaryBusinessPostalCode?: string | null;
  primaryBusinessCountry?: string | null;
  industryType?: string | null;
  primaryContactFullName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  businessWebsiteUrl?: string | null;
  taxIdVatNumber?: string | null;
};

const BUSINESS_ADDRESS_FIELD_NAMES = new Set<keyof BusinessMembershipProfileDraft>([
  'primaryBusinessStreetAddress',
  'primaryBusinessCity',
  'primaryBusinessStateProvince',
  'primaryBusinessPostalCode',
  'primaryBusinessCountry',
]);

type BusinessMembershipProfileResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  profile?: {
    businessLegalName: string;
    employeeCount: number;
    primaryBusinessStreetAddress: string;
    primaryBusinessCity: string;
    primaryBusinessStateProvince: string;
    primaryBusinessPostalCode: string;
    primaryBusinessCountry: string;
    industryType: string;
    primaryContactFullName: string;
    primaryContactEmail: string;
    primaryContactPhone: string;
    businessWebsiteUrl: string | null;
    taxIdVatNumber: string | null;
    validatedAddress: string | null;
    updatedAt: string;
  };
};

function toDraft(profile: BusinessMembershipProfileDraftSource): BusinessMembershipProfileDraft {
  return {
    businessLegalName: profile.businessLegalName ?? '',
    employeeCount:
      typeof profile.employeeCount === 'number'
        ? String(profile.employeeCount)
        : (profile.employeeCount ?? ''),
    primaryBusinessStreetAddress: profile.primaryBusinessStreetAddress ?? '',
    primaryBusinessCity: profile.primaryBusinessCity ?? '',
    primaryBusinessStateProvince: profile.primaryBusinessStateProvince ?? '',
    primaryBusinessPostalCode: profile.primaryBusinessPostalCode ?? '',
    primaryBusinessCountry: profile.primaryBusinessCountry ?? 'US',
    industryType: profile.industryType ?? '',
    primaryContactFullName: profile.primaryContactFullName ?? '',
    primaryContactEmail: profile.primaryContactEmail ?? '',
    primaryContactPhone: profile.primaryContactPhone ?? '',
    businessWebsiteUrl: profile.businessWebsiteUrl ?? '',
    taxIdVatNumber: profile.taxIdVatNumber ?? '',
  };
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-white/55">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs leading-5 text-red-300">{message}</p>;
}

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 text-sm text-white/90">{value}</div>
    </div>
  );
}

function buildSummaryWebsiteLabel(url: string | null) {
  if (!url) return 'Not provided';
  return url.replace(/^https?:\/\//i, '');
}

export default function BusinessMembershipProfileForm({
  planName,
  hasSavedProfile,
  initialValidatedAddress,
  initialValues,
}: {
  planName: string;
  hasSavedProfile: boolean;
  initialValidatedAddress?: string | null;
  initialValues: BusinessMembershipProfileDraft;
}) {
  const [values, setValues] = useState<BusinessMembershipProfileDraft>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileOnFile, setProfileOnFile] = useState(hasSavedProfile);
  const [savedValidatedAddress, setSavedValidatedAddress] = useState<string | null>(
    initialValidatedAddress ?? null,
  );
  const [searchedAddress, setSearchedAddress] = useState<GeocodedAddress | null>(null);

  const reviewValues = useMemo(() => {
    const parsed = businessMembershipProfileFormSchema.safeParse(values);
    return parsed.success ? parsed.data : null;
  }, [values]);

  const handleChange = (name: keyof BusinessMembershipProfileDraft, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    if (BUSINESS_ADDRESS_FIELD_NAMES.has(name)) {
      setSearchedAddress(null);
      setSavedValidatedAddress(null);
    }
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleBusinessAddressSelect = (address: GeocodedAddress) => {
    setValues((current) => ({
      ...current,
      ...getBusinessAddressFieldsFromGeocodedAddress(address),
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.primaryBusinessStreetAddress;
      delete next.primaryBusinessCity;
      delete next.primaryBusinessStateProvince;
      delete next.primaryBusinessPostalCode;
      delete next.primaryBusinessCountry;
      return next;
    });
    setSearchedAddress(address);
    setSavedValidatedAddress(null);
    setFormError(null);
    setSuccessMessage(null);
  };

  const searchedAddressLines = searchedAddress ? formatAddressLines(searchedAddress) : null;

  const handleReview = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = businessMembershipProfileFormSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getBusinessMembershipProfileFieldErrors(parsed.error));
      setFormError('Please correct the highlighted fields before reviewing your submission.');
      setIsReviewing(false);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsReviewing(true);
  };

  const handleSubmit = async () => {
    const parsed = businessMembershipProfileFormSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getBusinessMembershipProfileFieldErrors(parsed.error));
      setFormError('Please correct the highlighted fields before submitting.');
      setIsReviewing(false);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/membership/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as BusinessMembershipProfileResponse | null;

      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors ?? {});
        setFormError(payload?.error ?? 'Unable to save your business membership details right now.');
        setIsReviewing(false);
        return;
      }

      const nextDraft = payload?.profile ? toDraft(payload.profile) : toDraft(parsed.data);
      setValues(nextDraft);
      setProfileOnFile(true);
      setSavedValidatedAddress(payload?.profile?.validatedAddress ?? null);
      setFieldErrors({});
      setFormError(null);
      setSuccessMessage(payload?.message ?? 'Business membership details saved successfully.');
      setIsReviewing(false);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Unable to save your business membership details right now.',
      );
      setIsReviewing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">Business Membership Profile</div>
          <div className="mt-1 text-sm text-white/65">
            Required for {planName}. We use this information for membership support, invoicing, and internal reporting.
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            profileOnFile
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          {profileOnFile ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
          {profileOnFile ? 'Profile on file' : 'Profile required'}
        </div>
      </div>

      {!profileOnFile ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Complete this business profile before relying on your business membership for internal billing and account management.
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      {formError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {formError}
        </div>
      ) : null}

      {isReviewing && reviewValues ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">Review before submission</div>
                <div className="mt-1 text-sm text-white/60">
                  Confirm the organization and contact details below before saving them to your membership record.
                </div>
              </div>
              <OtwButton variant="ghost" size="sm" onClick={() => setIsReviewing(false)}>
                <PencilLine className="h-4 w-4" />
                Edit details
              </OtwButton>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ReviewItem label="Business Legal Name" value={reviewValues.businessLegalName} />
              <ReviewItem label="Number of Employees" value={reviewValues.employeeCount.toLocaleString()} />
              <ReviewItem label="Industry Type" value={formatBusinessIndustryLabel(reviewValues.industryType)} />
              <ReviewItem label="Country" value={formatBusinessCountryLabel(reviewValues.primaryBusinessCountry)} />
              <ReviewItem label="Primary Business Location" value={buildBusinessAddressSummary(reviewValues)} />
              <ReviewItem label="Primary Contact" value={`${reviewValues.primaryContactFullName} · ${reviewValues.primaryContactEmail}`} />
              <ReviewItem label="Primary Contact Phone" value={reviewValues.primaryContactPhone} />
              <ReviewItem label="Business Website" value={buildSummaryWebsiteLabel(reviewValues.businessWebsiteUrl)} />
              <ReviewItem label="Tax ID / VAT Number" value={reviewValues.taxIdVatNumber || 'Not provided'} />
              {savedValidatedAddress ? (
                <ReviewItem label="Verified Address on File" value={savedValidatedAddress} />
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <OtwButton variant="outline" onClick={() => setIsReviewing(false)}>
              Edit
            </OtwButton>
            <OtwButton onClick={handleSubmit} disabled={isSubmitting}>
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Submit Business Profile'}
            </OtwButton>
          </div>
        </div>
      ) : (
        <form onSubmit={handleReview} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="businessLegalName">Business Legal Name</Label>
              <Input
                id="businessLegalName"
                value={values.businessLegalName}
                onChange={(event) => handleChange('businessLegalName', event.target.value)}
                placeholder="Acme Logistics Group LLC"
                aria-invalid={Boolean(fieldErrors.businessLegalName)}
                required
              />
              <FieldHelp>Use the full registered entity name for invoices, contracts, and membership records.</FieldHelp>
              <FieldError message={fieldErrors.businessLegalName} />
            </div>

            <div>
              <Label htmlFor="employeeCount">Number of Employees</Label>
              <Input
                id="employeeCount"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={values.employeeCount}
                onChange={(event) => handleChange('employeeCount', event.target.value)}
                placeholder="25"
                aria-invalid={Boolean(fieldErrors.employeeCount)}
                required
              />
              <FieldHelp>Enter the approximate total employee count covered by this business membership.</FieldHelp>
              <FieldError message={fieldErrors.employeeCount} />
            </div>

            <div>
              <Label htmlFor="industryType">Industry Type</Label>
              <Select
                id="industryType"
                value={values.industryType}
                onChange={(event) => handleChange('industryType', event.target.value)}
                aria-invalid={Boolean(fieldErrors.industryType)}
                required
              >
                <option value="">Select industry</option>
                {BUSINESS_INDUSTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldHelp>Select the closest match so OTW can route membership support and reporting correctly.</FieldHelp>
              <FieldError message={fieldErrors.industryType} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Primary Business Location</div>
            <div className="mt-1 text-sm text-white/60">
              U.S. addresses are automatically verified when you submit. For other countries, provide the official registered address.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {values.primaryBusinessCountry === 'US' ? (
                <div className="md:col-span-2">
                  <Label>Search Address</Label>
                  <AddressSearch
                    ariaLabel="Search primary business address"
                    placeholder="Search for the primary business address"
                    onSelect={handleBusinessAddressSelect}
                    className="w-full"
                  />
                  <FieldHelp>
                    Select the official business address to autofill the fields below.
                  </FieldHelp>
                  {searchedAddressLines ? (
                    <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                      <div className="font-medium text-white">{searchedAddressLines.primary}</div>
                      {searchedAddressLines.secondary ? (
                        <div className="mt-1 text-white/55">{searchedAddressLines.secondary}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="md:col-span-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                  Address search is available for U.S. businesses. For other countries, enter the registered
                  address manually below.
                </div>
              )}

              <div className="md:col-span-2">
                <Label htmlFor="primaryBusinessStreetAddress">Street Address</Label>
                <Input
                  id="primaryBusinessStreetAddress"
                  value={values.primaryBusinessStreetAddress}
                  onChange={(event) => handleChange('primaryBusinessStreetAddress', event.target.value)}
                  placeholder="123 Main Street"
                  aria-invalid={Boolean(fieldErrors.primaryBusinessStreetAddress)}
                  required
                />
                <FieldError message={fieldErrors.primaryBusinessStreetAddress} />
              </div>

              <div>
                <Label htmlFor="primaryBusinessCity">City</Label>
                <Input
                  id="primaryBusinessCity"
                  value={values.primaryBusinessCity}
                  onChange={(event) => handleChange('primaryBusinessCity', event.target.value)}
                  placeholder="Fort Wayne"
                  aria-invalid={Boolean(fieldErrors.primaryBusinessCity)}
                  required
                />
                <FieldError message={fieldErrors.primaryBusinessCity} />
              </div>

              <div>
                <Label htmlFor="primaryBusinessStateProvince">State / Province</Label>
                <Input
                  id="primaryBusinessStateProvince"
                  value={values.primaryBusinessStateProvince}
                  onChange={(event) => handleChange('primaryBusinessStateProvince', event.target.value)}
                  placeholder="Indiana"
                  aria-invalid={Boolean(fieldErrors.primaryBusinessStateProvince)}
                  required
                />
                <FieldError message={fieldErrors.primaryBusinessStateProvince} />
              </div>

              <div>
                <Label htmlFor="primaryBusinessPostalCode">Postal Code</Label>
                <Input
                  id="primaryBusinessPostalCode"
                  value={values.primaryBusinessPostalCode}
                  onChange={(event) => handleChange('primaryBusinessPostalCode', event.target.value)}
                  placeholder="46802"
                  aria-invalid={Boolean(fieldErrors.primaryBusinessPostalCode)}
                  required
                />
                <FieldError message={fieldErrors.primaryBusinessPostalCode} />
              </div>

              <div>
                <Label htmlFor="primaryBusinessCountry">Country</Label>
                <Select
                  id="primaryBusinessCountry"
                  value={values.primaryBusinessCountry}
                  onChange={(event) => handleChange('primaryBusinessCountry', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.primaryBusinessCountry)}
                  required
                >
                  <option value="">Select country</option>
                  {BUSINESS_COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <FieldError message={fieldErrors.primaryBusinessCountry} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Primary Contact Person for Membership</div>
            <div className="mt-1 text-sm text-white/60">
              This contact receives membership updates, billing notices, and OTW business-support communication.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="primaryContactFullName">Full Name</Label>
                <Input
                  id="primaryContactFullName"
                  value={values.primaryContactFullName}
                  onChange={(event) => handleChange('primaryContactFullName', event.target.value)}
                  placeholder="Jordan Smith"
                  aria-invalid={Boolean(fieldErrors.primaryContactFullName)}
                  required
                />
                <FieldError message={fieldErrors.primaryContactFullName} />
              </div>

              <div>
                <Label htmlFor="primaryContactEmail">Email Address</Label>
                <Input
                  id="primaryContactEmail"
                  type="email"
                  value={values.primaryContactEmail}
                  onChange={(event) => handleChange('primaryContactEmail', event.target.value)}
                  placeholder="membership@acme.com"
                  aria-invalid={Boolean(fieldErrors.primaryContactEmail)}
                  required
                />
                <FieldError message={fieldErrors.primaryContactEmail} />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="primaryContactPhone">Phone Number</Label>
                <PhoneInput
                  id="primaryContactPhone"
                  value={values.primaryContactPhone}
                  onChange={(event) => handleChange('primaryContactPhone', event.target.value)}
                  placeholder="(260) 555-0123"
                  aria-invalid={Boolean(fieldErrors.primaryContactPhone)}
                  required
                />
                <FieldError message={fieldErrors.primaryContactPhone} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Optional Details</div>
            <div className="mt-1 text-sm text-white/60">
              These fields help with invoicing and internal account setup, but they are not required to save the profile.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="businessWebsiteUrl">Business Website URL</Label>
                <Input
                  id="businessWebsiteUrl"
                  type="url"
                  value={values.businessWebsiteUrl}
                  onChange={(event) => handleChange('businessWebsiteUrl', event.target.value)}
                  placeholder="www.acme.com"
                  aria-invalid={Boolean(fieldErrors.businessWebsiteUrl)}
                />
                <FieldHelp>If you omit `https://`, OTW will add it for you before saving.</FieldHelp>
                <FieldError message={fieldErrors.businessWebsiteUrl} />
              </div>

              <div>
                <Label htmlFor="taxIdVatNumber">Tax Identification Number / VAT Number</Label>
                <Input
                  id="taxIdVatNumber"
                  value={values.taxIdVatNumber}
                  onChange={(event) => handleChange('taxIdVatNumber', event.target.value)}
                  placeholder="12-3456789"
                  aria-invalid={Boolean(fieldErrors.taxIdVatNumber)}
                />
                <FieldHelp>Provide the relevant tax identifier for your region if your billing process requires it.</FieldHelp>
                <FieldError message={fieldErrors.taxIdVatNumber} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <OtwButton type="submit">
              Review Details
            </OtwButton>
          </div>
        </form>
      )}
    </div>
  );
}
