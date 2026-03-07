import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgSelectModule } from '@ng-select/ng-select'
import { SampleDataService } from './services/sample-data.service'
import { WorkCenterDocument, WorkOrderDocument } from './models/documents.model'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

interface TimescaleOption {
  label: string
  value: Timescale
}

interface WeekGroup {
  label: string
  days: Date[]
}

interface WindowConfig {
  initialDays: number
  loadDays: number
  bufferDays: number
}

const WINDOW_CONFIG: Record<Timescale, WindowConfig> = {
  Hour:  { initialDays: 6,   loadDays: 6,   bufferDays: 3 },
  Day:   { initialDays: 92,  loadDays: 28,  bufferDays: 20 },
  Week:  { initialDays: 112, loadDays: 84,  bufferDays: 35 },
  Month: { initialDays: 730, loadDays: 360, bufferDays: 120 }
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('rightColumn') rightColumn!: ElementRef<HTMLDivElement>

  columnWidth: number = 114
  visibleStart!: Date
  visibleEnd!: Date
  workCenters: WorkCenterDocument[] = []
  workOrders: WorkOrderDocument[] = []
  selectedTimescale: Timescale = 'Month'

  timescaleOptions: TimescaleOption[] = [
    { label: 'Hour',  value: 'Hour' },
    { label: 'Day',   value: 'Day' },
    { label: 'Week',  value: 'Week' },
    { label: 'Month', value: 'Month' }
  ]

  private _cachedColumns: Date[] = []
  private _cachedWeekGroups: WeekGroup[] = []
  private _cachedTotalColumns: number = 0
  private _cachedDayColumns: Date[] = []

  private isLoadingMore = false
  private scrollListenerActive = true
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null
  private scrollStopTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(
    private sampleData: SampleDataService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders = this.sampleData.getWorkOrders()
    this.initializeRange(new Date())
  }

  ngAfterViewInit(): void {
    this.scrollToDate(new Date(), 'center')

    const el = this.rightColumn.nativeElement

    el.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          if (el.scrollWidth > el.clientWidth) {
            event.preventDefault()
            el.scrollLeft += event.deltaY
          }
        }
      },
      { passive: false }
    )

    this.ngZone.runOutsideAngular(() => {
      el.addEventListener('scroll', () => this.onScroll())
    })
  }

  // --- Range initialization --------------------------------------------------

  initializeRange(centerDate: Date): void {
    const config = WINDOW_CONFIG[this.selectedTimescale]

    if (this.selectedTimescale === 'Month') {
      const halfMonths = Math.round(config.initialDays / 30 / 2)
      this.visibleStart = new Date(
        centerDate.getFullYear(),
        centerDate.getMonth() - halfMonths,
        1
      )
      this.visibleEnd = new Date(
        centerDate.getFullYear(),
        centerDate.getMonth() + halfMonths + 1,
        0
      )
    } else {
      const half = Math.floor(config.initialDays / 2)
      this.visibleStart = this.addDays(this.startOfDay(centerDate), -half)
      this.visibleEnd = this.addDays(this.startOfDay(centerDate), half)
    }

    this.refreshColumnCache()
  }

  // --- Column cache ----------------------------------------------------------

  private refreshColumnCache(): void {
    this._cachedDayColumns = this.buildDayColumns()

    switch (this.selectedTimescale) {
      case 'Hour':
        this._cachedColumns = this.buildHourColumns()
        break
      case 'Day':
        this._cachedColumns = this._cachedDayColumns
        break
      case 'Week':
        this._cachedColumns = this._cachedDayColumns
        break
      case 'Month':
        this._cachedColumns = this.buildMonthColumns()
        break
    }

    this._cachedWeekGroups = this.buildWeekGroups(this._cachedDayColumns)
    this._cachedTotalColumns = this.selectedTimescale === 'Week'
      ? this._cachedDayColumns.length
      : this._cachedColumns.length
  }

  // --- Column accessors ------------------------------------------------------

  getTimelineColumns(): Date[] {
    return this._cachedColumns
  }

  getWeekGroups(): WeekGroup[] {
    return this._cachedWeekGroups
  }

  getTotalColumns(): number {
    return this._cachedTotalColumns
  }

  // --- Timescale change -------------------------------------------------------

  onTimescaleChange(): void {
    const el = this.rightColumn.nativeElement
    const anchorDate = this.getDateAtPixel(el.scrollLeft)

    this.initializeRange(anchorDate)
    this.cdr.detectChanges()

    setTimeout(() => this.scrollToDate(anchorDate, 'left'), 0)
  }

  // --- Infinite scroll -------------------------------------------------------

  private onScroll(): void {
    if (this.isLoadingMore || !this.scrollListenerActive) return

    if (this.scrollTimeout) clearTimeout(this.scrollTimeout)
    this.scrollTimeout = setTimeout(() => this.checkScrollEdges(), 150)

    if (this.scrollStopTimeout) clearTimeout(this.scrollStopTimeout)
    this.scrollStopTimeout = setTimeout(() => this.trimDistantColumns(), 1000)
  }

  private checkScrollEdges(): void {
    if (this.isLoadingMore || !this.scrollListenerActive) return

    const el = this.rightColumn.nativeElement
    const config = WINDOW_CONFIG[this.selectedTimescale]
    const bufferPx = this.daysToPixels(config.bufferDays)

    if (el.scrollLeft < bufferPx) {
      this.isLoadingMore = true
      this.prependColumns(config.loadDays)
      return
    }

    if (el.scrollLeft + el.clientWidth > el.scrollWidth - bufferPx) {
      this.isLoadingMore = true
      this.appendColumns(config.loadDays)
    }
  }

  private trimDistantColumns(): void {
    if (this.isLoadingMore) return

    const el = this.rightColumn.nativeElement
    const config = WINDOW_CONFIG[this.selectedTimescale]
    const trimThresholdPx = this.daysToPixels(config.loadDays) * 3
    let didTrim = false

    const distanceFromRight = el.scrollWidth - (el.scrollLeft + el.clientWidth)
    if (distanceFromRight > trimThresholdPx) {
      const trimDays = config.loadDays
      if (this.selectedTimescale === 'Month') {
        const months = Math.round(trimDays / 30)
        this.visibleEnd = new Date(
          this.visibleEnd.getFullYear(),
          this.visibleEnd.getMonth() - months + 1,
          0
        )
      } else {
        this.visibleEnd = this.addDays(this.visibleEnd, -trimDays)
      }
      didTrim = true
    }

    const distanceFromLeft = el.scrollLeft
    if (distanceFromLeft > trimThresholdPx) {
      const trimDays = config.loadDays
      if (this.selectedTimescale === 'Month') {
        const months = Math.round(trimDays / 30)
        this.visibleStart = new Date(
          this.visibleStart.getFullYear(),
          this.visibleStart.getMonth() + months,
          1
        )
      } else {
        this.visibleStart = this.addDays(this.visibleStart, trimDays)
      }

      this.scrollListenerActive = false
      const trimPx = this.daysToPixels(trimDays)
      didTrim = true
      this.refreshColumnCache()

      setTimeout(() => {
        this.ngZone.run(() => {
          this.cdr.detectChanges()
          el.scrollLeft -= trimPx
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.scrollListenerActive = true
            })
          })
        })
      }, 0)
      return
    }

    if (didTrim) {
      this.refreshColumnCache()
      setTimeout(() => {
        this.ngZone.run(() => this.cdr.detectChanges())
      }, 0)
    }
  }

  private prependColumns(days: number): void {
    const el = this.rightColumn.nativeElement
    const addedPx = this.daysToPixels(days)

    if (this.selectedTimescale === 'Month') {
      const months = Math.round(days / 30)
      this.visibleStart = new Date(
        this.visibleStart.getFullYear(),
        this.visibleStart.getMonth() - months,
        1
      )
    } else {
      this.visibleStart = this.addDays(this.visibleStart, -days)
    }

    this.scrollListenerActive = false
    this.refreshColumnCache()

    setTimeout(() => {
      this.ngZone.run(() => {
        this.cdr.detectChanges()
        el.scrollLeft += addedPx
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.scrollListenerActive = true
            this.isLoadingMore = false
          })
        })
      })
    }, 0)
  }

  private appendColumns(days: number): void {
    if (this.selectedTimescale === 'Month') {
      const months = Math.round(days / 30)
      this.visibleEnd = new Date(
        this.visibleEnd.getFullYear(),
        this.visibleEnd.getMonth() + months + 1,
        0
      )
    } else {
      this.visibleEnd = this.addDays(this.visibleEnd, days)
    }

    this.refreshColumnCache()

    setTimeout(() => {
      this.ngZone.run(() => {
        this.cdr.detectChanges()
        this.isLoadingMore = false
      })
    }, 0)
  }

  // --- Column builders -------------------------------------------------------

  private buildHourColumns(): Date[] {
    const hours: Date[] = []
    const current = new Date(this.visibleStart)
    current.setHours(0, 0, 0, 0)
    const end = new Date(this.visibleEnd)
    end.setHours(23, 0, 0, 0)
    while (current <= end) {
      hours.push(new Date(current))
      current.setHours(current.getHours() + 1)
    }
    return hours
  }

  private buildDayColumns(): Date[] {
    const days: Date[] = []
    const current = this.startOfDay(this.visibleStart)
    const end = this.startOfDay(this.visibleEnd)
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  private buildMonthColumns(): Date[] {
    const months: Date[] = []
    const current = new Date(this.visibleStart.getFullYear(), this.visibleStart.getMonth(), 1)
    const end = new Date(this.visibleEnd.getFullYear(), this.visibleEnd.getMonth(), 1)
    while (current <= end) {
      months.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }

  private buildWeekGroups(days: Date[]): WeekGroup[] {
    const groups: WeekGroup[] = []
    let current: WeekGroup | null = null

    for (const day of days) {
      const isMonday = day.getDay() === 1
      if (!current || isMonday) {
        if (current) groups.push(current)
        const weekNum = this.getISOWeekNumber(day)
        const monthName = day.toLocaleString('default', { month: 'long' })
        current = { label: `Week ${weekNum}, ${monthName}, ${day.getFullYear()}`, days: [] }
      }
      current.days.push(day)
    }
    if (current) groups.push(current)
    return groups
  }

  private getISOWeekNumber(date: Date): number {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const week1 = new Date(d.getFullYear(), 0, 4)
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  }

  // --- Column header labels --------------------------------------------------

  getTopHeaderLabel(): string {
    if (!this.visibleStart || !this.visibleEnd) return ''
    const midMs = (this.visibleStart.getTime() + this.visibleEnd.getTime()) / 2
    const center = new Date(midMs)
    if (this.selectedTimescale === 'Hour') {
      return center.toLocaleString('default', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      })
    }
    if (this.selectedTimescale === 'Day') {
      return center.toLocaleString('default', { month: 'long', year: 'numeric' })
    }
    return ''
  }

  getHourLabel(date: Date): string {
    const h = date.getHours()
    if (h === 0) return '12 AM'
    if (h < 12) return `${h} AM`
    if (h === 12) return '12 PM'
    return `${h - 12} PM`
  }

  getDayLabel(date: Date): string {
    return date.toLocaleString('default', { month: 'short', day: 'numeric' })
  }

  getMonthLabel(date: Date): string {
    return date.toLocaleString('default', { month: 'short', year: 'numeric' })
  }

  // --- Bar positioning -------------------------------------------------------

  getColumnIndex(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    switch (this.selectedTimescale) {
      case 'Hour':
        return this.daysBetween(this.visibleStart, date) * 24
      case 'Day':
      case 'Week':
        return this.daysBetween(this.visibleStart, date)
      case 'Month': {
        const startYear = this.visibleStart.getFullYear()
        const startMonth = this.visibleStart.getMonth()
        return (date.getFullYear() - startYear) * 12 + (date.getMonth() - startMonth)
      }
    }
  }

  getBarStyleObject(order: WorkOrderDocument): { [key: string]: string } {
    const startIdx = this.getColumnIndex(order.data.startDate)
    const endIdx = this.getColumnIndex(order.data.endDate) + 1
    const leftPx = startIdx * this.columnWidth
    const widthPx = (endIdx - startIdx) * this.columnWidth

    return {
      'left': `${leftPx}px`,
      'width': `${widthPx}px`,
      'background-color': this.getStatusBgColor(order.data.status),
      'border': `1px solid ${this.getStatusBorderColor(order.data.status)}`
    }
  }

  // --- Current period indicator ----------------------------------------------

  getCurrentPeriodOffset(): number {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const idx = this.getColumnIndex(todayStr)
    return idx * this.columnWidth + this.columnWidth / 2
  }

  getCurrentPeriodLabel(): string {
    switch (this.selectedTimescale) {
      case 'Hour':  return 'Current hour'
      case 'Day':   return 'Current day'
      case 'Week':  return 'Current week'
      case 'Month': return 'Current month'
    }
  }

  // --- Data helpers ----------------------------------------------------------

  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this.workOrders.filter(order => order.data.workCenterId === wcId)
  }

  // --- Status label helpers --------------------------------------------------

  getStatusLabel(status: string): string {
    switch (status) {
      case 'open': return 'Open'
      case 'in-progress': return 'In progress'
      case 'complete': return 'Complete'
      case 'blocked': return 'Blocked'
      default: return status
    }
  }

  // --- Style helpers ---------------------------------------------------------

  getStatusBgColor(status: string): string {
    switch (status) {
      case 'open': return '#F2FEFF'
      case 'in-progress': return '#EDEEFF'
      case 'complete': return '#F8FFF3'
      case 'blocked': return '#FFFCF1'
      default: return '#F2FEFF'
    }
  }

  getStatusTextColor(status: string): string {
    switch (status) {
      case 'open': return 'rgba(0, 176, 191, 1)'
      case 'in-progress': return 'rgba(62, 64, 219, 1)'
      case 'complete': return 'rgba(8, 162, 104, 1)'
      case 'blocked': return 'rgba(177, 54, 0, 1)'
      default: return 'rgba(0, 176, 191, 1)'
    }
  }

  getStatusBorderColor(status: string): string {
    switch (status) {
      case 'open': return '#CEFBFF'
      case 'in-progress': return '#DEE0FF'
      case 'complete': return '#D1FAB3'
      case 'blocked': return '#FFF5CF'
      default: return '#CEFBFF'
    }
  }

  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'open': return '#E4FDFF'
      case 'in-progress': return '#D6D8FF'
      case 'complete': return '#E1FFCC'
      case 'blocked': return '#FCEEB5'
      default: return '#E4FDFF'
    }
  }

  getStatusBadgeStyle(status: string): { [key: string]: string } {
    return {
      'background-color': this.getStatusBadgeColor(status),
      'color': this.getStatusTextColor(status)
    }
  }

  // --- Date utility helpers --------------------------------------------------

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  private daysBetween(from: Date, to: Date): number {
    const fromMs = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
    const toMs = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
    return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24))
  }

  private daysToPixels(days: number): number {
    switch (this.selectedTimescale) {
      case 'Hour':  return days * 24 * this.columnWidth
      case 'Day':   return days * this.columnWidth
      case 'Week':  return days * this.columnWidth
      case 'Month': return (days / 30) * this.columnWidth
    }
  }

  private getDateAtPixel(px: number): Date {
    switch (this.selectedTimescale) {
      case 'Hour': {
        const hours = Math.floor(px / this.columnWidth)
        const result = new Date(this.visibleStart)
        result.setHours(result.getHours() + hours)
        return result
      }
      case 'Day':
      case 'Week': {
        const days = Math.floor(px / this.columnWidth)
        return this.addDays(this.startOfDay(this.visibleStart), days)
      }
      case 'Month': {
        const rawMonths = Math.floor(px / this.columnWidth)
        const clampedMonths = Math.min(rawMonths, 1200)
        return new Date(
          this.visibleStart.getFullYear(),
          this.visibleStart.getMonth() + clampedMonths,
          1
        )
      }
    }
  }

  private scrollToDate(date: Date, align: 'left' | 'center'): void {
    const el = this.rightColumn.nativeElement
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const idx = this.getColumnIndex(dateStr)
    const px = idx * this.columnWidth
    el.scrollLeft = align === 'center' ? Math.max(0, px - el.clientWidth / 2) : Math.max(0, px)
  }
}