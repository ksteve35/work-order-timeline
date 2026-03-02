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
  workCenters: WorkCenterDocument[] = []
  workOrders: WorkOrderDocument[] = []

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders = this.sampleData.getWorkOrders()
  }

  // Returns work orders for a specific work center
  getOrdersForWorkCenter(wcId: string): WorkOrderDocument[] {
    return this.workOrders.filter(order => order.data.workCenterId === wcId)
  }

  // Calculate bar left and width in pixels based on start/end date
  // For now, assume each day = 120px (matches timeline-cell width)
  getBarStyle(startDate: string, endDate: string) {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const daysSpan = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const columnWidth = 120
    const cellPadding = 16
    const borderWidth = 1

    const timelineStart = new Date('2026-01-14') // <-- match your sample data
    const diffDays = Math.floor((start.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24))

    const left = diffDays * columnWidth
    const width = daysSpan * columnWidth - cellPadding - borderWidth

    return { left, width }
  }

  // Map status to background color
  // Placeholder colors for now
  getStatusColor(status: string): string {
    switch (status) {
      case 'open': return '#007bff'        // Blue
      case 'in-progress': return '#6f42c1' // Purple
      case 'complete': return '#28a745'    // Green
      case 'blocked': return '#ffc107'     // Yellow
      default: return '#6c757d'            // Gray fallback
    }
  }
}
