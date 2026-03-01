import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { WORK_CENTERS } from './data/sample-data'
import { WorkCenterDocument } from './models/documents.model'
import { SampleDataService } from './services/sample-data.service'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  workCenters: WorkCenterDocument[] = []

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()
  }

  // private generateStaticDays(): string[] {
  //   const days: string[] = []
  //   for (let i = 1; i <= 31; i++) {
  //     days.push(`Jan ${i}`)
  //   }
  //   return days
  // }
}
