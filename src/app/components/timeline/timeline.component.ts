import {
  AfterViewInit, ChangeDetectorRef, Component, EventEmitter,
  ElementRef, Input, NgZone, OnChanges, OnInit,
  Output, SimpleChanges, ViewChild
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { WorkCenterDocument, WorkOrderDocument } from '../../models/documents.model'
import { WorkOrderPanelComponent, PanelWorkOrder } from '../work-order-panel/work-order-panel.component'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

interface WeekGroup  { label: string; days:  Date[] }
interface MonthGroup { label: string; days:  Date[] }
interface DayGroup   { label: string; hours: Date[] }
interface WindowConfig { initialDays: number; loadDays: number; bufferDays: number }

const WINDOW_CONFIG: Record<Timescale, WindowConfig> = {
  // initialDays: columns loaded on first render
  // loadDays:    columns added per extend trigger — larger = fewer triggers, more memory
  // bufferDays:  how close to the edge before triggering an extend — larger = earlier trigger
  //
  // NOTE: daysToPixels() converts bufferDays to pixels differently per timescale:
  //   Hour:  days * 24 * columnWidth
  //   Month: (days / 30) * columnWidth   ← each "day" = 1/30 of a column
  //   Day/Week: days * columnWidth
  //
  // For Month view, multiply desired column counts by 30 to get the day values
  // that will produce the right pixel thresholds after the /30 conversion.
  // e.g. 20 month columns buffer = 20 * 30 = 600 bufferDays
  Hour:  { initialDays: 14,   loadDays: 7,    bufferDays: 10   },
  Day:   { initialDays: 60,   loadDays: 30,   bufferDays: 20   },
  Week:  { initialDays: 84,   loadDays: 42,   bufferDays: 28   },
  // Month: buffer = 20 cols (~2280px), load = 36 cols per extend, initial = 120 cols (~10 years)
  Month: { initialDays: 3600, loadDays: 1080, bufferDays: 600  },
}

@Component({
  selector: 'app-timeline',
  imports: [CommonModule, WorkOrderPanelComponent],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('rightColumn') rightColumn!: ElementRef<HTMLDivElement>

  @Input() selectedTimescale: Timescale = 'Month'
  @Input() workCenters: WorkCenterDocument[] = []

  // Memoized map of wcId → orders. Rebuilt only when workOrders is set,
  // not on every CD cycle. This prevents getOrdersForWorkCenter() from
  // iterating the full array on every scroll/mousemove event.
  private _ordersByWc: Map<string, WorkOrderDocument[]> = new Map()

  private _workOrders: WorkOrderDocument[] = []
  @Input() set workOrders(orders: WorkOrderDocument[]) {
    this._workOrders = orders
    this._rebuildOrdersMap()
  }
  get workOrders(): WorkOrderDocument[] { return this._workOrders }

  // Emitted whenever workOrders mutates (create, edit, delete).
  // The parent (AppComponent) listens to persist the new array to localStorage.
  @Output() workOrdersChanged = new EventEmitter<WorkOrderDocument[]>()

  // Internal active timescale used by all rendering/scroll methods.
  // Kept one step behind selectedTimescale so ngOnChanges can read the
  // OLD timescale for anchor-date calculation before switching to the new one.
  _activeTimescale: Timescale = 'Month'  // public for testability

  columnWidth = 114
  visibleStart!: Date
  visibleEnd!: Date

  timelineColumns: Date[]   = []
  weekGroups:  WeekGroup[]  = []
  monthGroups: MonthGroup[] = []
  dayGroups:   DayGroup[]   = []
  totalColumns: number      = 0

  private _cachedDayColumns: Date[] = []
  private isLoadingMore = false
  isReady = false
  openMenuOrderId: string | null = null
  orderMenuTop  = 0
  orderMenuLeft = 0

  toggleOrderMenu(orderId: string, event: MouseEvent): void {
    event.stopPropagation()
    if (this.openMenuOrderId === orderId) {
      this.openMenuOrderId = null
      return
    }
    // Calculate position relative to .timeline-grid so the menu can be
    // rendered as a direct child of the grid, escaping the bar's stacking
    // context (which would otherwise clip it regardless of z-index).
    const btn   = (event.currentTarget as HTMLElement)
    const grid  = this.rightColumn.nativeElement.querySelector('.timeline-grid') as HTMLElement
    const btnR  = btn.getBoundingClientRect()
    const gridR = grid.getBoundingClientRect()
    this.orderMenuTop  = btnR.bottom - gridR.top + 4
    this.orderMenuLeft = btnR.left - gridR.left
    this.openMenuOrderId = orderId
  }

  onEditOrder(orderId: string, event: MouseEvent): void {
    event.stopPropagation()
    this.openMenuOrderId = null
    // TODO: wire up edit panel
    console.log('Edit order', orderId)
  }

  onDeleteOrder(orderId: string, event: MouseEvent): void {
    event.stopPropagation()
    this.openMenuOrderId = null
    this.workOrders = this.workOrders.filter(o => o.docId !== orderId)
    this.emitWorkOrdersChanged()
  }

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    this._activeTimescale = this.selectedTimescale
    this.initializeRange(new Date())
  }

  ngOnChanges(_changes: SimpleChanges): void {
    // Compare state directly rather than inspecting the SimpleChanges structure.
    // This works regardless of how SimpleChanges is shaped (e.g. in tests),
    // and the _activeTimescale !== selectedTimescale guard naturally prevents
    // the initial change (both are 'Month') from triggering a transition.
    if (this._activeTimescale !== this.selectedTimescale) {
      this.handleTimescaleChange(this.selectedTimescale)
    }
  }

  ngAfterViewInit(): void {
    this.isLoadingMore = true

    const el = this.rightColumn.nativeElement

    el.addEventListener('wheel', (e: WheelEvent) => {
      if (e.deltaX === 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }, { passive: false })

    this.ngZone.runOutsideAngular(() => {
      el.addEventListener('scroll', () => this.onScroll())
    })

    document.addEventListener('click', () => {
      if (this.openMenuOrderId !== null) {
        this.openMenuOrderId = null
      }
    })

    setTimeout(() => {
      this.cdr.detectChanges()
      this.scrollToDate(new Date(), 'left')
      this.isReady = true
      this.isLoadingMore = false
      this.checkScrollEdges()
    }, 0)
  }

  // ---------------------------------------------------------------------------
  // Timescale transition
  // ---------------------------------------------------------------------------

  private handleTimescaleChange(newTimescale: Timescale): void {
    // _activeTimescale is the only reliable source of the old timescale.
    // this.selectedTimescale is already the new value by the time ngOnChanges fires.
    const previousTimescale = this._activeTimescale

    // Calculate anchorDate NOW while _activeTimescale still reflects the old
    // timescale and the DOM still has the old columns.
    // Guard: rightColumn doesn't exist in unit tests.
    let anchorDate: Date = new Date()
    if (this.rightColumn?.nativeElement) {
      // _activeTimescale is still old here — getDateAtPixel reads it correctly
      anchorDate = this.getDateAtPixel(this.rightColumn.nativeElement.scrollLeft)
    }

    // When leaving Month view, getDateAtPixel returns the 1st of the month.
    // If today falls within the visible month, use today instead.
    if (previousTimescale === 'Month') {
      const today = new Date()
      if (
        today.getFullYear() === anchorDate.getFullYear() &&
        today.getMonth()    === anchorDate.getMonth()
      ) {
        anchorDate = today
      }
    }

    // When switching into Hour view, use the real current time if anchorDate is today.
    if (newTimescale === 'Hour') {
      const now = new Date()
      if (
        anchorDate.getFullYear() === now.getFullYear() &&
        anchorDate.getMonth()    === now.getMonth()    &&
        anchorDate.getDate()     === now.getDate()
      ) {
        anchorDate = now
      }
    }

    // Fade out BEFORE changing _activeTimescale. If _activeTimescale were updated
    // here, Angular's next CD cycle would re-render the template with the new
    // timescale's content before the fade-out completes — the content would visually
    // swap, then disappear, then reappear. Setting isReady = false first means the
    // old content fades out cleanly, then the new content fades in.
    this.isReady = false
    this.isLoadingMore = true

    setTimeout(() => {
      // Now safe to update — the fade-out has completed
      this._activeTimescale = newTimescale
      this.initializeRange(anchorDate)
      this.cdr.detectChanges()
      if (this.rightColumn?.nativeElement) {
        this.scrollToDate(anchorDate, 'left')
        this.checkScrollEdges()
      }
      this.isReady = true
    }, 80)
  }

  // ---------------------------------------------------------------------------
  // Range init & column cache
  // ---------------------------------------------------------------------------

  initializeRange(startDate: Date): void {
    const cfg    = WINDOW_CONFIG[this._activeTimescale]
    const start  = this.startOfDay(startDate)
    const bufPx  = this.daysToPixels(cfg.bufferDays)
    const keepPx = bufPx * 3

    // Push visibleStart back so startDate lands at keepPx from the left edge.
    // This ensures checkScrollEdges on load doesn't immediately trigger an extend
    // because today is too close to the left boundary.
    const keepCols = Math.ceil(keepPx / this.columnWidth)

    if (this._activeTimescale === 'Month') {
      this.visibleStart = new Date(start.getFullYear(), start.getMonth() - keepCols, 1)
      this.visibleEnd   = new Date(start.getFullYear(), start.getMonth() + Math.round(cfg.initialDays / 30), 0)
    } else if (this._activeTimescale === 'Hour') {
      this.visibleStart = this.addDays(start, -Math.ceil(keepCols / 24))
      this.visibleEnd   = this.addDays(start, cfg.initialDays)
    } else {
      this.visibleStart = this.addDays(start, -keepCols)
      this.visibleEnd   = this.addDays(start, cfg.initialDays)
    }

    this.refreshColumnCache()
  }

  private refreshColumnCache(): void {
    this._cachedDayColumns = this.buildDayColumns()
    const hourCols = this.buildHourColumns()

    let cols: Date[]
    switch (this._activeTimescale) {
      case 'Hour':  cols = hourCols;                 break
      case 'Day':   cols = this._cachedDayColumns;   break
      case 'Week':  cols = this._cachedDayColumns;   break
      case 'Month': cols = this.buildMonthColumns(); break
    }

    this.timelineColumns = cols
    this.weekGroups      = this.buildWeekGroups(this._cachedDayColumns)
    this.monthGroups     = this.buildMonthGroups(this._cachedDayColumns)
    this.dayGroups       = this.buildDayGroups(hourCols)
    this.totalColumns    = this._activeTimescale === 'Week'
                           ? this._cachedDayColumns.length
                           : cols.length
    this._updateGridBackground()
  }

  // ---------------------------------------------------------------------------
  // Scroll edge detection
  // ---------------------------------------------------------------------------

  private onScroll(): void {
    if (this.isLoadingMore) return
    const el      = this.rightColumn.nativeElement
    const cfg     = WINDOW_CONFIG[this._activeTimescale]
    const bufPx   = this.daysToPixels(cfg.bufferDays)
    const totalPx = this.totalColumns * this.columnWidth
    if (el.scrollLeft < bufPx || el.scrollLeft + el.clientWidth > totalPx - bufPx) {
      this.isLoadingMore = true
      this.extendRange()
    }
  }

  private checkScrollEdges(): void {
    const el      = this.rightColumn.nativeElement
    const cfg     = WINDOW_CONFIG[this._activeTimescale]
    const bufPx   = this.daysToPixels(cfg.bufferDays)
    const totalPx = this.totalColumns * this.columnWidth
    if (el.scrollLeft < bufPx || el.scrollLeft + el.clientWidth > totalPx - bufPx) {
      this.isLoadingMore = true
      this.extendRange()
    } else {
      this.isLoadingMore = false
    }
  }

  private extendRange(): void {
    const el     = this.rightColumn.nativeElement
    const cfg    = WINDOW_CONFIG[this._activeTimescale]
    const bufPx  = this.daysToPixels(cfg.bufferDays)
    const keepPx = bufPx * 3

    const colsFromStart = (d: Date): number => {
      if (this._activeTimescale === 'Month')
        return (d.getFullYear() - this.visibleStart.getFullYear()) * 12 + (d.getMonth() - this.visibleStart.getMonth())
      if (this._activeTimescale === 'Hour')
        return this.daysBetween(this.visibleStart, d) * 24
      return this.daysBetween(this.visibleStart, d)
    }

    const totalCols = (): number => {
      if (this._activeTimescale === 'Month')
        return (this.visibleEnd.getFullYear() - this.visibleStart.getFullYear()) * 12 + (this.visibleEnd.getMonth() - this.visibleStart.getMonth()) + 1
      if (this._activeTimescale === 'Hour')
        return this.daysBetween(this.visibleStart, this.visibleEnd) * 24 + 24
      return this.daysBetween(this.visibleStart, this.visibleEnd) + 1
    }

    const anchorDate         = this.getDateAtPixel(el.scrollLeft)
    const originalAnchorCols = Math.floor(el.scrollLeft / this.columnWidth)
    let   rightTrimmedCols   = 0  // exact column count removed from left during right-extend

    const extendingLeft  = colsFromStart(anchorDate) * this.columnWidth < bufPx
    const extendingRight = el.scrollLeft + el.clientWidth > totalCols() * this.columnWidth - bufPx

    if (extendingLeft) {
      // Extend until the anchor is keepPx from the left edge (not just bufPx).
      // Stopping at bufPx leaves only a tiny margin before the next trigger.
      while (colsFromStart(anchorDate) * this.columnWidth < keepPx) {
        if (this._activeTimescale === 'Month') {
          const m = Math.round(cfg.loadDays / 30)
          this.visibleStart = new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth() - m, 1)
        } else {
          this.visibleStart = this.addDays(this.visibleStart, -cfg.loadDays)
        }
      }
      // Trim the distant future (right side) — no scrollLeft adjustment needed
      const finalScrollLeft = colsFromStart(anchorDate) * this.columnWidth
      const rightExcess = totalCols() * this.columnWidth - (finalScrollLeft + el.clientWidth) - keepPx
      if (rightExcess > 0) {
        if (this._activeTimescale === 'Month') {
          this.visibleEnd = new Date(this.visibleEnd.getFullYear(), this.visibleEnd.getMonth() - Math.floor(rightExcess / this.columnWidth), 0)
        } else if (this._activeTimescale === 'Hour') {
          this.visibleEnd = this.addDays(this.visibleEnd, -Math.floor(rightExcess / this.columnWidth / 24))
        } else {
          this.visibleEnd = this.addDays(this.visibleEnd, -Math.floor(rightExcess / this.columnWidth))
        }
      }
    }

    if (extendingRight) {
      while (el.scrollLeft + el.clientWidth > totalCols() * this.columnWidth - keepPx) {
        if (this._activeTimescale === 'Month') {
          const m = Math.round(cfg.loadDays / 30)
          this.visibleEnd = new Date(this.visibleEnd.getFullYear(), this.visibleEnd.getMonth() + m + 1, 0)
        } else {
          this.visibleEnd = this.addDays(this.visibleEnd, cfg.loadDays)
        }
      }
      // Trim the distant past (left side) when extending right.
      // Capture rightTrimmedCols before mutating visibleStart so we can
      // apply an exact scrollDelta correction afterward — without it,
      // scrollLeft stays the same while the column origin shifts right,
      // teleporting the user leftward and re-triggering the extend loop.
      // Capture visibleStart before trimming so we can compute the exact
      // column count removed — pixel-based estimates have rounding errors
      // especially in Month view where months snap to the 1st of the month.
      const visibleStartBefore = new Date(this.visibleStart)
      const leftExcess = el.scrollLeft - keepPx
      if (leftExcess > 0) {
        const colsToTrim = Math.floor(leftExcess / this.columnWidth)
        if (this._activeTimescale === 'Month') {
          this.visibleStart = new Date(
            this.visibleStart.getFullYear(),
            this.visibleStart.getMonth() + colsToTrim,
            1
          )
        } else if (this._activeTimescale === 'Hour') {
          this.visibleStart = this.addDays(this.visibleStart, Math.floor(colsToTrim / 24))
        } else {
          this.visibleStart = this.addDays(this.visibleStart, colsToTrim)
        }
        // Compute exact cols trimmed from the difference in colsFromStart,
        // not from leftExcess — this accounts for month-boundary snapping.
        const newColsFromStart = ((): number => {
          if (this._activeTimescale === 'Month')
            return (this.visibleStart.getFullYear() - visibleStartBefore.getFullYear()) * 12
                   + (this.visibleStart.getMonth() - visibleStartBefore.getMonth())
          if (this._activeTimescale === 'Hour')
            return this.daysBetween(visibleStartBefore, this.visibleStart) * 24
          return this.daysBetween(visibleStartBefore, this.visibleStart)
        })()
        rightTrimmedCols = newColsFromStart
      }
    }

    // scrollDelta for left extend: visibleStart moved left, column indices
    // increased — add the difference so scrollLeft points at the same date.
    // scrollDelta for right extend: visibleStart moved right, column indices
    // decreased — subtract the exact trimmed column pixels to compensate.
    const scrollDelta = extendingLeft
      ? (colsFromStart(anchorDate) - originalAnchorCols) * this.columnWidth
      : -(rightTrimmedCols * this.columnWidth)

    if (scrollDelta !== 0) el.scrollLeft += scrollDelta

    this.refreshColumnCache()

    requestAnimationFrame(() => {
      this.cdr.detectChanges()
      this.isLoadingMore = false
    })
  }

  // ---------------------------------------------------------------------------
  // Column builders
  // ---------------------------------------------------------------------------

  private buildHourColumns(): Date[] {
    const hours: Date[] = []
    const cur = new Date(this.visibleStart); cur.setHours(0, 0, 0, 0)
    const end = new Date(this.visibleEnd);   end.setHours(23, 0, 0, 0)
    while (cur <= end) { hours.push(new Date(cur)); cur.setHours(cur.getHours() + 1) }
    return hours
  }

  private buildDayColumns(): Date[] {
    const days: Date[] = []
    const cur = this.startOfDay(this.visibleStart)
    const end = this.startOfDay(this.visibleEnd)
    while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    return days
  }

  private buildMonthColumns(): Date[] {
    const months: Date[] = []
    const cur = new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth(), 1)
    const end = new Date(this.visibleEnd.getFullYear(),   this.visibleEnd.getMonth(),   1)
    while (cur <= end) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1) }
    return months
  }

  // ---------------------------------------------------------------------------
  // Group builders
  // ---------------------------------------------------------------------------

  private buildWeekGroups(days: Date[]): WeekGroup[] {
    const groups: WeekGroup[] = []
    let cur: WeekGroup | null = null
    for (const day of days) {
      if (!cur || day.getDay() === 1) {
        if (cur) groups.push(cur)
        const wn     = this.isoWeek(day)
        const isoDay = (day.getDay() + 6) % 7
        const thu    = new Date(day)
        thu.setDate(day.getDate() + (3 - isoDay))
        cur = {
          label: `W${wn}, ${thu.toLocaleString('default', { month: 'long' })}, ${thu.getFullYear()}`,
          days: []
        }
      }
      cur.days.push(day)
    }
    if (cur) groups.push(cur)
    return groups
  }

  private buildMonthGroups(days: Date[]): MonthGroup[] {
    const groups: MonthGroup[] = []
    let cur: MonthGroup | null = null
    let curMonth = -1, curYear = -1
    for (const day of days) {
      if (day.getMonth() !== curMonth || day.getFullYear() !== curYear) {
        if (cur) groups.push(cur)
        curMonth = day.getMonth()
        curYear  = day.getFullYear()
        cur = { label: day.toLocaleString('default', { month: 'long', year: 'numeric' }), days: [] }
      }
      cur!.days.push(day)
    }
    if (cur) groups.push(cur)
    return groups
  }

  private buildDayGroups(hours: Date[]): DayGroup[] {
    const groups: DayGroup[] = []
    let cur: DayGroup | null = null
    let curDate = -1, curMonth = -1, curYear = -1
    for (const hour of hours) {
      if (hour.getDate() !== curDate || hour.getMonth() !== curMonth || hour.getFullYear() !== curYear) {
        if (cur) groups.push(cur)
        curDate  = hour.getDate()
        curMonth = hour.getMonth()
        curYear  = hour.getFullYear()
        cur = {
          label: hour.toLocaleString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          hours: []
        }
      }
      cur!.hours.push(hour)
    }
    if (cur) groups.push(cur)
    return groups
  }

  private isoWeek(date: Date): number {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const w1 = new Date(d.getFullYear(), 0, 4)
    return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
  }

  // ---------------------------------------------------------------------------
  // Label helpers
  // ---------------------------------------------------------------------------

  getHourLabel(date: Date): string {
    const h = date.getHours()
    if (h === 0)  return '12 AM'
    if (h < 12)   return `${h} AM`
    if (h === 12) return '12 PM'
    return `${h - 12} PM`
  }

  getDayLabel(date: Date):   string { return date.toLocaleString('default', { month: 'short', day: 'numeric' }) }
  getMonthLabel(date: Date): string { return date.toLocaleString('default', { month: 'short', year: 'numeric' }) }

  private readonly weekdayAbbr = ['Sun', 'Mon', 'Tues', 'Weds', 'Thur', 'Fri', 'Sat']

  getWeekDayLabel(date: Date): string {
    return date.toLocaleString('default', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // ---------------------------------------------------------------------------
  // Bar positioning
  // ---------------------------------------------------------------------------

  // @upgrade Hour-level scheduling: startDate and endDate are currently stored
  // as YYYY-MM-DD strings and always resolved to midnight (00:00). To support
  // specific start/end hours, change the data model to store ISO-8601 datetime
  // strings (e.g. '2026-04-01T08:00:00'), update getColumnIndex to parse the
  // hour component and add it as a fractional column offset in Hour view, update
  // getBarStyleObject to compute sub-column pixel offsets for Hour view, and
  // update the work-order-panel form to include time pickers alongside the date
  // pickers. The CustomDateFormatter and overlap validation would also need to
  // account for time when comparing ranges.
  getColumnIndex(dateStr: string): number {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const date = new Date(y, mo - 1, d)
    switch (this._activeTimescale) {
      case 'Hour':  return this.daysBetween(this.visibleStart, date) * 24
      case 'Day':
      case 'Week':  return this.daysBetween(this.visibleStart, date)
      case 'Month': {
        const sy = this.visibleStart.getFullYear(), sm = this.visibleStart.getMonth()
        return (date.getFullYear() - sy) * 12 + (date.getMonth() - sm)
      }
    }
  }

  // @upgrade Long work order bar performance: bars are currently rendered at
  // their full pixel width regardless of how much is actually visible in the
  // viewport. A work order spanning 2 years in Day view renders a bar ~82,000px
  // wide, causing significant layout and paint cost. The fix is to clip each
  // bar's left/width to the visible scroll range before rendering — compute
  // the intersection of [barStart, barEnd] with [scrollLeft, scrollLeft + clientWidth],
  // and only render bars that intersect the viewport. Virtual scrolling (e.g.
  // Angular CDK ScrollingModule) could also be applied to the row axis if the
  // number of work centers grows large. This optimisation should be prioritised
  // if users regularly create orders spanning more than ~6 months in Day view.
  getBarStyleObject(order: WorkOrderDocument): { [k: string]: string } {
    const s = this.getColumnIndex(order.data.startDate)
    const e = this.getColumnIndex(order.data.endDate) + 1
    // Inset 1px from each column edge so the bar never touches the adjacent
    // column's border — without this the bar right edge lands exactly on the
    // next column's 1px border, causing a visual collision.
    return {
      left:               `${s * this.columnWidth + 1}px`,
      width:              `${(e - s) * this.columnWidth - 2}px`,
      'background-color': this.getStatusBgColor(order.data.status),
      border:             `1px solid ${this.getStatusBorderColor(order.data.status)}`
    }
  }

  getCurrentPeriodOffset(): number {
    const t   = new Date()
    const str = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
    const dayOffset = this.getColumnIndex(str) * this.columnWidth
    // For Hour view, add the current hour so the indicator tracks actual time
    const hourOffset = this._activeTimescale === 'Hour' ? t.getHours() * this.columnWidth : 0
    return dayOffset + hourOffset + this.columnWidth / 2
  }

  getCurrentPeriodLabel(): string {
    return { Hour: 'Current hour', Day: 'Current day', Week: 'Current week', Month: 'Current month' }[this._activeTimescale]
  }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  private emitWorkOrdersChanged(): void {
    this.workOrdersChanged.emit(this.workOrders)
  }

  getOrderById(docId: string): WorkOrderDocument {
    return this.workOrders.find(o => o.docId === docId)!
  }

  private _rebuildOrdersMap(): void {
    this._ordersByWc = new Map()
    for (const o of this._workOrders) {
      const arr = this._ordersByWc.get(o.data.workCenterId) ?? []
      arr.push(o)
      this._ordersByWc.set(o.data.workCenterId, arr)
    }
  }

  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this._ordersByWc.get(wcId) ?? []
  }

  getStatusLabel(s: string): string {
    return ({ open: 'Open', 'in-progress': 'In progress', complete: 'Complete', blocked: 'Blocked' } as any)[s] ?? s
  }

  getStatusBgColor(s: string):     string { return ({ open: '#F2FEFF', 'in-progress': '#EDEEFF', complete: '#F8FFF3', blocked: '#FFFCF1' } as any)[s] ?? '#F2FEFF' }
  getStatusTextColor(s: string):   string { return ({ open: 'rgba(0,176,191,1)', 'in-progress': 'rgba(62,64,219,1)', complete: 'rgba(8,162,104,1)', blocked: 'rgba(177,54,0,1)' } as any)[s] ?? 'rgba(0,176,191,1)' }
  getStatusBorderColor(s: string): string { return ({ open: '#CEFBFF', 'in-progress': '#DEE0FF', complete: '#D1FAB3', blocked: '#FFF5CF' } as any)[s] ?? '#CEFBFF' }
  getStatusBadgeColor(s: string):  string { return ({ open: '#E4FDFF', 'in-progress': '#D6D8FF', complete: '#E1FFCC', blocked: '#FCEEB5' } as any)[s] ?? '#E4FDFF' }
  getStatusBadgeStyle(s: string):  { [k: string]: string } {
    return { 'background-color': this.getStatusBadgeColor(s), color: this.getStatusTextColor(s) }
  }

  // Cached — only recomputed in refreshColumnCache when columnWidth changes.
  // A getter would recompute this string on every CD cycle.
  gridBackgroundStyle: { [k: string]: string } = {}

  private _updateGridBackground(): void {
    const w      = this.columnWidth
    const border = 'rgba(230, 235, 240, 1)'
    const bg     = 'rgba(247, 249, 252, 1)'
    this.gridBackgroundStyle = {
      '--timeline-grid-bg': `repeating-linear-gradient(to right, ${bg} 0px, ${bg} ${w - 1}px, ${border} ${w - 1}px, ${border} ${w}px)`
    }
  }

  // ---------------------------------------------------------------------------
  // Hover ghost — empty slot preview shown when hovering an unoccupied column
  // ---------------------------------------------------------------------------

  hoverGhost: { left: number; wcId: string } | null = null
  private _lastMouseCol = -1  // last column index processed by mousemove — skip if unchanged

  onRowMousemove(event: MouseEvent, wcId: string): void {
    const el         = this.rightColumn.nativeElement
    // Use the right-column container's left edge as the reference point.
    // The row stretches the full grid width but clientX needs to be measured
    // from the scrollable container's visible left edge, then offset by scrollLeft.
    const containerLeft = el.getBoundingClientRect().left
    const colIdx = Math.floor((event.clientX - containerLeft + el.scrollLeft) / this.columnWidth)
    const left   = colIdx * this.columnWidth + 1

    const occupied = this.getOrdersForWorkCenter(wcId).some(o => {
      const s = this.getColumnIndex(o.data.startDate)
      const e = this.getColumnIndex(o.data.endDate)
      return colIdx >= s && colIdx <= e
    })

    this.hoverGhost = occupied ? null : { left, wcId }
  }

  onRowMouseleave(): void {
    this.hoverGhost = null
  }

  // ---------------------------------------------------------------------------
  // Work order panel (create / edit)
  // ---------------------------------------------------------------------------

  panelMode:    'create' | 'edit' | null = null
  panelInitial: Partial<PanelWorkOrder> | undefined

  openCreatePanel(wcId: string, colIdx: number): void {
    const startDate = this.getDateAtPixel(colIdx * this.columnWidth)
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    const endDate   = new Date(d); endDate.setDate(endDate.getDate() + 7)
    const fmt = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`

    this.panelInitial = { workCenterId: wcId, startDate: fmt(d), endDate: fmt(endDate) }
    this.panelMode    = 'create'
    this.hoverGhost   = null
  }

  openEditPanel(order: WorkOrderDocument): void {
    this.panelInitial = {
      docId:        order.docId,
      workCenterId: order.data.workCenterId,
      name:         order.data.name,
      status:       order.data.status,
      startDate:    order.data.startDate,
      endDate:      order.data.endDate
    }
    this.panelMode    = 'edit'
    this.openMenuOrderId = null
  }

  onPanelSave(data: PanelWorkOrder): void {
    if (this.panelMode === 'create') {
      const newOrder: WorkOrderDocument = {
        docId:    `wo-${Date.now()}`,
        docType:  'workOrder',
        data: {
          name:         data.name,
          workCenterId: data.workCenterId,
          status:       data.status,
          startDate:    data.startDate,
          endDate:      data.endDate
        }
      }
      this.workOrders = [...this.workOrders, newOrder]
    } else if (this.panelMode === 'edit' && data.docId) {
      this.workOrders = this.workOrders.map(o =>
        o.docId === data.docId
          ? { ...o, data: { ...o.data, name: data.name, status: data.status, startDate: data.startDate, endDate: data.endDate } }
          : o
      )
    }
    this.panelMode = null
    this.emitWorkOrdersChanged()
  }

  onPanelCancel(): void {
    this.panelMode = null
  }



  // ---------------------------------------------------------------------------
  // trackBy
  // ---------------------------------------------------------------------------

  trackByDate    = (_: number, d: Date)                => d.getTime()
  trackByWcId    = (_: number, wc: WorkCenterDocument) => wc.docId
  trackByOrderId = (_: number, o: WorkOrderDocument)   => o.docId
  trackByIndex   = (i: number)                         => i

  // ---------------------------------------------------------------------------
  // Date utilities
  // ---------------------------------------------------------------------------

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  private addDays(d: Date, n: number): Date {
    const r = this.startOfDay(d); r.setDate(r.getDate() + n); return r
  }

  private daysBetween(from: Date, to: Date): number {
    const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
    const b = Date.UTC(to.getFullYear(),   to.getMonth(),   to.getDate())
    return Math.floor((b - a) / 86400000)
  }

  private daysToPixels(days: number): number {
    switch (this._activeTimescale) {
      case 'Hour':  return days * 24 * this.columnWidth
      case 'Month': return (days / 30) * this.columnWidth
      default:      return days * this.columnWidth
    }
  }

  getDateAtPixel(px: number): Date {
    switch (this._activeTimescale) {
      case 'Hour': {
        const r = new Date(this.visibleStart)
        r.setHours(r.getHours() + Math.floor(px / this.columnWidth))
        return r
      }
      case 'Day':
      case 'Week':
        return this.addDays(this.visibleStart, Math.floor(px / this.columnWidth))
      case 'Month': {
        const m = Math.min(Math.floor(px / this.columnWidth), 1200)
        return new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth() + m, 1)
      }
    }
  }

  // Scrolls the timeline so the current period indicator is centered in view.
  // Called by the "Today" button in AppComponent via a template reference (#timeline).
  scrollToToday(): void {
    const today = new Date()

    // Check if today falls within the currently loaded range. If not —
    // which happens after scrolling far away and switching timescales —
    // reinitialize the range around today first so getColumnIndex returns
    // a valid positive offset before we attempt to scroll.
    const todayInRange = today >= this.visibleStart && today <= this.visibleEnd

    if (!todayInRange) {
      // Use the same fade cycle as a timescale switch so the content swap
      // is smooth and isLoadingMore gates the scroll listener correctly.
      this.isReady = false
      this.isLoadingMore = true
      setTimeout(() => {
        this.initializeRange(today)
        this.cdr.detectChanges()
        this.scrollToDate(today, 'left')
        this.checkScrollEdges()
        this.isReady = true
      }, 80)
    } else {
      this.scrollToDate(today, 'left')
    }
  }

  private scrollToDate(date: Date, align: 'left' | 'center'): void {
    const el  = this.rightColumn.nativeElement
    const str = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    let px = this.getColumnIndex(str) * this.columnWidth
    // For Hour view, offset by the hour so we scroll to the actual hour not midnight
    if (this._activeTimescale === 'Hour') px += date.getHours() * this.columnWidth
    el.scrollLeft = align === 'center' ? Math.max(0, px - el.clientWidth / 2) : Math.max(0, px)
  }
}