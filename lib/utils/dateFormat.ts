/**
 * Graph returns event.start.timeZone as "UTC" when no Prefer header is set.
 * "UTC" is truthy so it bypasses all || fallbacks. This normalises it (and
 * Windows timezone names) to a valid IANA name for Intl.DateTimeFormat.
 */
export function resolveDisplayTz(tz: string | undefined): string {
  if (!tz || tz === 'UTC') return 'America/New_York'
  const WIN_TO_IANA: Record<string, string> = {
    'Eastern Standard Time': 'America/New_York',
    'Eastern Daylight Time': 'America/New_York',
    'Central Standard Time': 'America/Chicago',
    'Central Daylight Time': 'America/Chicago',
    'Mountain Standard Time': 'America/Denver',
    'Mountain Daylight Time': 'America/Denver',
    'Pacific Standard Time': 'America/Los_Angeles',
    'Pacific Daylight Time': 'America/Los_Angeles',
  }
  return WIN_TO_IANA[tz] ?? tz
}

export function formatEastern(
  dateString: string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = 'America/New_York',
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    ...options,
  }).format(new Date(dateString))
}

/** Format just the time portion of a calendar event in Eastern time. */
export function formatEventTime(
  isoString: string,
  timezone: string = 'America/New_York',
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString))
}

/** Format just the date portion of a calendar event in Eastern time. */
export function formatEventDate(
  isoString: string,
  timezone: string = 'America/New_York',
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoString))
}

export function formatEasternTime(dateString: string): string {
  return formatEastern(dateString, { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatEasternDate(dateString: string): string {
  return formatEastern(dateString, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Returns YYYY-MM-DD in the given timezone (default America/New_York). */
export function getDateInTimezone(iso: string, tz: string = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${d}`
}

/** Returns 0-23 hour in the given timezone (default America/New_York). */
export function getHourInTimezone(date: Date = new Date(), tz: string = 'America/New_York'): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).format(date)
  return parseInt(h, 10)
}
