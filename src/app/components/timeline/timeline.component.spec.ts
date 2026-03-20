import { TestBed, fakeAsync, tick } from '@angular/core/testing'
import { TimelineComponent } from './timeline.component'
import { SimpleChanges } from '@angular/core'
import { WorkCenterDocument, WorkOrderDocument } from '../../models/documents.model'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeOrder = (
  docId:     string,
  wcId:      string,
  startDate: string,
  endDate:   string,
  name      = 'Test Order',
  status    = 'open'
): WorkOrderDocument => ({
  docId,
  docType: 'workOrder',
  data: { name, workCenterId: wcId, status: status as any, startDate, endDate },
})

const makeWc = (docId: string, name: string): WorkCenterDocument => ({
  docId,
  docType: 'workCenter',
  data: { name },
})

const makeChange = (currentValue: any, previousValue: any): SimpleChanges => ({
  selectedTimescale: {
    currentValue,
    previousValue,
    firstChange:   false,
    isFirstChange: () => false,
  },
})

// ---------------------------------------------------------------------------
// Fast component factory (no Angular)
// ---------------------------------------------------------------------------

const createComponent = () => {
  const mockChangeDetector = {
    detectChanges: () => {}
  } as any

  const mockNgZone = {
    runOutsideAngular: (fn: Function) => fn()
  } as any

  return new TimelineComponent(mockChangeDetector, mockNgZone)
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TimelineComponent', () => {

  // -------------------------------------------------------------------------
  // Timescale transitions (needs fakeAsync)
  // -------------------------------------------------------------------------

  describe('timescale transitions', () => {
    it('should update _activeTimescale after the 80ms fade', fakeAsync(() => {
      const comp = createComponent()
      comp.ngOnInit()

      // Mock rightColumn for scroll calculations (not used directly in this test,
      // but required for ngOnChanges to run without errors)
      comp.rightColumn = {
        nativeElement: {
          scrollLeft: 0,
          clientWidth: 1000,
        }
      } as any
      
      const transitions = [
        ['Day',   'Month'],
        ['Hour',  'Day'  ],
        ['Week',  'Hour' ],
        ['Month', 'Week' ],
      ] as const

      for (const [next, prev] of transitions) {
        comp.selectedTimescale = next
        comp.ngOnChanges(makeChange(next, prev))
        tick(80)
        expect(comp._activeTimescale).toBe(next)
      }
    }))

    it('should not transition if timescale unchanged', fakeAsync(() => {
      const comp = createComponent()
      comp.ngOnInit()

      comp.selectedTimescale = 'Month'
      comp.ngOnChanges(makeChange('Month', 'Month'))
      tick(80)

      expect(comp._activeTimescale).toBe('Month')
    }))
  })

  // -------------------------------------------------------------------------
  // initializeRange (force lighter timescale)
  // -------------------------------------------------------------------------

  describe('initializeRange', () => {
    it('should set visibleStart before anchor', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Day'

      const anchor = new Date(2026, 2, 20)
      comp.initializeRange(anchor)

      expect(comp.visibleStart < anchor).toBeTrue()
    })

    it('should set visibleEnd after anchor', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Day'

      const anchor = new Date(2026, 2, 20)
      comp.initializeRange(anchor)

      expect(comp.visibleEnd > anchor).toBeTrue()
    })

    it('should populate timelineColumns', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Day'

      comp.initializeRange(new Date(2026, 2, 20))
      expect(comp.timelineColumns.length).toBeGreaterThan(0)
    })

    it('should set totalColumns correctly', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Day'

      comp.initializeRange(new Date(2026, 2, 20))
      expect(comp.totalColumns).toBe(comp.timelineColumns.length)
    })
  })

  // -------------------------------------------------------------------------
  // getColumnIndex
  // -------------------------------------------------------------------------

  describe('getColumnIndex', () => {
    it('should return 0 for visibleStart', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Month'
      comp.initializeRange(new Date(2026, 2, 1))

      const startStr = `${comp.visibleStart.getFullYear()}-${String(comp.visibleStart.getMonth() + 1).padStart(2, '0')}-01`
      expect(comp.getColumnIndex(startStr)).toBe(0)
    })

    it('should return 1 for next month', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Month'
      comp.initializeRange(new Date(2026, 2, 1))

      const next = new Date(comp.visibleStart.getFullYear(), comp.visibleStart.getMonth() + 1, 1)
      const str  = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`

      expect(comp.getColumnIndex(str)).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // getBarStyleObject
  // -------------------------------------------------------------------------

  describe('getBarStyleObject', () => {
    it('should return valid style object', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Day'
      comp.initializeRange(new Date(2026, 2, 1))

      const style = comp.getBarStyleObject(
        makeOrder('wo1', 'wc1', '2026-04-01', '2026-05-01')
      )

      expect(style['left']).toMatch(/px$/)
      expect(style['width']).toMatch(/px$/)
    })

    it('should scale width with duration', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Day'
      comp.initializeRange(new Date(2026, 2, 1))

      const short = comp.getBarStyleObject(makeOrder('wo1', 'wc1', '2026-04-01', '2026-05-01'))
      const long  = comp.getBarStyleObject(makeOrder('wo2', 'wc1', '2026-04-01', '2026-07-01'))

      expect(parseInt(long['width'], 10))
        .toBeGreaterThan(parseInt(short['width'], 10))
    })
  })

  // -------------------------------------------------------------------------
  // getOrdersForWorkCenter
  // -------------------------------------------------------------------------

  describe('getOrdersForWorkCenter', () => {
    it('filters correctly', () => {
      const comp = createComponent()

      comp.workOrders = [
        makeOrder('wo1', 'wc1', '2026-04-01', '2026-04-30'),
        makeOrder('wo2', 'wc2', '2026-04-01', '2026-04-30'),
        makeOrder('wo3', 'wc1', '2026-05-01', '2026-05-30'),
      ]

      const result = comp.getOrdersForWorkCenter('wc1')

      expect(result.length).toBe(2)
      expect(result.every(o => o.data.workCenterId === 'wc1')).toBeTrue()
    })

    it('returns empty when none exist', () => {
      const comp = createComponent()
      comp.workOrders = [makeOrder('wo1', 'wc1', '2026-04-01', '2026-04-30')]

      expect(comp.getOrdersForWorkCenter('wc-none')).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // Panel logic (no Angular needed)
  // -------------------------------------------------------------------------

  describe('panel logic', () => {
    it('openCreatePanel sets correct defaults', () => {
      const comp = createComponent()
      comp._activeTimescale = 'Day'
      comp.initializeRange(new Date(2026, 2, 1))

      comp.openCreatePanel('wc1', 0)

      expect(comp.panelMode).toBe('create')
      expect(comp.panelInitialData?.workCenterId).toBe('wc1')
    })

    it('openEditPanel populates data', () => {
      const comp = createComponent()

      const order = makeOrder('wo1', 'wc1', '2026-04-01', '2026-04-30', 'My Order', 'blocked')
      comp.openEditPanel(order)

      expect(comp.panelMode).toBe('edit')
      expect(comp.panelInitialData?.name).toBe('My Order')
    })
  })

  // -------------------------------------------------------------------------
  // onPanelSave
  // -------------------------------------------------------------------------

  describe('onPanelSave', () => {
    it('creates new order', () => {
      const comp = createComponent()

      comp.workOrders = []
      comp.panelMode = 'create'

      comp.onPanelSave({
        workCenterId: 'wc1',
        name: 'New',
        status: 'open',
        startDate: '2026-04-01',
        endDate: '2026-04-30'
      })

      expect(comp.workOrders.length).toBe(1)
    })

    it('generates unique IDs', () => {
      const comp = createComponent()

      comp.workOrders = []
      comp.panelMode = 'create'
      comp.onPanelSave({ workCenterId: 'wc1', name: 'A', status: 'open', startDate: '2026-04-01', endDate: '2026-04-30' })

      comp.panelMode = 'create'
      comp.onPanelSave({ workCenterId: 'wc1', name: 'B', status: 'open', startDate: '2026-05-01', endDate: '2026-05-30' })

      const ids = comp.workOrders.map(o => o.docId)
      expect(new Set(ids).size).toBe(2)
    })

    it('edits existing order', () => {
      const comp = createComponent()

      comp.workOrders = [makeOrder('wo1', 'wc1', '2026-04-01', '2026-04-30')]
      comp.panelMode = 'edit'

      comp.onPanelSave({
        docId: 'wo1',
        workCenterId: 'wc1',
        name: 'Updated',
        status: 'complete',
        startDate: '2026-04-01',
        endDate: '2026-04-30'
      })

      expect(comp.workOrders[0].data.name).toBe('Updated')
    })
  })

  // -------------------------------------------------------------------------
  // onDeleteOrder
  // -------------------------------------------------------------------------

  describe('onDeleteOrder', () => {
    it('removes order', () => {
      const comp = createComponent()

      comp.workOrders = [
        makeOrder('wo1', 'wc1', '2026-04-01', '2026-04-30'),
        makeOrder('wo2', 'wc1', '2026-05-01', '2026-05-30'),
      ]

      comp.onDeleteOrder('wo1', new MouseEvent('click'))

      expect(comp.workOrders.length).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // label helpers
  // -------------------------------------------------------------------------

  describe('label helpers', () => {
    it('formats hour labels correctly', () => {
      const comp = createComponent()

      expect(comp.getHourLabel(new Date(2026, 0, 1, 0))).toBe('12 AM')
      expect(comp.getHourLabel(new Date(2026, 0, 1, 12))).toBe('12 PM')
      expect(comp.getHourLabel(new Date(2026, 0, 1, 15))).toBe('3 PM')
    })

    it('formats day/month labels', () => {
      const comp = createComponent()

      expect(comp.getDayLabel(new Date(2026, 2, 20))).toContain('20')
      expect(comp.getMonthLabel(new Date(2026, 2, 1))).toContain('2026')
    })
  })

})