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
  @ViewChild('timelineBody') timelineBody!: ElementRef<HTMLDivElement>
  columnWidth: number = 114;
  timelineStart: Date = new Date(2026, 2, 10) // March 10, 2026 (0-based)
  timelineEnd: Date = new Date(2026, 11, 31) // December 31, 2026 (0-based)
  workCenters: WorkCenterDocument[] = []
  workOrders: WorkOrderDocument[] = []

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders = this.sampleData.getWorkOrders()
  }


  ngAfterViewInit(): void {
    const el = this.timelineBody.nativeElement
    el.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        // Only convert vertical wheel to horizontal scroll
        // Only hijack if horizontal scrolling is actually possible
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

  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this.workOrders.filter(order => order.data.workCenterId === wcId)
  }

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

  getDayIndex(dateStr: string): number {
    const d = new Date(dateStr)
    return Math.floor((d.getTime() - this.timelineStart.getTime()) / (1000 * 60 * 60 * 24))
  }

  getStatusColor(status: string): string {
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

  getStatusBorder(status: string): string {
    switch (status) {
      case 'open': return '#CEFBFF'
      case 'in-progress': return '#DEE0FF'
      case 'complete': return '#D1FAB3'
      case 'blocked': return '#FFF5CF'
      default: return '#CEFBFF'
    }
  }

  getBarStyleObject(order: WorkOrderDocument): { [key: string]: string } {
    const startIdx = this.getDayIndex(order.data.startDate) + 1
    const endIdx = this.getDayIndex(order.data.endDate) + 2

    return {
      'grid-column': `${startIdx} / ${endIdx}`,
      'background-color': this.getStatusColor(order.data.status),
      'color': this.getStatusTextColor(order.data.status),
      'border': `1px solid ${this.getStatusBorder(order.data.status)}`,
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'height': '24px',
      'border-radius': '4px',
      'font-size': '12px',
      'padding': '0 8px',
      'pointer-events': 'auto',
    }
  }
}