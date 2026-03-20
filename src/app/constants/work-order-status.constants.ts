/**
 * Display constants for WorkOrderStatus values. Centralised here so both the
 * timeline bar rendering and the work-order-panel form can import from a
 * single source of truth rather than duplicating these maps.
 */
import { WorkOrderStatus } from '../models/documents.model'

export const STATUS_BG_COLORS: Record<WorkOrderStatus, string> = {
  'open':        '#F2FEFF',
  'in-progress': '#EDEEFF',
  'complete':    '#F8FFF3',
  'blocked':     '#FFFCF1',
}

export const STATUS_BORDER_COLORS: Record<WorkOrderStatus, string> = {
  'open':        '#CEFBFF',
  'in-progress': '#DEE0FF',
  'complete':    '#D1FAB3',
  'blocked':     '#FFF5CF',
}

export const STATUS_TEXT_COLORS: Record<WorkOrderStatus, string> = {
  'open':        'rgba(0,176,191,1)',
  'in-progress': 'rgba(62,64,219,1)',
  'complete':    'rgba(8,162,104,1)',
  'blocked':     'rgba(177,54,0,1)',
}

export const STATUS_BADGE_COLORS: Record<WorkOrderStatus, string> = {
  'open':        '#E4FDFF',
  'in-progress': '#D6D8FF',
  'complete':    '#E1FFCC',
  'blocked':     '#FCEEB5',
}

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  'open':        'Open',
  'in-progress': 'In progress',
  'complete':    'Complete',
  'blocked':     'Blocked',
}