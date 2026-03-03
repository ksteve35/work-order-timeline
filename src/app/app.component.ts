import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SampleDataService } from './services/sample-data.service'
import { WorkCenterDocument, WorkOrderDocument } from './models/documents.model'

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  timelineStart = new Date('2026-03-14')
  timelineEnd = new Date('2026-03-31')
  workCenters: WorkCenterDocument[] = []
  workOrders: WorkOrderDocument[] = []

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders = this.sampleData.getWorkOrders()
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