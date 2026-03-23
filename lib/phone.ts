const LOCAL_PHONE_DIGIT_LIMIT = 10;
const COUNTRY_CODE_PHONE_DIGIT_LIMIT = 11;

function sanitizePhoneDigits(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, COUNTRY_CODE_PHONE_DIGIT_LIMIT);
}

function formatLocalPhoneNumber(digits: string) {
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function countPhoneDigits(value: string | null | undefined) {
  return sanitizePhoneDigits(value).length;
}

export function formatPhoneNumber(value: string | null | undefined) {
  const digits = sanitizePhoneDigits(value);

  if (!digits) return '';

  if (digits.length > LOCAL_PHONE_DIGIT_LIMIT && digits.startsWith('1')) {
    const localNumber = digits.slice(1, COUNTRY_CODE_PHONE_DIGIT_LIMIT);
    const formattedLocalNumber = formatLocalPhoneNumber(localNumber);
    return formattedLocalNumber ? `1 ${formattedLocalNumber}` : '1';
  }

  return formatLocalPhoneNumber(digits.slice(0, LOCAL_PHONE_DIGIT_LIMIT));
}

export function normalizeOptionalPhone(value: FormDataEntryValue | string | null | undefined) {
  const stringValue = typeof value === 'string' ? value : '';
  const formatted = formatPhoneNumber(stringValue.trim());
  return formatted || null;
}
