import {
  STATUS_BG_COLORS,
  STATUS_BORDER_COLORS,
  STATUS_TEXT_COLORS,
  STATUS_BADGE_COLORS,
  STATUS_LABELS,
} from './work-order-status.constants'
import { WorkOrderStatus } from '../models/documents.model'

const ALL_STATUSES: WorkOrderStatus[] = ['open', 'in-progress', 'complete', 'blocked']

describe('work-order-status.constants', () => {

  it('should define a background color for every status', () => {
    ALL_STATUSES.forEach(status => {
      expect(STATUS_BG_COLORS[status])
        .withContext(`Missing bg color for '${status}'`)
        .toBeTruthy()
    })
  })

  it('should define a border color for every status', () => {
    ALL_STATUSES.forEach(status => {
      expect(STATUS_BORDER_COLORS[status])
        .withContext(`Missing border color for '${status}'`)
        .toBeTruthy()
    })
  })

  it('should define a text color for every status', () => {
    ALL_STATUSES.forEach(status => {
      expect(STATUS_TEXT_COLORS[status])
        .withContext(`Missing text color for '${status}'`)
        .toBeTruthy()
    })
  })

  it('should define a badge color for every status', () => {
    ALL_STATUSES.forEach(status => {
      expect(STATUS_BADGE_COLORS[status])
        .withContext(`Missing badge color for '${status}'`)
        .toBeTruthy()
    })
  })

  it('should define a display label for every status', () => {
    ALL_STATUSES.forEach(status => {
      expect(STATUS_LABELS[status])
        .withContext(`Missing label for '${status}'`)
        .toBeTruthy()
    })
  })

  it('should use human-readable labels', () => {
    expect(STATUS_LABELS['open']).toBe('Open')
    expect(STATUS_LABELS['in-progress']).toBe('In progress')
    expect(STATUS_LABELS['complete']).toBe('Complete')
    expect(STATUS_LABELS['blocked']).toBe('Blocked')
  })

  it('should use distinct colors across statuses for each map', () => {
    const bgValues = ALL_STATUSES.map(s => STATUS_BG_COLORS[s])
    expect(new Set(bgValues).size).toBe(ALL_STATUSES.length)

    const badgeValues = ALL_STATUSES.map(s => STATUS_BADGE_COLORS[s])
    expect(new Set(badgeValues).size).toBe(ALL_STATUSES.length)
  })
})