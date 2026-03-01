import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { WORK_CENTERS } from './data/sample-data'
import { WorkCenterDocument } from './models/documents.model'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  workCenters: WorkCenterDocument[] = WORK_CENTERS

  headerDays: string[] = this.generateStaticDays()

  private generateStaticDays(): string[] {
    const days: string[] = []
    for (let i = 1; i <= 31; i++) {
      days.push(`Jan ${i}`)
    }
    return days
  }
}
