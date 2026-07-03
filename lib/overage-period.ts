const DEFAULT_TIMEZONE = 'America/Chicago';

function getYearMonthParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '0');

  if (!Number.isFinite(year) || !Number.isFinite(month) || year <= 0 || month <= 0) {
    throw new Error('Failed to compute billing period key');
  }

  return { year, month };
}

export function getPeriodKey(date: Date, timezone = DEFAULT_TIMEZONE): string {
  const { year, month } = getYearMonthParts(date, timezone);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getPreviousPeriodKey(date: Date, timezone = DEFAULT_TIMEZONE): string {
  const { year, month } = getYearMonthParts(date, timezone);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}
