import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core'
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
  @ViewChild('timelineCell') timelineCell!: ElementRef<HTMLDivElement>
  columnWidth: number = 120
  timelineStart = new Date('2026-03-14')
  timelineEnd = new Date('2026-03-31')
  workCenters: WorkCenterDocument[] = []
  workOrders: WorkOrderDocument[] = []

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders = this.sampleData.getWorkOrders()
  }

  ngAfterViewInit(): void {
    this.columnWidth = this.timelineCell.nativeElement.getBoundingClientRect().width
  }

  @HostListener('window:resize')
  onResize() {
    if (this.timelineCell) {
      this.columnWidth =
        this.timelineCell.nativeElement.getBoundingClientRect().width
    }
  }

  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this.workOrders.filter(order => order.data.workCenterId === wcId)
  }

  getTimelineDays(): number[] {
    const days: number[] = []
    let d = new Date(this.timelineStart)
    while (d <= this.timelineEnd) {
      days.push(d.getDate())
      d.setDate(d.getDate() + 1)
    }
    return days
  }

  getDayIndex(dateStr: string): number {
    const d = new Date(dateStr)
    return Math.floor((d.getTime() - this.timelineStart.getTime()) / (1000 * 60 * 60 * 24))
  }

  getBarStyle(orderStart: string, orderEnd: string) {
    const startIdx = this.getDayIndex(orderStart)
    const endIdx = this.getDayIndex(orderEnd)
    //const columnWidth = 120
    const totalColumns = endIdx - startIdx + 1
    const left = startIdx * this.columnWidth
    const width = totalColumns * this.columnWidth - 1
    return { left, width }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'open': return '#007bff'
      case 'in-progress': return '#6f42c1'
      case 'complete': return '#28a745'
      case 'blocked': return '#ffc107'
      default: return '#6c757d'
    }
  }
}