import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter,
  Input, NgZone, OnChanges, OnInit,
  Output, SimpleChanges, ViewChild
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { WorkCenterDocument, WorkOrderDocument, WorkOrderStatus } from '../../models/documents.model'
import { WorkOrderPanelComponent, PanelWorkOrder } from '../work-order-panel/work-order-panel.component'
import { WorkOrderBarComponent } from '../work-order-bar/work-order-bar.component'
import { startOfDay, addDays, daysBetween, formatDateString } from '../../utils/timeline-date.utils'
import { STATUS_BG_COLORS, STATUS_BORDER_COLORS } from '../../constants/work-order-status.constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'
type ScrollAlignment = 'left' | 'center'

/** A group of consecutive days belonging to the same ISO week, used to render
 *  the top header row in Week view. */
interface WeekGroup  { label: string; days:  Date[] }

/** A group of consecutive days belonging to the same calendar month, used for
 *  the top header row in Day view. */
interface MonthGroup { label: string; days:  Date[] }

/** A group of consecutive hours belonging to the same calendar day, used for
 *  the top header row in Hour view. */
interface DayGroup   { label: string; hours: Date[] }

/** Controls the virtual scroll window for each timescale.
 *
 *  - `initialDays`  — how many days of columns to render on first load.
 *  - `loadDays`     — how many days to add per extend trigger. Larger values
 *                     mean fewer triggers at the cost of more memory.
 *  - `bufferDays`   — how close to the edge (in days) before triggering an
 *                     extend. Larger values trigger earlier, reducing jitter.
 *
 *  NOTE: `daysToPixels()` converts these values to pixels differently per
 *  timescale:
 *    Hour:     days × 24 × columnWidth
 *    Month:   (days / 30) × columnWidth  ← one "day" = 1/30 of a column
 *    Day/Week: days × columnWidth
 *
 *  For Month view, multiply the desired column count by 30 to produce a
 *  `bufferDays`/`loadDays` value that converts to the right pixel threshold.
 *  e.g. 20 month columns of buffer = 20 × 30 = 600 bufferDays.
 */
interface WindowConfig { initialDays: number; loadDays: number; bufferDays: number }

// ---------------------------------------------------------------------------
// Window configuration
// ---------------------------------------------------------------------------

const WINDOW_CONFIG: Record<Timescale, WindowConfig> = {
  Hour:  { initialDays: 14,   loadDays: 7,    bufferDays: 10  },
  Day:   { initialDays: 60,   loadDays: 30,   bufferDays: 20  },
  Week:  { initialDays: 84,   loadDays: 42,   bufferDays: 28  },
  // Month values are ×30 — see WindowConfig comment above.
  // buffer = 20 month-cols, load = 36 month-cols, initial = 120 month-cols (~10 years)
  Month: { initialDays: 3600, loadDays: 1080, bufferDays: 600 },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, WorkOrderPanelComponent, WorkOrderBarComponent],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit, AfterViewInit, OnChanges {

  // -------------------------------------------------------------------------
  // View references
  // -------------------------------------------------------------------------

  @ViewChild('rightColumn') rightColumn!: ElementRef<HTMLDivElement>

  // -------------------------------------------------------------------------
  // Inputs / Outputs
  // -------------------------------------------------------------------------

  @Input() selectedTimescale: Timescale = 'Month'
  @Input() workCenters: WorkCenterDocument[] = []

  /** Emitted whenever `workOrders` mutates (create, edit, delete).
   *  AppComponent listens to persist the updated array to localStorage. */
  @Output() workOrdersChanged = new EventEmitter<WorkOrderDocument[]>()

  /** Work orders are stored via a setter so the by-work-center lookup map
   *  is always rebuilt immediately on assignment rather than on every CD cycle. */
  private _workOrders: WorkOrderDocument[] = []
  private _ordersByWorkCenter: Map<string, WorkOrderDocument[]> = new Map()

  @Input() set workOrders(orders: WorkOrderDocument[]) {
    this._workOrders = orders
    this.rebuildOrdersByWorkCenterMap()
  }
  get workOrders(): WorkOrderDocument[] {
    return this._workOrders
  }

  // -------------------------------------------------------------------------
  // Active timescale
  //
  // `_activeTimescale` is the timescale used by all rendering and scroll
  // calculations. It intentionally lags one step behind `selectedTimescale` so
  // that ngOnChanges can read the OLD timescale when computing the anchor date
  // for a transition — by the time Angular fires ngOnChanges,
  // `selectedTimescale` already holds the new value.
  // Exposed as public for unit-test assertions.
  // -------------------------------------------------------------------------

  _activeTimescale: Timescale = 'Month'

  // -------------------------------------------------------------------------
  // Column layout state
  // -------------------------------------------------------------------------

  /** Width of a single column in pixels. All pixel/column math derives from this. */
  readonly columnWidth = 114

  /** Inclusive start of the currently loaded date window. */
  visibleStart!: Date

  /** Inclusive end of the currently loaded date window. */
  visibleEnd!: Date

  /** Primary column array rendered in the bottom header row. Contents vary by
   *  timescale: hours for Hour, days for Day/Week, months for Month. */
  timelineColumns: Date[] = []

  /** Top header groups for Week view (one per ISO week). */
  weekGroups: WeekGroup[] = []

  /** Top header groups for Day view (one per calendar month). */
  monthGroups: MonthGroup[] = []

  /** Top header groups for Hour view (one per calendar day). */
  dayGroups: DayGroup[] = []

  /** Total number of columns currently in the grid.
   *  Week view uses day-column count; all others use `timelineColumns.length`. */
  totalColumns = 0

  /** Cached day-column array shared by the week-group and month-group builders. */
  private cachedDayColumns: Date[] = []

  // -------------------------------------------------------------------------
  // UI state
  // -------------------------------------------------------------------------

  isReady = false

  /** Background gradient CSS variable, cached so it is not recalculated on
   *  every change-detection cycle. Refreshed inside `refreshColumnCache()`. */
  gridBackgroundStyle: { [key: string]: string } = {}

  // -------------------------------------------------------------------------
  // Order context-menu state
  // -------------------------------------------------------------------------

  /** docId of the order whose three-dot menu is currently open, or null. */
  openMenuOrderId: string | null = null

  /** Position of the context menu relative to `.timeline-grid`. Computed from
   *  `getBoundingClientRect()` so the menu escapes the bar's stacking context. */
  orderMenuTop  = 0
  orderMenuLeft = 0

  // -------------------------------------------------------------------------
  // Hover ghost state
  // -------------------------------------------------------------------------

  /** The ghost preview rectangle shown when hovering an empty column.
   *  `null` when no ghost should be shown. */
  hoverGhost: { left: number; wcId: string } | null = null

  /** Tracks the last column index the mouse was in so `onRowMousemove` can
   *  skip redundant work when the cursor hasn't left the current column. */
  private lastHoveredColumnIndex = -1

  // -------------------------------------------------------------------------
  // Panel state
  // -------------------------------------------------------------------------

  panelMode: 'create' | 'edit' | null = null
  panelInitialData: Partial<PanelWorkOrder> | undefined

  // -------------------------------------------------------------------------
  // Scroll / extend state
  // -------------------------------------------------------------------------

  /** True while an extend operation is in progress. Prevents re-entrant scroll
   *  events from stacking multiple concurrent extends. */
  private isExtendingRange = false

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(
    private changeDetector: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  // -------------------------------------------------------------------------
  // Lifecycle hooks
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    this._activeTimescale = this.selectedTimescale
    this.initializeRange(new Date())
  }

  ngOnChanges(_changes: SimpleChanges): void {
    // Comparing state directly rather than inspecting the SimpleChanges object
    // makes this robust to any call site (including unit tests that construct
    // their own SimpleChanges shapes). The guard also naturally prevents the
    // first change from firing since both values start as 'Month'.
    if (this._activeTimescale !== this.selectedTimescale) {
      this.beginTimescaleTransition(this.selectedTimescale)
    }
  }

  ngAfterViewInit(): void {
    this.isExtendingRange = true

    const scrollContainer = this.rightColumn.nativeElement

    // Redirect vertical wheel events to horizontal scrolling so the timeline
    // can be scrolled with a standard mouse wheel without a modifier key.
    scrollContainer.addEventListener('wheel', (event: WheelEvent) => {
      if (event.deltaX === 0) {
        event.preventDefault()
        scrollContainer.scrollLeft += event.deltaY
      }
    }, { passive: false })

    // Run the scroll listener outside Angular's zone to avoid triggering
    // change detection on every scroll event. CD is requested manually when
    // an extend operation completes.
    this.ngZone.runOutsideAngular(() => {
      scrollContainer.addEventListener('scroll', () => this.onScroll())
    })

    // Close the order context menu when clicking anywhere outside it.
    document.addEventListener('click', () => {
      if (this.openMenuOrderId !== null) {
        this.openMenuOrderId = null
      }
    })

    // Defer the initial scroll until the next tick so the DOM has rendered
    // columns at their correct widths before we attempt to measure them.
    setTimeout(() => {
      this.changeDetector.detectChanges()
      this.scrollToDate(new Date(), 'left')
      this.isReady          = true
      this.isExtendingRange = false
      this.checkScrollEdgesAndExtendIfNeeded()
    }, 0)
  }

  // -------------------------------------------------------------------------
  // Timescale transition
  // -------------------------------------------------------------------------

  /** Orchestrates the fade-out → column swap → fade-in sequence when the user
   *  selects a new timescale. The anchor date (the date at the current left
   *  edge of the viewport) is computed BEFORE mutating any state so the new
   *  view opens at the same point in time. */
  private beginTimescaleTransition(newTimescale: Timescale): void {
    const previousTimescale = this._activeTimescale
    const anchorDate        = this.computeTransitionAnchorDate(previousTimescale, newTimescale)

    // Set isReady = false BEFORE updating _activeTimescale. If we update the
    // timescale first, Angular's next CD cycle re-renders with new columns
    // while still visible, producing a flash of wrong content. Fading out
    // first ensures the old content disappears cleanly before the swap.
    this.isReady          = false
    this.isExtendingRange = true

    setTimeout(() => {
      this._activeTimescale = newTimescale
      this.initializeRange(anchorDate)
      this.changeDetector.detectChanges()
      if (this.rightColumn?.nativeElement) {
        this.scrollToDate(anchorDate, 'left')
        this.checkScrollEdgesAndExtendIfNeeded()
      }
      this.isReady = true
    }, 80)
  }

  /** Returns the date that should remain in view after a timescale switch.
   *
   *  Special cases:
   *  - Leaving Month view: `getDateAtPixel` returns the 1st of the visible
   *    month. If today falls within that month, use today instead so the new
   *    view opens on the current period rather than the start of the month.
   *  - Entering Hour view: use the real current time if the anchor is today,
   *    so the scroll lands on the actual hour rather than midnight. */
  private computeTransitionAnchorDate(fromTimescale: Timescale, toTimescale: Timescale): Date {
    let anchorDate = this.rightColumn?.nativeElement
      ? this.getDateAtPixel(this.rightColumn.nativeElement.scrollLeft)
      : new Date()

    if (fromTimescale === 'Month') {
      const today              = new Date()
      const anchorIsThisMonth  =
        today.getFullYear() === anchorDate.getFullYear() &&
        today.getMonth()    === anchorDate.getMonth()

      if (anchorIsThisMonth) anchorDate = today
    }

    if (toTimescale === 'Hour') {
      const now            = new Date()
      const anchorIsToday  =
        anchorDate.getFullYear() === now.getFullYear() &&
        anchorDate.getMonth()    === now.getMonth()    &&
        anchorDate.getDate()     === now.getDate()

      if (anchorIsToday) anchorDate = now
    }

    return anchorDate
  }

  // -------------------------------------------------------------------------
  // Range initialisation
  // -------------------------------------------------------------------------

  /** Sets `visibleStart` and `visibleEnd` around `startDate` and rebuilds
   *  the column cache. `visibleStart` is pushed back by `keepColumns` so that
   *  `startDate` lands at least `keepPx` from the left edge — this prevents
   *  `checkScrollEdgesAndExtendIfNeeded` from immediately firing an extend on
   *  first render. */
  initializeRange(startDate: Date): void {
    const config   = WINDOW_CONFIG[this._activeTimescale]
    const dayStart = startOfDay(startDate)
    const bufferPx = this.daysToPixels(config.bufferDays)
    const keepPx   = bufferPx * 3
    const keepCols = Math.ceil(keepPx / this.columnWidth)

    if (this._activeTimescale === 'Month') {
      this.visibleStart = new Date(dayStart.getFullYear(), dayStart.getMonth() - keepCols, 1)
      this.visibleEnd   = new Date(dayStart.getFullYear(), dayStart.getMonth() + Math.round(config.initialDays / 30), 0)
    } else if (this._activeTimescale === 'Hour') {
      this.visibleStart = addDays(dayStart, -Math.ceil(keepCols / 24))
      this.visibleEnd   = addDays(dayStart, config.initialDays)
    } else {
      this.visibleStart = addDays(dayStart, -keepCols)
      this.visibleEnd   = addDays(dayStart, config.initialDays)
    }

    this.refreshColumnCache()
  }

  /** Rebuilds all column arrays and header groups from the current
   *  `visibleStart`/`visibleEnd` window, then updates the cached grid
   *  background style. Called after every range mutation. */
  private refreshColumnCache(): void {
    this.cachedDayColumns = this.buildDayColumns()
    const hourColumns     = this.buildHourColumns()

    let primaryColumns: Date[]
    switch (this._activeTimescale) {
      case 'Hour':  primaryColumns = hourColumns;              break
      case 'Day':   primaryColumns = this.cachedDayColumns;    break
      case 'Week':  primaryColumns = this.cachedDayColumns;    break
      case 'Month': primaryColumns = this.buildMonthColumns(); break
    }

    this.timelineColumns = primaryColumns
    this.weekGroups      = this.buildWeekGroups(this.cachedDayColumns)
    this.monthGroups     = this.buildMonthGroups(this.cachedDayColumns)
    this.dayGroups       = this.buildDayGroups(hourColumns)

    // Week view counts day columns (one per day); all others use the primary array.
    this.totalColumns = this._activeTimescale === 'Week'
      ? this.cachedDayColumns.length
      : primaryColumns.length

    this.updateGridBackgroundStyle()
  }

  // -------------------------------------------------------------------------
  // Scroll edge detection
  // -------------------------------------------------------------------------

  /** Called from the scroll listener (outside Angular zone). Triggers a range
   *  extend when the user scrolls within `bufferPx` of either edge. */
  private onScroll(): void {
    if (this.isExtendingRange) return

    const scrollContainer = this.rightColumn.nativeElement
    const config          = WINDOW_CONFIG[this._activeTimescale]
    const bufferPx        = this.daysToPixels(config.bufferDays)
    const totalWidthPx    = this.totalColumns * this.columnWidth

    const nearLeftEdge  = scrollContainer.scrollLeft < bufferPx
    const nearRightEdge = scrollContainer.scrollLeft + scrollContainer.clientWidth > totalWidthPx - bufferPx

    if (nearLeftEdge || nearRightEdge) {
      this.isExtendingRange = true
      this.extendRange()
    }
  }

  /** Same threshold check as `onScroll`, but also resets the lock flag when no
   *  extend is needed. Used after initial load and after timescale switches. */
  private checkScrollEdgesAndExtendIfNeeded(): void {
    const scrollContainer = this.rightColumn.nativeElement
    const config          = WINDOW_CONFIG[this._activeTimescale]
    const bufferPx        = this.daysToPixels(config.bufferDays)
    const totalWidthPx    = this.totalColumns * this.columnWidth

    const nearLeftEdge  = scrollContainer.scrollLeft < bufferPx
    const nearRightEdge = scrollContainer.scrollLeft + scrollContainer.clientWidth > totalWidthPx - bufferPx

    if (nearLeftEdge || nearRightEdge) {
      this.isExtendingRange = true
      this.extendRange()
    } else {
      this.isExtendingRange = false
    }
  }

  // -------------------------------------------------------------------------
  // Range extension
  // -------------------------------------------------------------------------

  /** Extends `visibleStart` or `visibleEnd` (or both) until the viewport has at
   *  least `keepPx` of loaded columns on each side, then trims the far end to
   *  prevent unbounded memory growth.
   *
   *  After mutating the visible range, a `scrollLeft` correction is applied
   *  BEFORE `refreshColumnCache` changes the grid's DOM width. Without this
   *  ordering the browser may reposition scrollLeft on its own first, causing
   *  a visible jump. */
  private extendRange(): void {
    const scrollContainer    = this.rightColumn.nativeElement
    const config             = WINDOW_CONFIG[this._activeTimescale]
    const bufferPx           = this.daysToPixels(config.bufferDays)
    const keepPx             = bufferPx * 3
    const anchorDate         = this.getDateAtPixel(scrollContainer.scrollLeft)
    const originalAnchorCols = Math.floor(scrollContainer.scrollLeft / this.columnWidth)

    const isExtendingLeft  = this.columnsBetweenStartAndDate(anchorDate) * this.columnWidth < bufferPx
    const isExtendingRight = scrollContainer.scrollLeft + scrollContainer.clientWidth
                             > this.countTotalColumns() * this.columnWidth - bufferPx

    let columnsRemovedFromLeft = 0

    if (isExtendingLeft) {
      this.prependColumnsUntilBuffered(anchorDate, keepPx)
      this.trimDistantFuture(anchorDate, scrollContainer, keepPx)
    }

    if (isExtendingRight) {
      this.appendColumnsUntilBuffered(scrollContainer, keepPx)
      columnsRemovedFromLeft = this.trimDistantPast(scrollContainer, keepPx)
    }

    // scrollLeft correction:
    // - Left extend:  visibleStart moved earlier → column indices increased → add delta.
    // - Right extend: visibleStart moved later (trimmed) → indices decreased → subtract.
    const scrollDelta = isExtendingLeft
      ? (this.columnsBetweenStartAndDate(anchorDate) - originalAnchorCols) * this.columnWidth
      : -(columnsRemovedFromLeft * this.columnWidth)

    if (scrollDelta !== 0) {
      scrollContainer.scrollLeft += scrollDelta
    }

    this.refreshColumnCache()

    requestAnimationFrame(() => {
      this.changeDetector.detectChanges()
      this.isExtendingRange = false
    })
  }

  /** Prepends column batches to `visibleStart` until the anchor date is at
   *  least `targetBufferPx` from the left edge. */
  private prependColumnsUntilBuffered(anchorDate: Date, targetBufferPx: number): void {
    const config = WINDOW_CONFIG[this._activeTimescale]

    while (this.columnsBetweenStartAndDate(anchorDate) * this.columnWidth < targetBufferPx) {
      if (this._activeTimescale === 'Month') {
        const monthsToAdd = Math.round(config.loadDays / 30)
        this.visibleStart = new Date(
          this.visibleStart.getFullYear(),
          this.visibleStart.getMonth() - monthsToAdd,
          1
        )
      } else {
        this.visibleStart = addDays(this.visibleStart, -config.loadDays)
      }
    }
  }

  /** Appends column batches to `visibleEnd` until there is at least
   *  `targetBufferPx` of runway beyond the right edge of the viewport. */
  private appendColumnsUntilBuffered(
    scrollContainer: HTMLDivElement,
    targetBufferPx: number
  ): void {
    const config = WINDOW_CONFIG[this._activeTimescale]

    while (
      scrollContainer.scrollLeft + scrollContainer.clientWidth
      > this.countTotalColumns() * this.columnWidth - targetBufferPx
    ) {
      if (this._activeTimescale === 'Month') {
        const monthsToAdd = Math.round(config.loadDays / 30)
        this.visibleEnd = new Date(
          this.visibleEnd.getFullYear(),
          this.visibleEnd.getMonth() + monthsToAdd + 1,
          0
        )
      } else {
        this.visibleEnd = addDays(this.visibleEnd, config.loadDays)
      }
    }
  }

  /** Removes excess columns from the far right when extending left, keeping the
   *  total window size bounded. No scroll correction is needed since trimming
   *  `visibleEnd` does not affect column indices. */
  private trimDistantFuture(
    anchorDate: Date,
    scrollContainer: HTMLDivElement,
    keepPx: number
  ): void {
    const anchorScrollLeft = this.columnsBetweenStartAndDate(anchorDate) * this.columnWidth
    const excessPx         =
      this.countTotalColumns() * this.columnWidth
      - (anchorScrollLeft + scrollContainer.clientWidth)
      - keepPx

    if (excessPx <= 0) return

    const excessCols = Math.floor(excessPx / this.columnWidth)

    if (this._activeTimescale === 'Month') {
      this.visibleEnd = new Date(this.visibleEnd.getFullYear(), this.visibleEnd.getMonth() - excessCols, 0)
    } else if (this._activeTimescale === 'Hour') {
      this.visibleEnd = addDays(this.visibleEnd, -Math.floor(excessCols / 24))
    } else {
      this.visibleEnd = addDays(this.visibleEnd, -excessCols)
    }
  }

  /** Removes excess columns from the far left when extending right. Returns the
   *  exact number of columns removed so the caller can apply a scroll correction.
   *
   *  The column count is derived from the difference between the old and new
   *  `visibleStart` rather than from the pixel excess — pixel-based estimates
   *  have rounding errors in Month view because months snap to the 1st. */
  private trimDistantPast(scrollContainer: HTMLDivElement, keepPx: number): number {
    const excessPx = scrollContainer.scrollLeft - keepPx
    if (excessPx <= 0) return 0

    const colsToTrim         = Math.floor(excessPx / this.columnWidth)
    const visibleStartBefore = new Date(this.visibleStart)

    if (this._activeTimescale === 'Month') {
      this.visibleStart = new Date(
        this.visibleStart.getFullYear(),
        this.visibleStart.getMonth() + colsToTrim,
        1
      )
    } else if (this._activeTimescale === 'Hour') {
      this.visibleStart = addDays(this.visibleStart, Math.floor(colsToTrim / 24))
    } else {
      this.visibleStart = addDays(this.visibleStart, colsToTrim)
    }

    return this.columnsBetweenDates(visibleStartBefore, this.visibleStart)
  }

  // -------------------------------------------------------------------------
  // Column count helpers
  // -------------------------------------------------------------------------

  /** Number of columns from `visibleStart` up to (but not past) `date`. */
  private columnsBetweenStartAndDate(date: Date): number {
    return this.columnsBetweenDates(this.visibleStart, date)
  }

  /** Number of columns between two arbitrary dates under the active timescale. */
  private columnsBetweenDates(from: Date, to: Date): number {
    if (this._activeTimescale === 'Month') {
      return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
    }
    if (this._activeTimescale === 'Hour') {
      return daysBetween(from, to) * 24
    }
    return daysBetween(from, to)
  }

  /** Total number of columns in the currently loaded window. Used inside
   *  `extendRange` where `totalColumns` may be stale (not yet updated by
   *  `refreshColumnCache`). */
  private countTotalColumns(): number {
    if (this._activeTimescale === 'Month') {
      return (this.visibleEnd.getFullYear() - this.visibleStart.getFullYear()) * 12
           + (this.visibleEnd.getMonth() - this.visibleStart.getMonth())
           + 1
    }
    if (this._activeTimescale === 'Hour') {
      return daysBetween(this.visibleStart, this.visibleEnd) * 24 + 24
    }
    return daysBetween(this.visibleStart, this.visibleEnd) + 1
  }

  // -------------------------------------------------------------------------
  // Column builders
  // -------------------------------------------------------------------------

  private buildHourColumns(): Date[] {
    const hours   : Date[] = []
    const current = new Date(this.visibleStart)
    const end     = new Date(this.visibleEnd)
    current.setHours(0, 0, 0, 0)
    end.setHours(23, 0, 0, 0)
    while (current <= end) {
      hours.push(new Date(current))
      current.setHours(current.getHours() + 1)
    }
    return hours
  }

  private buildDayColumns(): Date[] {
    const days    : Date[] = []
    const current = startOfDay(this.visibleStart)
    const end     = startOfDay(this.visibleEnd)
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  private buildMonthColumns(): Date[] {
    const months  : Date[] = []
    const current = new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth(), 1)
    const end     = new Date(this.visibleEnd.getFullYear(),   this.visibleEnd.getMonth(),   1)
    while (current <= end) {
      months.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }

  // -------------------------------------------------------------------------
  // Header group builders
  // -------------------------------------------------------------------------

  /** Groups an array of days into ISO weeks. Each group label includes the
   *  week number and the month/year of that week's Thursday (the ISO-8601
   *  reference day for week attribution). */
  private buildWeekGroups(days: Date[]): WeekGroup[] {
    const groups: WeekGroup[] = []
    let currentGroup: WeekGroup | null = null

    for (const day of days) {
      const isStartOfWeek = day.getDay() === 1  // Monday

      if (!currentGroup || isStartOfWeek) {
        if (currentGroup) groups.push(currentGroup)

        const weekNumber = this.isoWeekNumber(day)
        const isoOffset  = (day.getDay() + 6) % 7  // 0 = Mon … 6 = Sun
        const thursday   = new Date(day)
        thursday.setDate(day.getDate() + (3 - isoOffset))

        currentGroup = {
          label: `W${weekNumber}, ${thursday.toLocaleString('default', { month: 'long' })}, ${thursday.getFullYear()}`,
          days:  [],
        }
      }
      currentGroup.days.push(day)
    }

    if (currentGroup) groups.push(currentGroup)
    return groups
  }

  /** Groups an array of days by calendar month. */
  private buildMonthGroups(days: Date[]): MonthGroup[] {
    const groups: MonthGroup[] = []
    let currentGroup: MonthGroup | null = null
    let activeMonth = -1
    let activeYear  = -1

    for (const day of days) {
      const monthChanged = day.getMonth() !== activeMonth || day.getFullYear() !== activeYear
      if (monthChanged) {
        if (currentGroup) groups.push(currentGroup)
        activeMonth  = day.getMonth()
        activeYear   = day.getFullYear()
        currentGroup = {
          label: day.toLocaleString('default', { month: 'long', year: 'numeric' }),
          days:  [],
        }
      }
      currentGroup!.days.push(day)
    }

    if (currentGroup) groups.push(currentGroup)
    return groups
  }

  /** Groups an array of hours by calendar day. */
  private buildDayGroups(hours: Date[]): DayGroup[] {
    const groups: DayGroup[] = []
    let currentGroup: DayGroup | null = null
    let activeDay   = -1
    let activeMonth = -1
    let activeYear  = -1

    for (const hour of hours) {
      const dayChanged =
        hour.getDate()     !== activeDay   ||
        hour.getMonth()    !== activeMonth ||
        hour.getFullYear() !== activeYear

      if (dayChanged) {
        if (currentGroup) groups.push(currentGroup)
        activeDay   = hour.getDate()
        activeMonth = hour.getMonth()
        activeYear  = hour.getFullYear()
        currentGroup = {
          label: hour.toLocaleString('default', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          }),
          hours: [],
        }
      }
      currentGroup!.hours.push(hour)
    }

    if (currentGroup) groups.push(currentGroup)
    return groups
  }

  /** Returns the ISO 8601 week number for a given date. Week 1 is the week
   *  containing the first Thursday of the year. */
  private isoWeekNumber(date: Date): number {
    const thursday = new Date(date)
    thursday.setHours(0, 0, 0, 0)
    thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7))
    const firstThursdayOfYear = new Date(thursday.getFullYear(), 0, 4)
    return 1 + Math.round(
      ((thursday.getTime() - firstThursdayOfYear.getTime()) / 86_400_000
      - 3
      + ((firstThursdayOfYear.getDay() + 6) % 7)) / 7
    )
  }

  // -------------------------------------------------------------------------
  // Header cell label helpers (called from template)
  // -------------------------------------------------------------------------

  getHourLabel(date: Date): string {
    const hour = date.getHours()
    if (hour === 0)  return '12 AM'
    if (hour < 12)   return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  getDayLabel(date: Date): string {
    return date.toLocaleString('default', { month: 'short', day: 'numeric' })
  }

  getMonthLabel(date: Date): string {
    return date.toLocaleString('default', { month: 'short', year: 'numeric' })
  }

  getWeekDayLabel(date: Date): string {
    return date.toLocaleString('default', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // -------------------------------------------------------------------------
  // Bar positioning
  // -------------------------------------------------------------------------

  // @upgrade Hour-level scheduling: dates are stored as YYYY-MM-DD strings and
  // resolved to midnight. To support specific start/end hours, change the model
  // to ISO-8601 datetime strings ('2026-04-01T08:00:00'), update getColumnIndex
  // to include the hour as a fractional offset in Hour view, and update
  // getBarStyleObject with sub-column pixel math. The CustomDateFormatter and
  // overlap validation in WorkOrderPanelComponent would also need updating.

  /** Returns the 0-based column index for a YYYY-MM-DD date string, measured
   *  from `visibleStart` under the currently active timescale. */
  getColumnIndex(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    switch (this._activeTimescale) {
      case 'Hour':
        return daysBetween(this.visibleStart, date) * 24

      case 'Day':
      case 'Week':
        return daysBetween(this.visibleStart, date)

      case 'Month': {
        const startYear  = this.visibleStart.getFullYear()
        const startMonth = this.visibleStart.getMonth()
        return (date.getFullYear() - startYear) * 12 + (date.getMonth() - startMonth)
      }
    }
  }

  // @upgrade Long work order bar performance: bars are rendered at their full
  // pixel width regardless of how much is visible. A bar spanning 2 years in
  // Day view is ~82,000px wide, causing significant layout and paint cost. The
  // fix is to clip each bar's left/width to the visible scroll range. Angular
  // CDK virtual scrolling could also address performance with large work-center
  // counts.

  /** Returns the absolute positioning style object for a work order bar.
   *  A 1px inset is applied on each side to prevent the bar from visually
   *  colliding with adjacent column borders. */
  getBarStyleObject(order: WorkOrderDocument): { [key: string]: string } {
    const startColumn = this.getColumnIndex(order.data.startDate)
    const endColumn   = this.getColumnIndex(order.data.endDate) + 1

    return {
      left:               `${startColumn * this.columnWidth + 1}px`,
      width:              `${(endColumn - startColumn) * this.columnWidth - 2}px`,
      'background-color': this.getStatusBgColor(order.data.status),
      border:             `1px solid ${this.getStatusBorderColor(order.data.status)}`,
    }
  }

  /** Returns the pixel offset from the grid's left edge to the centre of the
   *  current period column. Used to position the current-period indicator. */
  getCurrentPeriodOffset(): number {
    const now    = new Date()
    const today  = formatDateString(now)
    const dayPx  = this.getColumnIndex(today) * this.columnWidth
    const hourPx = this._activeTimescale === 'Hour' ? now.getHours() * this.columnWidth : 0
    return dayPx + hourPx + this.columnWidth / 2
  }

  getCurrentPeriodLabel(): string {
    const labels: Record<Timescale, string> = {
      Hour:  'Current hour',
      Day:   'Current day',
      Week:  'Current week',
      Month: 'Current month',
    }
    return labels[this._activeTimescale]
  }

  // -------------------------------------------------------------------------
  // Today button
  // -------------------------------------------------------------------------

  /** Scrolls so today is at the left edge of the viewport. If today is outside
   *  the loaded range (e.g. after navigating far away and switching timescales),
   *  reinitialises the range around today first using the same 80ms fade cycle
   *  as a normal timescale switch. */
  scrollToToday(): void {
    const today        = new Date()
    const todayInRange = today >= this.visibleStart && today <= this.visibleEnd

    if (!todayInRange) {
      this.isReady          = false
      this.isExtendingRange = true
      setTimeout(() => {
        this.initializeRange(today)
        this.changeDetector.detectChanges()
        this.scrollToDate(today, 'left')
        this.checkScrollEdgesAndExtendIfNeeded()
        this.isReady = true
      }, 80)
    } else {
      this.scrollToDate(today, 'left')
    }
  }

  // -------------------------------------------------------------------------
  // Order context menu
  // -------------------------------------------------------------------------

  /** Toggles the three-dot context menu for an order. Positions the menu
   *  relative to `.timeline-grid` so it renders outside the bar's stacking
   *  context, which would otherwise clip it regardless of z-index. */
  toggleOrderMenu(orderId: string, event: MouseEvent): void {
    event.stopPropagation()

    if (this.openMenuOrderId === orderId) {
      this.openMenuOrderId = null
      return
    }

    const button     = event.currentTarget as HTMLElement
    const grid       = this.rightColumn.nativeElement.querySelector('.timeline-grid') as HTMLElement
    const buttonRect = button.getBoundingClientRect()
    const gridRect   = grid.getBoundingClientRect()

    this.orderMenuTop    = buttonRect.bottom - gridRect.top  + 4
    this.orderMenuLeft   = buttonRect.left   - gridRect.left
    this.openMenuOrderId = orderId
  }

  onDeleteOrder(orderId: string, event: MouseEvent): void {
    event.stopPropagation()
    this.openMenuOrderId = null
    this.workOrders      = this.workOrders.filter(order => order.docId !== orderId)
    this.workOrdersChanged.emit(this.workOrders)
  }

  // -------------------------------------------------------------------------
  // Work order panel (create / edit)
  // -------------------------------------------------------------------------

  openCreatePanel(workCenterId: string, columnIndex: number): void {
    const columnDate = this.getDateAtPixel(columnIndex * this.columnWidth)
    const startDate  = new Date(columnDate.getFullYear(), columnDate.getMonth(), columnDate.getDate())
    const endDate    = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)

    this.panelInitialData = {
      workCenterId,
      startDate: formatDateString(startDate),
      endDate:   formatDateString(endDate),
    }
    this.panelMode  = 'create'
    this.hoverGhost = null
  }

  openEditPanel(order: WorkOrderDocument): void {
    this.panelInitialData = {
      docId:        order.docId,
      workCenterId: order.data.workCenterId,
      name:         order.data.name,
      status:       order.data.status,
      startDate:    order.data.startDate,
      endDate:      order.data.endDate,
    }
    this.panelMode       = 'edit'
    this.openMenuOrderId = null
  }

  onPanelSave(data: PanelWorkOrder): void {
    if (this.panelMode === 'create') {
      const newOrder: WorkOrderDocument = {
        docId:   crypto.randomUUID(),
        docType: 'workOrder',
        data: {
          name:         data.name,
          workCenterId: data.workCenterId,
          status:       data.status,
          startDate:    data.startDate,
          endDate:      data.endDate,
        },
      }
      this.workOrders = [...this.workOrders, newOrder]

    } else if (this.panelMode === 'edit' && data.docId) {
      this.workOrders = this.workOrders.map(order =>
        order.docId === data.docId
          ? { ...order, data: { ...order.data, name: data.name, status: data.status, startDate: data.startDate, endDate: data.endDate } }
          : order
      )
    }

    this.panelMode = null
    this.workOrdersChanged.emit(this.workOrders)
  }

  onPanelCancel(): void {
    this.panelMode = null
  }

  // -------------------------------------------------------------------------
  // Hover ghost
  // -------------------------------------------------------------------------

  onRowMousemove(event: MouseEvent, workCenterId: string): void {
    const scrollContainer = this.rightColumn.nativeElement
    const containerLeft   = scrollContainer.getBoundingClientRect().left
    const columnIndex     = Math.floor(
      (event.clientX - containerLeft + scrollContainer.scrollLeft) / this.columnWidth
    )

    // Skip if the cursor hasn't moved to a new column — avoids redundant
    // occupied-range checks and change-detection calls on every pixel of movement.
    if (columnIndex === this.lastHoveredColumnIndex) return
    this.lastHoveredColumnIndex = columnIndex

    const isColumnOccupied = this.getOrdersForWorkCenter(workCenterId).some(order => {
      const startColumn = this.getColumnIndex(order.data.startDate)
      const endColumn   = this.getColumnIndex(order.data.endDate)
      return columnIndex >= startColumn && columnIndex <= endColumn
    })

    this.hoverGhost = isColumnOccupied
      ? null
      : { left: columnIndex * this.columnWidth + 1, wcId: workCenterId }
  }

  onRowMouseleave(): void {
    this.hoverGhost             = null
    this.lastHoveredColumnIndex = -1
  }

  // -------------------------------------------------------------------------
  // Data lookup helpers
  // -------------------------------------------------------------------------

  getOrderById(docId: string): WorkOrderDocument {
    return this.workOrders.find(order => order.docId === docId)!
  }

  getOrdersForWorkCenter(workCenterId: string): WorkOrderDocument[] {
    return this._ordersByWorkCenter.get(workCenterId) ?? []
  }

  /** Rebuilds the `workCenterId → orders` lookup map. Called once per setter
   *  invocation rather than on every change-detection cycle. */
  private rebuildOrdersByWorkCenterMap(): void {
    this._ordersByWorkCenter = new Map()
    for (const order of this._workOrders) {
      const existing = this._ordersByWorkCenter.get(order.data.workCenterId) ?? []
      existing.push(order)
      this._ordersByWorkCenter.set(order.data.workCenterId, existing)
    }
  }

  // -------------------------------------------------------------------------
  // Status styling helpers
  // -------------------------------------------------------------------------

  getStatusBgColor(status: string):     string { return STATUS_BG_COLORS[status as WorkOrderStatus]     ?? '#F2FEFF' }
  getStatusBorderColor(status: string): string { return STATUS_BORDER_COLORS[status as WorkOrderStatus] ?? '#CEFBFF' }

  // -------------------------------------------------------------------------
  // Grid background
  // -------------------------------------------------------------------------

  /** Rebuilds the repeating-linear-gradient used for column borders and the
   *  alternating row background. Stored as a plain property rather than a
   *  getter so it is only reconstructed when columns actually change, not on
   *  every change-detection cycle. */
  private updateGridBackgroundStyle(): void {
    const borderColor     = 'rgba(230, 235, 240, 1)'
    const backgroundColor = 'rgba(247, 249, 252, 1)'
    const width           = this.columnWidth

    this.gridBackgroundStyle = {
      '--timeline-grid-bg':
        `repeating-linear-gradient(to right, `
        + `${backgroundColor} 0px, ${backgroundColor} ${width - 1}px, `
        + `${borderColor} ${width - 1}px, ${borderColor} ${width}px)`,
    }
  }

  // -------------------------------------------------------------------------
  // trackBy functions (minimise DOM mutations in *ngFor)
  // -------------------------------------------------------------------------

  trackByDate    = (_index: number, date: Date)               => date.getTime()
  trackByWcId    = (_index: number, wc: WorkCenterDocument)   => wc.docId
  trackByOrderId = (_index: number, order: WorkOrderDocument) => order.docId
  trackByIndex   = (index: number)                            => index

  // -------------------------------------------------------------------------
  // Date utilities
  // -------------------------------------------------------------------------

  /** Converts a `bufferDays` or `loadDays` value to pixels for the active
   *  timescale. See `WindowConfig` for why Month view uses a /30 divisor. */
  private daysToPixels(days: number): number {
    switch (this._activeTimescale) {
      case 'Hour':  return days * 24 * this.columnWidth
      case 'Month': return (days / 30) * this.columnWidth
      default:      return days * this.columnWidth
    }
  }

  /** Returns the Date corresponding to a horizontal pixel offset measured from
   *  the left edge of the grid (i.e. from `visibleStart`). */
  getDateAtPixel(pixelOffset: number): Date {
    const columnIndex = Math.floor(pixelOffset / this.columnWidth)

    switch (this._activeTimescale) {
      case 'Hour': {
        const result = new Date(this.visibleStart)
        result.setHours(result.getHours() + columnIndex)
        return result
      }
      case 'Day':
      case 'Week':
        return addDays(this.visibleStart, columnIndex)

      case 'Month': {
        const safeIndex = Math.min(columnIndex, 1200)
        return new Date(
          this.visibleStart.getFullYear(),
          this.visibleStart.getMonth() + safeIndex,
          1
        )
      }
    }
  }

  /** Scrolls the right column so `date` is at the left edge or centred,
   *  per `alignment`. In Hour view the hour component is included so the scroll
   *  lands on the actual hour rather than midnight. */
  private scrollToDate(date: Date, alignment: ScrollAlignment): void {
    const scrollContainer = this.rightColumn.nativeElement
    const dateStr         = formatDateString(date)
    let   targetPx        = this.getColumnIndex(dateStr) * this.columnWidth

    if (this._activeTimescale === 'Hour') {
      targetPx += date.getHours() * this.columnWidth
    }

    scrollContainer.scrollLeft = alignment === 'center'
      ? Math.max(0, targetPx - scrollContainer.clientWidth / 2)
      : Math.max(0, targetPx)
  }

}