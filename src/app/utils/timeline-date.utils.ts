/**
 * Pure date utility functions used by the timeline and any other code that
 * needs to reason about calendar dates. All functions are stateless and have
 * no Angular dependencies, making them straightforward to unit-test in
 * isolation.
 */

/** Returns a new Date set to midnight on the same calendar day as `date`. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Returns a new Date that is `numberOfDays` calendar days from `date`,
 *  normalised to midnight. Pass a negative value to go backwards. */
export function addDays(date: Date, numberOfDays: number): Date {
  const result = startOfDay(date)
  result.setDate(result.getDate() + numberOfDays)
  return result
}

/** Returns the whole number of calendar days between two dates. Uses UTC
 *  timestamps to avoid DST-related off-by-one errors around clock changes. */
export function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUtc   = Date.UTC(to.getFullYear(),   to.getMonth(),   to.getDate())
  return Math.floor((toUtc - fromUtc) / 86_400_000)
}

/** Formats a Date as a YYYY-MM-DD string, matching the storage format used
 *  in `WorkOrderDocument.data.startDate` and `.endDate`. */
export function formatDateString(date: Date): string {
  const year  = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day   = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}