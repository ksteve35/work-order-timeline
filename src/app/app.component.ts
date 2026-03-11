import {
  AfterViewInit, ChangeDetectorRef, Component,
  ElementRef, NgZone, OnInit, ViewChild
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgSelectModule } from '@ng-select/ng-select'
import { SampleDataService } from './services/sample-data.service'
import { WorkCenterDocument, WorkOrderDocument } from './models/documents.model'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

interface TimescaleOption { label: string; value: Timescale }
interface WeekGroup { label: string; days: Date[] }
interface WindowConfig { initialDays: number; loadDays: number; bufferDays: number }

const WINDOW_CONFIG: Record<Timescale, WindowConfig> = {
  Hour:  { initialDays: 3,   loadDays: 2,   bufferDays: 1 },
  Day:   { initialDays: 92,  loadDays: 28,  bufferDays: 20 },
  Week:  { initialDays: 112, loadDays: 84,  bufferDays: 35 },
  Month: { initialDays: 730, loadDays: 360, bufferDays: 120 }
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('rightColumn') rightColumn!: ElementRef<HTMLDivElement>

  columnWidth = 114
  visibleStart!: Date
  visibleEnd!: Date
  workCenters: WorkCenterDocument[] = []
  workOrders: WorkOrderDocument[] = []
  selectedTimescale: Timescale = 'Month'

  timescaleOptions: TimescaleOption[] = [
    { label: 'Hour',  value: 'Hour'  },
    { label: 'Day',   value: 'Day'   },
    { label: 'Week',  value: 'Week'  },
    { label: 'Month', value: 'Month' }
  ]

  // ── Public properties the template reads directly ──────────────────────────
  timelineColumns: Date[]  = []
  weekGroups: WeekGroup[]  = []
  totalColumns: number     = 0
  topHeaderLabel: string   = ''

  // ── Internal cache ─────────────────────────────────────────────────────────
  private _cachedDayColumns: Date[] = []

  // ── Scroll state ───────────────────────────────────────────────────────────
  private isLoadingMore        = false
  private scrollListenerActive = true
  private scrollTimeout:     ReturnType<typeof setTimeout> | null = null
  private scrollStopTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(
    private sampleData: SampleDataService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders  = this.sampleData.getWorkOrders()
    this.initializeRange(new Date())
  }

  ngAfterViewInit(): void {
    this.scrollToDate(new Date(), 'center')

    const el = this.rightColumn.nativeElement

    el.addEventListener('wheel', (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }, { passive: false })

    this.ngZone.runOutsideAngular(() => {
      el.addEventListener('scroll', () => this.onScroll())
    })
  }

  // ── Range init ─────────────────────────────────────────────────────────────

  initializeRange(centerDate: Date): void {
    const cfg = WINDOW_CONFIG[this.selectedTimescale]

    if (this.selectedTimescale === 'Month') {
      const half = Math.round(cfg.initialDays / 30 / 2)
      this.visibleStart = new Date(centerDate.getFullYear(), centerDate.getMonth() - half, 1)
      this.visibleEnd   = new Date(centerDate.getFullYear(), centerDate.getMonth() + half + 1, 0)
    } else {
      const half = Math.floor(cfg.initialDays / 2)
      this.visibleStart = this.addDays(this.startOfDay(centerDate), -half)
      this.visibleEnd   = this.addDays(this.startOfDay(centerDate),  half)
    }

    this.refreshColumnCache()
  }

  // ── Column cache ───────────────────────────────────────────────────────────

  private refreshColumnCache(): void {
    this._cachedDayColumns = this.buildDayColumns()

    let cols: Date[]
    switch (this.selectedTimescale) {
      case 'Hour':  cols = this.buildHourColumns();  break
      case 'Day':   cols = this._cachedDayColumns;   break
      case 'Week':  cols = this._cachedDayColumns;   break
      case 'Month': cols = this.buildMonthColumns(); break
    }

    this.timelineColumns = cols
    this.weekGroups      = this.buildWeekGroups(this._cachedDayColumns)
    this.totalColumns    = this.selectedTimescale === 'Week'
                           ? this._cachedDayColumns.length
                           : cols.length
    this.topHeaderLabel  = this.buildTopHeaderLabel()
  }

  private buildTopHeaderLabel(): string {
    if (!this.visibleStart || !this.visibleEnd) return ''
    const mid = new Date((this.visibleStart.getTime() + this.visibleEnd.getTime()) / 2)
    if (this.selectedTimescale === 'Hour') {
      return mid.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
    if (this.selectedTimescale === 'Day') {
      return mid.toLocaleString('default', { month: 'long', year: 'numeric' })
    }
    return ''
  }

  // ── Timescale change ───────────────────────────────────────────────────────

  onTimescaleChange(newTimescale: Timescale): void {
    const el         = this.rightColumn.nativeElement
    const anchorDate = this.getDateAtPixel(el.scrollLeft)

    this.scrollListenerActive = false
    this.isLoadingMore = true

    this.selectedTimescale = newTimescale
    this.initializeRange(anchorDate)

    setTimeout(() => {
      this.scrollToDate(anchorDate, 'left')
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.isLoadingMore = false
        this.scrollListenerActive = true
        this.ngZone.run(() => this.checkScrollEdges())
      }))
    }, 0)
  }

  // ── Infinite scroll ────────────────────────────────────────────────────────

  private onScroll(): void {
    if (this.isLoadingMore || !this.scrollListenerActive) return

    if (this.scrollTimeout) clearTimeout(this.scrollTimeout)
    this.scrollTimeout = setTimeout(() => {
      this.ngZone.run(() => this.checkScrollEdges())
    }, 150)
  }

  private checkScrollEdges(): void {
    if (this.isLoadingMore || !this.scrollListenerActive) return

    const el       = this.rightColumn.nativeElement
    const cfg      = WINDOW_CONFIG[this.selectedTimescale]
    const bufferPx = this.daysToPixels(cfg.bufferDays)

    if (el.scrollLeft < bufferPx) {
      this.isLoadingMore = true
      this.scrollListenerActive = false
      this.prependColumns(cfg.loadDays)
      return
    }
    if (el.scrollLeft + el.clientWidth > el.scrollWidth - bufferPx) {
      this.isLoadingMore = true
      this.scrollListenerActive = false
      this.appendColumns(cfg.loadDays)
    }
  }

  private prependColumns(days: number): void {
    const el      = this.rightColumn.nativeElement
    const addedPx = this.daysToPixels(days)

    if (this.selectedTimescale === 'Month') {
      const m = Math.round(days / 30)
      this.visibleStart = new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth() - m, 1)
    } else {
      this.visibleStart = this.addDays(this.visibleStart, -days)
    }

    this.refreshColumnCache()
    this.cdr.detectChanges()

    requestAnimationFrame(() => {
      el.scrollLeft += addedPx
      requestAnimationFrame(() => {
        this.scrollListenerActive = true
        this.isLoadingMore = false
        this.ngZone.run(() => this.checkScrollEdges())
        // Safety net: re-check after a short delay in case inertia
        // stopped during the lock and the rAF check came too early
        setTimeout(() => {
          if (!this.isLoadingMore && this.scrollListenerActive) {
            this.ngZone.run(() => this.checkScrollEdges())
          }
        }, 250)
      })
    })
  }

  private appendColumns(days: number): void {
    if (this.selectedTimescale === 'Month') {
      const m = Math.round(days / 30)
      this.visibleEnd = new Date(this.visibleEnd.getFullYear(), this.visibleEnd.getMonth() + m + 1, 0)
    } else {
      this.visibleEnd = this.addDays(this.visibleEnd, days)
    }

    this.refreshColumnCache()
    this.cdr.detectChanges()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.scrollListenerActive = true
        this.isLoadingMore = false
        this.ngZone.run(() => this.checkScrollEdges())
        // Safety net: same reasoning as prependColumns
        setTimeout(() => {
          if (!this.isLoadingMore && this.scrollListenerActive) {
            this.ngZone.run(() => this.checkScrollEdges())
          }
        }, 250)
      })
    })
  }

  // @upgrade - Timeline top row rendering issues for Day and Hour views
  private trimDistantColumns(): void {
    // if (this.isLoadingMore) return

    // const el          = this.rightColumn.nativeElement
    // const cfg         = WINDOW_CONFIG[this.selectedTimescale]
    // // Only trim if the off-screen content is at least 4x the load amount
    // const thresholdPx = this.daysToPixels(cfg.loadDays) * 4
    // let   didTrim     = false

    // const fromRight = el.scrollWidth - (el.scrollLeft + el.clientWidth)
    // if (fromRight > thresholdPx) {
    //   const td = cfg.loadDays
    //   if (this.selectedTimescale === 'Month') {
    //     const m = Math.round(td / 30)
    //     this.visibleEnd = new Date(this.visibleEnd.getFullYear(), this.visibleEnd.getMonth() - m + 1, 0)
    //   } else {
    //     this.visibleEnd = this.addDays(this.visibleEnd, -td)
    //   }
    //   didTrim = true
    // }

    // const fromLeft = el.scrollLeft
    // if (fromLeft > thresholdPx) {
    //   const td = cfg.loadDays
    //   if (this.selectedTimescale === 'Month') {
    //     const m = Math.round(td / 30)
    //     this.visibleStart = new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth() + m, 1)
    //   } else {
    //     this.visibleStart = this.addDays(this.visibleStart, td)
    //   }

    //   this.scrollListenerActive = false
    //   const trimPx = this.daysToPixels(td)
    //   didTrim = true
    //   this.refreshColumnCache()
    //   this.cdr.detectChanges()

    //   setTimeout(() => {
    //     el.scrollLeft -= trimPx
    //     requestAnimationFrame(() => requestAnimationFrame(() => {
    //       this.scrollListenerActive = true
    //     }))
    //   }, 0)
    //   return
    // }

    // if (didTrim) {
    //   this.refreshColumnCache()
    //   this.cdr.detectChanges()
    // }
  }

  // ── Column builders ────────────────────────────────────────────────────────

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

  private buildWeekGroups(days: Date[]): WeekGroup[] {
    const groups: WeekGroup[] = []
    let cur: WeekGroup | null = null
    for (const day of days) {
      if (!cur || day.getDay() === 1) {
        if (cur) groups.push(cur)
        const wn = this.isoWeek(day)
        // Use Thursday of this ISO week for correct month/year attribution
        const isoDay  = (day.getDay() + 6) % 7          // Mon=0, Tue=1, ... Sun=6
        const thursday = new Date(day)
        thursday.setDate(day.getDate() + (3 - isoDay))   // always lands on Thu of same ISO week
        cur = {
          label: `W${wn}, ${thursday.toLocaleString('default', { month: 'long' })}, ${thursday.getFullYear()}`,
          days: []
        }
      }
      cur.days.push(day)
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

  // ── Header label helpers ───────────────────────────────────────────────────

  getHourLabel(date: Date): string {
    const h = date.getHours()
    if (h === 0)  return '12 AM'
    if (h < 12)   return `${h} AM`
    if (h === 12) return '12 PM'
    return `${h - 12} PM`
  }

  getDayLabel(date: Date): string {
    return date.toLocaleString('default', { month: 'short', day: 'numeric' })
  }

  getMonthLabel(date: Date): string {
    return date.toLocaleString('default', { month: 'short', year: 'numeric' })
  }

  // ── Bar positioning ────────────────────────────────────────────────────────

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

  // ── Current period indicator ───────────────────────────────────────────────

  getCurrentPeriodOffset(): number {
    const t   = new Date()
    const str = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
    return this.getColumnIndex(str) * this.columnWidth + this.columnWidth / 2
  }

  getCurrentPeriodLabel(): string {
    const map: Record<Timescale, string> = {
      Hour: 'Current hour', Day: 'Current day', Week: 'Current week', Month: 'Current month'
    }
    return map[this.selectedTimescale]
  }

  // ── Data helpers ───────────────────────────────────────────────────────────

  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this.workOrders.filter(o => o.data.workCenterId === wcId)
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'open': 'Open', 'in-progress': 'In progress', 'complete': 'Complete', 'blocked': 'Blocked'
    }
    return map[status] ?? status
  }

  // ── Status style helpers ───────────────────────────────────────────────────

  getStatusBgColor(s: string): string {
    return ({ open: '#F2FEFF', 'in-progress': '#EDEEFF', complete: '#F8FFF3', blocked: '#FFFCF1' } as any)[s] ?? '#F2FEFF'
  }
  getStatusTextColor(s: string): string {
    return ({ open: 'rgba(0,176,191,1)', 'in-progress': 'rgba(62,64,219,1)', complete: 'rgba(8,162,104,1)', blocked: 'rgba(177,54,0,1)' } as any)[s] ?? 'rgba(0,176,191,1)'
  }
  getStatusBorderColor(s: string): string {
    return ({ open: '#CEFBFF', 'in-progress': '#DEE0FF', complete: '#D1FAB3', blocked: '#FFF5CF' } as any)[s] ?? '#CEFBFF'
  }
  getStatusBadgeColor(s: string): string {
    return ({ open: '#E4FDFF', 'in-progress': '#D6D8FF', complete: '#E1FFCC', blocked: '#FCEEB5' } as any)[s] ?? '#E4FDFF'
  }
  getStatusBadgeStyle(s: string): { [k: string]: string } {
    return { 'background-color': this.getStatusBadgeColor(s), color: this.getStatusTextColor(s) }
  }

  // ── trackBy helpers ────────────────────────────────────────────────────────

  trackByDate    = (_: number, d: Date)                => d.getTime()
  trackByWcId    = (_: number, wc: WorkCenterDocument) => wc.docId
  trackByOrderId = (_: number, o: WorkOrderDocument)   => o.docId
  trackByIndex   = (i: number)                         => i

  // ── Date utilities ─────────────────────────────────────────────────────────

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  private addDays(d: Date, n: number): Date {
    const r = new Date(d); r.setDate(r.getDate() + n); return r
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
        return this.addDays(this.startOfDay(this.visibleStart), Math.floor(px / this.columnWidth))
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