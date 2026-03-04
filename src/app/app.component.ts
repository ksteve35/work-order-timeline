import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SampleDataService } from './services/sample-data.service'
import { WorkCenterDocument, WorkOrderDocument } from './models/documents.model'

@Component({
  selector: 'app-root',
  imports: [CommonModule],
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

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders = this.sampleData.getWorkOrders()
  }

  ngAfterViewInit(): void {
    // Scroll to today on load
    const el = this.rightColumn.nativeElement
    const todayOffset = this.getCurrentDayOffset()
    const center = todayOffset - el.clientWidth / 2
    el.scrollLeft = Math.max(0, center)

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

  // --- Timeline date helpers --------------------------------------------------

  /** Returns an array of every Date between timelineStart and timelineEnd */
  getTimelineDays(): Date[] {
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

  /**
   * Returns how many days a given ISO date string is from timelineStart.
   * Used to calculate pixel offsets for bars.
   */
  getDayIndex(dateStr: string): number {
    // Parse as local date to avoid UTC timezone shifting the day
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    const start = new Date(
      this.timelineStart.getFullYear(),
      this.timelineStart.getMonth(),
      this.timelineStart.getDate()
    )
    return Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }

  /** Pixel offset of today's date (used for the current-day indicator line) */
  getCurrentDayOffset(): number {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const idx = this.getDayIndex(todayStr)
    // Center the line within today's column
    return idx * this.columnWidth + this.columnWidth / 2
  }

  // --- Style helpers ----------------------------------------------------------

  getStatusBgColor(status: string): string {
    switch (status) {
      case 'open': return '#E4FDFF'
      case 'in-progress': return '#EDEEFF'
      case 'complete': return '#F8FFF3'
      case 'blocked': return '#FFFCF1'
      default: return '#E4FDFF'
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

  /**
   * Returns inline styles for a work order bar.
   * Bars are position:absolute inside a position:relative row,
   * so we calculate left/width in pixels from day indices.
   */
  getBarStyleObject(order: WorkOrderDocument): { [key: string]: string } {
    const startIdx = this.getDayIndex(order.data.startDate)
    const endIdx   = this.getDayIndex(order.data.endDate) + 1  // +1 to include end day
    const leftPx  = startIdx * this.columnWidth
    const widthPx = (endIdx - startIdx) * this.columnWidth

    return {
      'left': `${leftPx}px`,
      'width': `${widthPx}px`,
      'background-color': this.getStatusBgColor(order.data.status),
      'color': this.getStatusTextColor(order.data.status),
      'border': `1px solid ${this.getStatusBorderColor(order.data.status)}`,
    }
  }

  /** Styles for the status badge pill inside each bar */
  getStatusBadgeStyle(status: string): { [key: string]: string } {
    return {
      'background-color': this.getStatusBgColor(status),
      'color': this.getStatusTextColor(status),
      'border': `1px solid ${this.getStatusBorderColor(status)}`,
    }
  }
}