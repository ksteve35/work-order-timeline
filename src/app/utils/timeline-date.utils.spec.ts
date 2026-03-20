import { startOfDay, addDays, daysBetween, formatDateString } from './timeline-date.utils'

describe('timeline-date.utils', () => {

  // ---------------------------------------------------------------------------
  // startOfDay
  // ---------------------------------------------------------------------------

  describe('startOfDay', () => {
    it('should return midnight on the same calendar day', () => {
      const input  = new Date(2026, 2, 15, 14, 30, 45)  // Mar 15 2026 14:30:45
      const result = startOfDay(input)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should return a new Date instance and not mutate the input', () => {
      const input  = new Date(2026, 2, 15, 10, 0, 0)
      const result = startOfDay(input)
      expect(result).not.toBe(input)
      expect(input.getHours()).toBe(10)
    })

    it('should handle a date already at midnight', () => {
      const input  = new Date(2026, 5, 1, 0, 0, 0)
      const result = startOfDay(input)
      expect(result.getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0).getTime())
    })
  })

  // ---------------------------------------------------------------------------
  // addDays
  // ---------------------------------------------------------------------------

  describe('addDays', () => {
    it('should add a positive number of days', () => {
      const base   = new Date(2026, 0, 1)
      const result = addDays(base, 10)
      expect(result.getDate()).toBe(11)
      expect(result.getMonth()).toBe(0)
      expect(result.getFullYear()).toBe(2026)
    })

    it('should subtract days when given a negative number', () => {
      const base   = new Date(2026, 0, 15)
      const result = addDays(base, -5)
      expect(result.getDate()).toBe(10)
    })

    it('should cross month boundaries correctly', () => {
      const base   = new Date(2026, 0, 28)  // Jan 28
      const result = addDays(base, 5)        // Feb 2
      expect(result.getMonth()).toBe(1)
      expect(result.getDate()).toBe(2)
    })

    it('should cross year boundaries correctly', () => {
      const base   = new Date(2025, 11, 30)  // Dec 30 2025
      const result = addDays(base, 5)         // Jan 4 2026
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(0)
      expect(result.getDate()).toBe(4)
    })

    it('should normalise the result to midnight regardless of input time', () => {
      const base   = new Date(2026, 3, 1, 18, 45, 0)
      const result = addDays(base, 1)
      expect(result.getHours()).toBe(0)
      expect(result.getDate()).toBe(2)
    })

    it('should return a new Date and not mutate the input', () => {
      const base   = new Date(2026, 3, 1)
      const result = addDays(base, 3)
      expect(result).not.toBe(base)
      expect(base.getDate()).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // daysBetween
  // ---------------------------------------------------------------------------

  describe('daysBetween', () => {
    it('should return 0 for the same date', () => {
      const d = new Date(2026, 3, 1)
      expect(daysBetween(d, d)).toBe(0)
    })

    it('should return a positive count when to > from', () => {
      const from = new Date(2026, 0, 1)
      const to   = new Date(2026, 0, 11)
      expect(daysBetween(from, to)).toBe(10)
    })

    it('should return a negative count when to < from', () => {
      const from = new Date(2026, 0, 11)
      const to   = new Date(2026, 0, 1)
      expect(daysBetween(from, to)).toBe(-10)
    })

    it('should count correctly across month boundaries', () => {
      const from = new Date(2026, 0, 28)  // Jan 28
      const to   = new Date(2026, 1, 4)   // Feb 4
      expect(daysBetween(from, to)).toBe(7)
    })

    it('should count correctly across year boundaries', () => {
      const from = new Date(2025, 11, 31)
      const to   = new Date(2026, 0, 1)
      expect(daysBetween(from, to)).toBe(1)
    })

    it('should be immune to DST by using UTC internally', () => {
      // March 8 2026 is a DST changeover Sunday in the US — clocks spring forward.
      // A naive (local-time) subtraction could yield 23 hours = 0 days.
      const from = new Date(2026, 2, 7)
      const to   = new Date(2026, 2, 8)
      expect(daysBetween(from, to)).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // formatDateString
  // ---------------------------------------------------------------------------

  describe('formatDateString', () => {
    it('should format a date as YYYY-MM-DD', () => {
      const d = new Date(2026, 2, 20)  // Mar 20 2026
      expect(formatDateString(d)).toBe('2026-03-20')
    })

    it('should zero-pad single-digit month and day', () => {
      const d = new Date(2026, 0, 5)  // Jan 5 2026
      expect(formatDateString(d)).toBe('2026-01-05')
    })

    it('should handle end-of-year dates', () => {
      const d = new Date(2025, 11, 31)
      expect(formatDateString(d)).toBe('2025-12-31')
    })

    it('should not be affected by the time component', () => {
      const d = new Date(2026, 5, 15, 23, 59, 59)
      expect(formatDateString(d)).toBe('2026-06-15')
    })
  })
})