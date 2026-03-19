import { Component, EventEmitter, Input, NgZone, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgSelectModule } from '@ng-select/ng-select'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

@Component({
  selector: 'app-timescale-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './timescale-selector.component.html',
  styleUrls: ['./timescale-selector.component.scss']
})
export class TimescaleSelectorComponent {
  @Input()  selected: Timescale = 'Month'
  @Output() selectedChange = new EventEmitter<Timescale>()

  options: { label: string; value: Timescale }[] = [
    { label: 'Hour',  value: 'Hour'  },
    { label: 'Day',   value: 'Day'   },
    { label: 'Week',  value: 'Week'  },
    { label: 'Month', value: 'Month' }
  ]

  constructor(private ngZone: NgZone) {}

  onSelect(value: Timescale): void {
    if (value !== this.selected) {
      this.selected = value
      this.ngZone.run(() => this.selectedChange.emit(value))
    }
  }
}