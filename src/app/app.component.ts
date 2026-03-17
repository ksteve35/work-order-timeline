import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SampleDataService } from './services/sample-data.service'
import { WorkCenterDocument, WorkOrderDocument } from './models/documents.model'
import { TimescaleSelectorComponent } from './components/timescale-selector/timescale-selector.component'
import { TimelineComponent } from './components/timeline/timeline.component'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

@Component({
  selector: 'app-root',
  imports: [CommonModule, TimescaleSelectorComponent, TimelineComponent],
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  selectedTimescale: Timescale = 'Month'
  workCenters: WorkCenterDocument[] = []
  workOrders:  WorkOrderDocument[]  = []

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
    this.workOrders  = this.sampleData.getWorkOrders()
  }

  onTimescaleSelected(ts: Timescale): void {
    this.selectedTimescale = ts
  }
}