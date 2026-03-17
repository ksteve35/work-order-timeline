import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

@Component({
  selector: 'app-timescale-selector',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './timescale-selector.component.html',
  styleUrls: ['./timescale-selector.component.scss']
})
export class TimescaleSelectorComponent {
  @Input()  selected: Timescale = 'Month'
  @Output() selectedChange = new EventEmitter<Timescale>()

  dropdownOpen = false

  options: { label: string; value: Timescale }[] = [
    { label: 'Hour',  value: 'Hour'  },
    { label: 'Day',   value: 'Day'   },
    { label: 'Week',  value: 'Week'  },
    { label: 'Month', value: 'Month' }
  ]

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen
  }

  selectOption(value: Timescale, event: MouseEvent): void {
    event.stopPropagation()
    this.dropdownOpen = false
    if (value !== this.selected) {
      this.selectedChange.emit(value)
    }
  }

  // Close dropdown when clicking outside the pill
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement
    if (!target.closest('.timescale-selector-both')) {
      this.dropdownOpen = false
    }
  }
}