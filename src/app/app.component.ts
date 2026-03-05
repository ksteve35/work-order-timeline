import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
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
  label: string  // e.g. "Week 31, September, 2024"
  days: Date[]
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('rightColumn') rightColumn!: ElementRef<HTMLDivElement>
  columnWidth: number = 114
  timelineStart: Date = new Date(2026, 0, 1) // Jan 1 2026 (0-based)
  timelineEnd: Date = new Date(2026, 11, 31) // Dec 31 2026 (0-based)
  workCenters: WorkCenterDocument[] = []
  workOrders: WorkOrderDocument[] = []
  selectedTimescale: Timescale = 'Month'
  timescaleOptions: TimescaleOption[] = [
    { label: 'Hour', value: 'Hour' },
    { label: 'Day', value: 'Day' },
    { label: 'Week', value: 'Week' },
    { label: 'Month', value: 'Month' }
  ]

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders = this.sampleData.getWorkOrders()
  }

  ngAfterViewInit(): void {
    // Scroll to today on load
    const el = this.rightColumn.nativeElement
    const offset = this.getCurrentPeriodOffset()
    el.scrollLeft = Math.max(0, offset - el.clientWidth / 2)

    // Convert vertical wheel to horizontal scroll
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
  }

  // --- Data helpers -----------------------------------------------------------

  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this.workOrders.filter(order => order.data.workCenterId === wcId)
  }

  // --- Timeline column helpers ------------------------------------------------

  /**
   * Returns the list of columns for the current timescale.
   * For Hour/Day/Month each entry is a Date representing that column.
   * For Week, use getWeekGroups() instead.
   */
  getTimelineColumns(): Date[] {
    switch (this.selectedTimescale) {
      case 'Hour': return this.getHourColumns()
      case 'Day':  return this.getDayColumns()
      case 'Month': return this.getMonthColumns()
      default: return this.getDayColumns()
    }
  }

  /** One column per hour across the full timeline range */
  private getHourColumns(): Date[] {
    const hours: Date[] = []
    const current = new Date(this.timelineStart)
    current.setHours(0, 0, 0, 0)
    const end = new Date(this.timelineEnd)
    end.setHours(23, 0, 0, 0)
    while (current <= end) {
      hours.push(new Date(current))
      current.setHours(current.getHours() + 1)
    }
    return hours
  }

  /** One column per day across the full timeline range */
  private getDayColumns(): Date[] {
    const days: Date[] = []
    const current = new Date(
      this.timelineStart.getFullYear(),
      this.timelineStart.getMonth(),
      this.timelineStart.getDate()
    )
    const end = new Date(
      this.timelineEnd.getFullYear(),
      this.timelineEnd.getMonth(),
      this.timelineEnd.getDate()
    )
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  /** One column per month across the full timeline range */
  private getMonthColumns(): Date[] {
    const months: Date[] = []
    const current = new Date(
      this.timelineStart.getFullYear(),
      this.timelineStart.getMonth(),
      1
    )
    const end = new Date(
      this.timelineEnd.getFullYear(),
      this.timelineEnd.getMonth(),
      1
    )
    while (current <= end) {
      months.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }

  /**
   * Returns week groups for the Week view two-row header.
   * Each group has a label and the array of days in that week.
   */
  getWeekGroups(): WeekGroup[] {
    const days = this.getDayColumns()
    const groups: WeekGroup[] = []
    let current: WeekGroup | null = null

    for (const day of days) {
      // ISO week: week starts on Monday
      const dayOfWeek = day.getDay()  // 0=Sun, 1=Mon...
      const isMonday = dayOfWeek === 1

      if (!current || isMonday) {
        if (current) groups.push(current)
        const weekNum = this.getISOWeekNumber(day)
        const monthName = day.toLocaleString('default', { month: 'long' })
        current = {
          label: `Week ${weekNum}, ${monthName}, ${day.getFullYear()}`,
          days: []
        }
      }
      current.days.push(day)
    }
    if (current) groups.push(current)
    return groups
  }

  /** Returns the ISO week number for a given date */
  private getISOWeekNumber(date: Date): number {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const week1 = new Date(d.getFullYear(), 0, 4)
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  }

  /** Total number of columns (used for timeline-grid width calculation) */
  getTotalColumns(): number {
    if (this.selectedTimescale === 'Week') {
      return this.getDayColumns().length
    }
    return this.getTimelineColumns().length
  }

  // --- Column header label helpers --------------------------------------------

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

  // --- Bar positioning --------------------------------------------------------

  /**
   * Returns the pixel offset of a given date from the start of the timeline.
   * Accounts for zoom level — each column represents a different time unit.
   */
  getColumnIndex(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    switch (this.selectedTimescale) {
      case 'Hour':
        // Each column is one hour; bars snap to day boundary
        return Math.floor((date.getTime() - this.timelineStart.getTime()) / (1000 * 60 * 60 * 24)) * 24

      case 'Day':
        return Math.floor((date.getTime() - new Date(
          this.timelineStart.getFullYear(),
          this.timelineStart.getMonth(),
          this.timelineStart.getDate()
        ).getTime()) / (1000 * 60 * 60 * 24))

      case 'Week':
        // Same as Day — columns are still individual days in week view
        return Math.floor((date.getTime() - new Date(
          this.timelineStart.getFullYear(),
          this.timelineStart.getMonth(),
          this.timelineStart.getDate()
        ).getTime()) / (1000 * 60 * 60 * 24))

      case 'Month': {
        // Each column is one month
        const startYear = this.timelineStart.getFullYear()
        const startMonth = this.timelineStart.getMonth()
        return (date.getFullYear() - startYear) * 12 + (date.getMonth() - startMonth)
      }
    }
  }

  getBarStyleObject(order: WorkOrderDocument): { [key: string]: string } {
    const startIdx = this.getColumnIndex(order.data.startDate)
    const endIdx = this.getColumnIndex(order.data.endDate) + 1  // +1 to include end column
    const leftPx = startIdx * this.columnWidth
    const widthPx = (endIdx - startIdx) * this.columnWidth

    return {
      'left': `${leftPx}px`,
      'width': `${widthPx}px`,
      'background-color': this.getStatusBgColor(order.data.status),
      'border': `1px solid ${this.getStatusBorderColor(order.data.status)}`
    }
  }

  // --- Current period indicator -----------------------------------------------

  /** Pixel offset of the current period indicator line */
  getCurrentPeriodOffset(): number {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const idx = this.getColumnIndex(todayStr)
    return idx * this.columnWidth + this.columnWidth / 2
  }

  /** Label shown on the current period indicator pill, varies by zoom level */
  getCurrentPeriodLabel(): string {
    switch (this.selectedTimescale) {
      case 'Hour':  return 'Current hour'
      case 'Day':   return 'Current day'
      case 'Week':  return 'Current week'
      case 'Month': return 'Current month'
    }
  }

  // --- Status label helpers ---------------------------------------------------

  /** Human-readable label for display (e.g. "In progress" instead of "in-progress") */
  getStatusLabel(status: string): string {
    switch (status) {
      case 'open': return 'Open'
      case 'in-progress': return 'In progress'
      case 'complete': return 'Complete'
      case 'blocked': return 'Blocked'
      default: return status
    }
  }

  // --- Style helpers ----------------------------------------------------------

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

  /** Styles for the status badge pill inside each bar - no border, just bg + text */
  getStatusBadgeStyle(status: string): { [key: string]: string } {
    return {
      'background-color': this.getStatusBadgeColor(status),
      'color': this.getStatusTextColor(status)
    }
  }
}