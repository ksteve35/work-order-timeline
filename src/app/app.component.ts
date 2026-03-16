import {
  AfterViewInit, ChangeDetectorRef, Component,
  ElementRef, OnInit, ViewChild
} from '@angular/core'

import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { SampleDataService } from './services/sample-data.service'
import { WorkCenterDocument, WorkOrderDocument } from './models/documents.model'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

interface WeekGroup  { label: string; days:  Date[] }
interface MonthGroup { label: string; days:  Date[] }
interface DayGroup   { label: string; hours: Date[] }
interface WindowConfig { initialDays: number; loadDays: number; bufferDays: number }

const WINDOW_CONFIG: Record<Timescale, WindowConfig> = {
  Hour:  { initialDays: 3,   loadDays: 2,   bufferDays: 3   },
  Day:   { initialDays: 92,  loadDays: 14,  bufferDays: 21  },
  Week:  { initialDays: 112, loadDays: 28,  bufferDays: 42  },
  Month: { initialDays: 730, loadDays: 90,  bufferDays: 120 }
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('rightColumn') rightColumn!: ElementRef<HTMLDivElement>

  columnWidth = 114
  visibleStart!: Date
  visibleEnd!: Date
  workCenters: WorkCenterDocument[] = []
  workOrders:  WorkOrderDocument[]  = []
  selectedTimescale: Timescale = 'Month'

  timelineColumns: Date[]   = []
  weekGroups:  WeekGroup[]  = []
  monthGroups: MonthGroup[] = []
  dayGroups:   DayGroup[]   = []
  totalColumns: number      = 0

  private _cachedDayColumns: Date[] = []
  private isLoadingMore = false

  constructor(private sampleData: SampleDataService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders  = this.sampleData.getWorkOrders()
    this.initializeRange(new Date())
  }

  ngAfterViewInit(): void {
    this.scrollToDate(new Date(), 'center')

    const el = this.rightColumn.nativeElement

    // Convert pure mouse-wheel vertical scroll to horizontal.
    // Trackpads always have non-zero deltaX when swiping horizontally,
    // so they scroll natively and are unaffected.
    el.addEventListener('wheel', (e: WheelEvent) => {
      if (e.deltaX === 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }, { passive: false })

    // Scroll listener runs inside Angular zone (no runOutsideAngular).
    // This means Angular's CD runs on every scroll event, which is fine
    // for an assessment. The isLoadingMore guard keeps prepend/append
    // from stacking up.
    el.addEventListener('scroll', () => this.onScroll())
  }

  // ---------------------------------------------------------------------------
  // Timescale change — plain <select> fires inside Angular zone, no CD tricks
  // ---------------------------------------------------------------------------

  onTimescaleChange(newTimescale: Timescale): void {
    const anchorDate = this.getDateAtPixel(this.rightColumn.nativeElement.scrollLeft)
    this.selectedTimescale = newTimescale
    this.isLoadingMore = true
    this.initializeRange(anchorDate)
    // Commit the new column count to the DOM before scrollToDate so the
    // browser doesn't silently cap el.scrollLeft at the old scrollWidth.
    // Then check edges using totalColumns (in memory) not el.scrollWidth (DOM).
    setTimeout(() => {
      this.cdr.detectChanges()
      this.scrollToDate(anchorDate, 'left')
      this.isLoadingMore = false
      this.checkScrollEdges()
    }, 0)
  }

  // ---------------------------------------------------------------------------
  // Range init
  // ---------------------------------------------------------------------------

  initializeRange(centerDate: Date): void {
    const cfg    = WINDOW_CONFIG[this.selectedTimescale]
    const center = this.startOfDay(centerDate)

    if (this.selectedTimescale === 'Month') {
      const half    = Math.round(cfg.initialDays / 30 / 2)
      this.visibleStart = new Date(center.getFullYear(), center.getMonth() - half, 1)
      this.visibleEnd   = new Date(center.getFullYear(), center.getMonth() + half + 1, 0)
    } else {
      const half    = Math.floor(cfg.initialDays / 2)
      this.visibleStart = this.addDays(center, -half)
      this.visibleEnd   = this.addDays(center,  half)
    }

    this.refreshColumnCache()
  }

  private refreshColumnCache(): void {
    this._cachedDayColumns = this.buildDayColumns()
    const hourCols = this.buildHourColumns()

    let cols: Date[]
    switch (this.selectedTimescale) {
      case 'Hour':  cols = hourCols;                 break
      case 'Day':   cols = this._cachedDayColumns;   break
      case 'Week':  cols = this._cachedDayColumns;   break
      case 'Month': cols = this.buildMonthColumns(); break
    }

    this.timelineColumns = cols
    this.weekGroups      = this.buildWeekGroups(this._cachedDayColumns)
    this.monthGroups     = this.buildMonthGroups(this._cachedDayColumns)
    this.dayGroups       = this.buildDayGroups(hourCols)
    this.totalColumns    = this.selectedTimescale === 'Week'
                           ? this._cachedDayColumns.length
                           : cols.length
  }

  // ---------------------------------------------------------------------------
  // Scroll edge detection — called directly from the scroll event (in zone)
  // ---------------------------------------------------------------------------

  private onScroll(): void {
    if (this.isLoadingMore) return
    this.checkScrollEdges()
  }

  private checkScrollEdges(): void {
    if (this.isLoadingMore) return

    const el      = this.rightColumn.nativeElement
    const cfg     = WINDOW_CONFIG[this.selectedTimescale]
    const bufPx   = this.daysToPixels(cfg.bufferDays)
    // Use totalColumns * columnWidth (in-memory, always current) instead of
    // el.scrollWidth. Setting el.scrollLeft fires a synchronous scroll event
    // so checkScrollEdges can run before Angular commits the DOM update,
    // making el.scrollWidth stale and causing false "not at edge" readings.
    const totalPx = this.totalColumns * this.columnWidth

    if (el.scrollLeft < bufPx) {
      this.isLoadingMore = true
      this.prependColumns(cfg.loadDays)
      return
    }

    if (el.scrollLeft + el.clientWidth > totalPx - bufPx) {
      this.isLoadingMore = true
      this.appendColumns(cfg.loadDays)
    }
  }

  private prependColumns(days: number): void {
    const anchorDate = this.getDateAtPixel(this.rightColumn.nativeElement.scrollLeft)

    if (this.selectedTimescale === 'Month') {
      const m = Math.round(days / 30)
      this.visibleStart = new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth() - m, 1)
    } else {
      this.visibleStart = this.addDays(this.visibleStart, -days)
    }

    this.refreshColumnCache()

    // detectChanges before scrollToDate: the prepend widens the grid leftward,
    // so the anchor's new pixel position is larger. If the DOM hasn't updated,
    // the browser caps el.scrollLeft at the old (narrower) scrollWidth.
    this.cdr.detectChanges()

    setTimeout(() => {
      this.scrollToDate(anchorDate, 'left')
      this.isLoadingMore = false
      this.checkScrollEdges()
    }, 0)
  }

  private appendColumns(days: number): void {
    if (this.selectedTimescale === 'Month') {
      const m = Math.round(days / 30)
      this.visibleEnd = new Date(this.visibleEnd.getFullYear(), this.visibleEnd.getMonth() + m + 1, 0)
    } else {
      this.visibleEnd = this.addDays(this.visibleEnd, days)
    }

    this.refreshColumnCache()

    setTimeout(() => {
      this.isLoadingMore = false
      this.checkScrollEdges()
    }, 0)
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

  // ---------------------------------------------------------------------------
  // Bar positioning
  // ---------------------------------------------------------------------------

  getColumnIndex(dateStr: string): number {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const date = new Date(y, mo - 1, d)
    switch (this.selectedTimescale) {
      case 'Hour':  return this.daysBetween(this.visibleStart, date) * 24
      case 'Day':
      case 'Week':  return this.daysBetween(this.visibleStart, date)
      case 'Month': {
        const sy = this.visibleStart.getFullYear(), sm = this.visibleStart.getMonth()
        return (date.getFullYear() - sy) * 12 + (date.getMonth() - sm)
      }
    }
  }

  getBarStyleObject(order: WorkOrderDocument): { [k: string]: string } {
    const s = this.getColumnIndex(order.data.startDate)
    const e = this.getColumnIndex(order.data.endDate) + 1
    return {
      left:               `${s * this.columnWidth}px`,
      width:              `${(e - s) * this.columnWidth}px`,
      'background-color': this.getStatusBgColor(order.data.status),
      border:             `1px solid ${this.getStatusBorderColor(order.data.status)}`
    }
  }

  getCurrentPeriodOffset(): number {
    const t   = new Date()
    const str = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
    return this.getColumnIndex(str) * this.columnWidth + this.columnWidth / 2
  }

  getCurrentPeriodLabel(): string {
    return { Hour: 'Current hour', Day: 'Current day', Week: 'Current week', Month: 'Current month' }[this.selectedTimescale]
  }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this.workOrders.filter(o => o.data.workCenterId === wcId)
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
    switch (this.selectedTimescale) {
      case 'Hour':  return days * 24 * this.columnWidth
      case 'Month': return (days / 30) * this.columnWidth
      default:      return days * this.columnWidth
    }
  }

  private getDateAtPixel(px: number): Date {
    switch (this.selectedTimescale) {
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

  private scrollToDate(date: Date, align: 'left' | 'center'): void {
    const el  = this.rightColumn.nativeElement
    const str = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    const px  = this.getColumnIndex(str) * this.columnWidth
    el.scrollLeft = align === 'center' ? Math.max(0, px - el.clientWidth / 2) : Math.max(0, px)
  }
}