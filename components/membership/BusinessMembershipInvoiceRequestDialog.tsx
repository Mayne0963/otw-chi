'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle2, PencilLine, Save } from 'lucide-react';
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
  businessMembershipInvoiceRequestSchema,
  formatBusinessCountryLabel,
  formatBusinessIndustryLabel,
  getBusinessAddressFieldsFromGeocodedAddress,
  getBusinessMembershipProfileFieldErrors,
} from '@/lib/business-membership-profile';
import { formatAddressLines, type GeocodedAddress } from '@/lib/geocoding';
import { trackOtwEvent } from '@/lib/analytics/otwTrack';

type InvoiceRequestPlan = {
  id?: string | null;
  name: string;
  price: string;
};

type RequesterDefaults = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type InvoiceRequestDraft = {
  planId: string;
  planName: string;
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

const BUSINESS_ADDRESS_FIELD_NAMES = new Set<keyof InvoiceRequestDraft>([
  'primaryBusinessStreetAddress',
  'primaryBusinessCity',
  'primaryBusinessStateProvince',
  'primaryBusinessPostalCode',
  'primaryBusinessCountry',
]);

type InvoiceRequestResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  invoiceRequest?: {
    id: string;
    planName: string;
    validatedAddress: string | null;
  };
};

function buildInitialDraft(plan: InvoiceRequestPlan, requesterDefaults?: RequesterDefaults): InvoiceRequestDraft {
  return {
    planId: plan.id ?? '',
    planName: plan.name,
    businessLegalName: '',
    employeeCount: '',
    primaryBusinessStreetAddress: '',
    primaryBusinessCity: '',
    primaryBusinessStateProvince: '',
    primaryBusinessPostalCode: '',
    primaryBusinessCountry: 'US',
    industryType: '',
    primaryContactFullName: requesterDefaults?.fullName ?? '',
    primaryContactEmail: requesterDefaults?.email ?? '',
    primaryContactPhone: requesterDefaults?.phone ?? '',
    businessWebsiteUrl: '',
    taxIdVatNumber: '',
  };
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-muted-foreground dark:text-white/55">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">{message}</p>;
}

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-3 dark:border-white/10 dark:bg-black/25">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-white/45">
        {label}
      </div>
      <div className="mt-2 text-sm text-foreground dark:text-white/90">{value}</div>
    </div>
  );
}

function buildSummaryWebsiteLabel(url: string | null) {
  if (!url) return 'Not provided';
  return url.replace(/^https?:\/\//i, '');
}

const formLabelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground dark:text-white/88';

const formControlClassName =
  'border-border/70 bg-input text-foreground placeholder:text-muted-foreground shadow-none hover:border-secondary/60 focus-visible:ring-ring/80 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-white/35 dark:hover:border-white/20 dark:focus-visible:border-otwGold/60 dark:focus-visible:ring-otwGold/70 dark:focus-visible:ring-offset-[#0c0f14]';

const sectionSurfaceClassName =
  'rounded-2xl border border-border/70 bg-muted/40 p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.055))]';

export default function BusinessMembershipInvoiceRequestDialog({
  plan,
  requesterDefaults,
}: {
  plan: InvoiceRequestPlan;
  requesterDefaults?: RequesterDefaults;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<InvoiceRequestDraft>(() => buildInitialDraft(plan, requesterDefaults));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validatedAddress, setValidatedAddress] = useState<string | null>(null);
  const [searchedAddress, setSearchedAddress] = useState<GeocodedAddress | null>(null);

  const resetDialog = () => {
    setValues(buildInitialDraft(plan, requesterDefaults));
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
    setIsReviewing(false);
    setIsSubmitting(false);
    setValidatedAddress(null);
    setSearchedAddress(null);
  };

  const reviewValues = useMemo(() => {
    const parsed = businessMembershipInvoiceRequestSchema.safeParse(values);
    return parsed.success ? parsed.data : null;
  }, [values]);

  const handleChange = (name: keyof InvoiceRequestDraft, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    if (BUSINESS_ADDRESS_FIELD_NAMES.has(name)) {
      setSearchedAddress(null);
      setValidatedAddress(null);
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
    setValidatedAddress(null);
    setFormError(null);
    setSuccessMessage(null);
  };

  const searchedAddressLines = searchedAddress ? formatAddressLines(searchedAddress) : null;

  const handleReview = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = businessMembershipInvoiceRequestSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getBusinessMembershipProfileFieldErrors(parsed.error));
      setFormError('Please correct the highlighted fields before reviewing your invoice request.');
      setIsReviewing(false);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsReviewing(true);
  };

  const handleSubmit = async () => {
    const parsed = businessMembershipInvoiceRequestSchema.safeParse(values);
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
      const response = await fetch('/api/membership/business-invoice-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...values,
          selectedBusinessAddress: searchedAddress ?? undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as InvoiceRequestResponse | null;

      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors ?? {});
        setFormError(payload?.error ?? 'Unable to submit your business invoice request right now.');
        setIsReviewing(false);
        return;
      }

      setFieldErrors({});
      setFormError(null);
      setSuccessMessage(payload?.message ?? `Invoice request received for ${plan.name}.`);
      setValidatedAddress(payload?.invoiceRequest?.validatedAddress ?? null);
      setIsReviewing(false);

      void trackOtwEvent('CONTACT_SUBMITTED', {
        page: window.location.pathname,
        metadata: {
          kind: 'business_invoice_request',
          planName: plan.name,
        },
      });

      // Capture a lightweight lead record for go-to-market follow-up (avoid addresses/tax IDs).
      void fetch('/api/otw/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: parsed.data.primaryContactFullName,
          email: parsed.data.primaryContactEmail,
          phone: parsed.data.primaryContactPhone,
          interestType: 'BUSINESS_ACCOUNT',
          sourcePage: window.location.pathname,
          message: `Business membership invoice request: ${plan.name}`,
          metadata: {
            planName: plan.name,
            employeeCount: parsed.data.employeeCount,
            industryType: parsed.data.industryType,
          },
        }),
      }).catch(() => null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Unable to submit your business invoice request right now.',
      );
      setIsReviewing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetDialog();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          onClick={() => {
            void trackOtwEvent('MEMBERSHIP_SELECTED', {
              page: window.location.pathname,
              metadata: { kind: 'business_invoice_dialog_open', planName: plan.name },
            });
          }}
          className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-md bg-otwGold px-4 text-sm font-medium text-otwBlack hover:bg-otwGold/90"
        >
          Request Invoice
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:pointer-events-none" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 text-foreground shadow-otwElevated backdrop-blur-xl focus:outline-none dark:border-white/15 dark:bg-[#0c0f14]/95 dark:text-white">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4 dark:border-white/10">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground dark:text-white">
                Request Invoice for {plan.name}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground dark:text-white/60">
                Enter your business information now so OTW can review the account and prepare invoice-based membership onboarding for {plan.price}.
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border/70 px-2 py-1 text-xs font-medium text-muted-foreground transition hover:border-secondary/60 hover:text-foreground dark:border-white/20 dark:text-white/85 dark:hover:border-white/40 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.055))]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-white/45">
                  Selected Membership
                </div>
                <div className="mt-2 text-base font-medium text-foreground dark:text-white">{plan.name}</div>
                <div className="mt-1 text-sm text-muted-foreground dark:text-white/60">{plan.price}</div>
              </div>

              {successMessage ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{successMessage}</span>
                  </div>
                  {validatedAddress ? (
                    <div className="mt-2 text-xs text-emerald-700/80 dark:text-emerald-100/80">
                      Verified address: {validatedAddress}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
                  {formError}
                </div>
              ) : null}

              {isReviewing && reviewValues ? (
                <div className="space-y-4">
                  <div className={sectionSurfaceClassName}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground dark:text-white">Review invoice request</div>
                        <div className="mt-1 text-sm text-muted-foreground dark:text-white/60">
                          Confirm the business details below before sending this invoice request to OTW.
                        </div>
                      </div>
                      <OtwButton variant="ghost" size="sm" onClick={() => setIsReviewing(false)}>
                        <PencilLine className="h-4 w-4" />
                        Edit details
                      </OtwButton>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <ReviewItem label="Requested Plan" value={plan.name} />
                      <ReviewItem label="Business Legal Name" value={reviewValues.businessLegalName} />
                      <ReviewItem label="Number of Employees" value={reviewValues.employeeCount.toLocaleString()} />
                      <ReviewItem label="Industry Type" value={formatBusinessIndustryLabel(reviewValues.industryType)} />
                      <ReviewItem label="Country" value={formatBusinessCountryLabel(reviewValues.primaryBusinessCountry)} />
                      <ReviewItem label="Primary Business Location" value={buildBusinessAddressSummary(reviewValues)} />
                      <ReviewItem label="Primary Contact" value={`${reviewValues.primaryContactFullName} · ${reviewValues.primaryContactEmail}`} />
                      <ReviewItem label="Primary Contact Phone" value={reviewValues.primaryContactPhone} />
                      <ReviewItem label="Business Website" value={buildSummaryWebsiteLabel(reviewValues.businessWebsiteUrl)} />
                      <ReviewItem label="Tax ID / VAT Number" value={reviewValues.taxIdVatNumber || 'Not provided'} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <OtwButton variant="outline" onClick={() => setIsReviewing(false)}>
                      Edit
                    </OtwButton>
                    <OtwButton onClick={handleSubmit} disabled={isSubmitting}>
                      <Save className="h-4 w-4" />
                      {isSubmitting ? 'Submitting...' : 'Submit Invoice Request'}
                    </OtwButton>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReview} className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label className={formLabelClassName} htmlFor={`businessLegalName-${plan.name}`}>
                        Business Legal Name
                      </Label>
                      <Input
                        id={`businessLegalName-${plan.name}`}
                        className={formControlClassName}
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
                      <Label className={formLabelClassName} htmlFor={`employeeCount-${plan.name}`}>
                        Number of Employees
                      </Label>
                      <Input
                        id={`employeeCount-${plan.name}`}
                        className={formControlClassName}
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
                      <FieldHelp>Enter the approximate total employee count covered by this membership request.</FieldHelp>
                      <FieldError message={fieldErrors.employeeCount} />
                    </div>

                    <div>
                      <Label className={formLabelClassName} htmlFor={`industryType-${plan.name}`}>
                        Industry Type
                      </Label>
                      <Select
                        id={`industryType-${plan.name}`}
                        className={formControlClassName}
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
                      <FieldHelp>Select the closest match so OTW can route the invoice review correctly.</FieldHelp>
                      <FieldError message={fieldErrors.industryType} />
                    </div>
                  </div>

                  <div className={sectionSurfaceClassName}>
                    <div className="text-sm font-semibold text-foreground dark:text-white">Primary Business Location</div>
                    <div className="mt-1 text-sm text-muted-foreground dark:text-white/60">
                      U.S. addresses are automatically verified before the invoice request is accepted.
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {values.primaryBusinessCountry === 'US' ? (
                        <div className="md:col-span-2">
                          <Label className={formLabelClassName}>Search Address</Label>
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
                            <div className="mt-2 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-foreground/80 dark:border-white/10 dark:bg-black/25 dark:text-white/80">
                              <div className="font-medium text-foreground dark:text-white">
                                {searchedAddressLines.primary}
                              </div>
                              {searchedAddressLines.secondary ? (
                                <div className="mt-1 text-muted-foreground dark:text-white/55">
                                  {searchedAddressLines.secondary}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="md:col-span-2 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-black/25 dark:text-white/65">
                          Address search is available for U.S. businesses. For other countries, enter the
                          registered address manually below.
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <Label className={formLabelClassName} htmlFor={`primaryBusinessStreetAddress-${plan.name}`}>
                          Street Address
                        </Label>
                        <Input
                          id={`primaryBusinessStreetAddress-${plan.name}`}
                          className={formControlClassName}
                          value={values.primaryBusinessStreetAddress}
                          onChange={(event) => handleChange('primaryBusinessStreetAddress', event.target.value)}
                          placeholder="123 Main Street"
                          aria-invalid={Boolean(fieldErrors.primaryBusinessStreetAddress)}
                          required
                        />
                        <FieldError message={fieldErrors.primaryBusinessStreetAddress} />
                      </div>

                      <div>
                        <Label className={formLabelClassName} htmlFor={`primaryBusinessCity-${plan.name}`}>
                          City
                        </Label>
                        <Input
                          id={`primaryBusinessCity-${plan.name}`}
                          className={formControlClassName}
                          value={values.primaryBusinessCity}
                          onChange={(event) => handleChange('primaryBusinessCity', event.target.value)}
                          placeholder="Fort Wayne"
                          aria-invalid={Boolean(fieldErrors.primaryBusinessCity)}
                          required
                        />
                        <FieldError message={fieldErrors.primaryBusinessCity} />
                      </div>

                      <div>
                        <Label className={formLabelClassName} htmlFor={`primaryBusinessStateProvince-${plan.name}`}>
                          State / Province
                        </Label>
                        <Input
                          id={`primaryBusinessStateProvince-${plan.name}`}
                          className={formControlClassName}
                          value={values.primaryBusinessStateProvince}
                          onChange={(event) => handleChange('primaryBusinessStateProvince', event.target.value)}
                          placeholder="Indiana"
                          aria-invalid={Boolean(fieldErrors.primaryBusinessStateProvince)}
                          required
                        />
                        <FieldError message={fieldErrors.primaryBusinessStateProvince} />
                      </div>

                      <div>
                        <Label className={formLabelClassName} htmlFor={`primaryBusinessPostalCode-${plan.name}`}>
                          Postal Code
                        </Label>
                        <Input
                          id={`primaryBusinessPostalCode-${plan.name}`}
                          className={formControlClassName}
                          value={values.primaryBusinessPostalCode}
                          onChange={(event) => handleChange('primaryBusinessPostalCode', event.target.value)}
                          placeholder="46802"
                          aria-invalid={Boolean(fieldErrors.primaryBusinessPostalCode)}
                          required
                        />
                        <FieldError message={fieldErrors.primaryBusinessPostalCode} />
                      </div>

                      <div>
                        <Label className={formLabelClassName} htmlFor={`primaryBusinessCountry-${plan.name}`}>
                          Country
                        </Label>
                        <Select
                          id={`primaryBusinessCountry-${plan.name}`}
                          className={formControlClassName}
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

                  <div className={sectionSurfaceClassName}>
                    <div className="text-sm font-semibold text-foreground dark:text-white">Primary Contact Person for Membership</div>
                    <div className="mt-1 text-sm text-muted-foreground dark:text-white/60">
                      This contact will receive invoice setup and business-membership follow-up from OTW.
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className={formLabelClassName} htmlFor={`primaryContactFullName-${plan.name}`}>
                          Full Name
                        </Label>
                        <Input
                          id={`primaryContactFullName-${plan.name}`}
                          className={formControlClassName}
                          value={values.primaryContactFullName}
                          onChange={(event) => handleChange('primaryContactFullName', event.target.value)}
                          placeholder="Jordan Smith"
                          aria-invalid={Boolean(fieldErrors.primaryContactFullName)}
                          required
                        />
                        <FieldError message={fieldErrors.primaryContactFullName} />
                      </div>

                      <div>
                        <Label className={formLabelClassName} htmlFor={`primaryContactEmail-${plan.name}`}>
                          Email Address
                        </Label>
                        <Input
                          id={`primaryContactEmail-${plan.name}`}
                          className={formControlClassName}
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
                        <Label className={formLabelClassName} htmlFor={`primaryContactPhone-${plan.name}`}>
                          Phone Number
                        </Label>
                        <PhoneInput
                          id={`primaryContactPhone-${plan.name}`}
                          className={formControlClassName}
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

                  <div className={sectionSurfaceClassName}>
                    <div className="text-sm font-semibold text-foreground dark:text-white">Optional Details</div>
                    <div className="mt-1 text-sm text-muted-foreground dark:text-white/60">
                      These fields help OTW prepare invoice setup and regional billing requirements.
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className={formLabelClassName} htmlFor={`businessWebsiteUrl-${plan.name}`}>
                          Business Website URL
                        </Label>
                        <Input
                          id={`businessWebsiteUrl-${plan.name}`}
                          className={formControlClassName}
                          type="url"
                          value={values.businessWebsiteUrl}
                          onChange={(event) => handleChange('businessWebsiteUrl', event.target.value)}
                          placeholder="www.acme.com"
                          aria-invalid={Boolean(fieldErrors.businessWebsiteUrl)}
                        />
                        <FieldHelp>If you omit `https://`, OTW will add it before saving.</FieldHelp>
                        <FieldError message={fieldErrors.businessWebsiteUrl} />
                      </div>

                      <div>
                        <Label className={formLabelClassName} htmlFor={`taxIdVatNumber-${plan.name}`}>
                          Tax Identification Number / VAT Number
                        </Label>
                        <Input
                          id={`taxIdVatNumber-${plan.name}`}
                          className={formControlClassName}
                          value={values.taxIdVatNumber}
                          onChange={(event) => handleChange('taxIdVatNumber', event.target.value)}
                          placeholder="12-3456789"
                          aria-invalid={Boolean(fieldErrors.taxIdVatNumber)}
                        />
                        <FieldHelp>Provide the relevant tax identifier for your region if invoice processing requires it.</FieldHelp>
                        <FieldError message={fieldErrors.taxIdVatNumber} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <OtwButton type="submit">Review Invoice Request</OtwButton>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
