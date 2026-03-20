import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { WorkOrderDocument, WorkOrderStatus } from '../../models/documents.model'
import { STATUS_TEXT_COLORS, STATUS_BADGE_COLORS, STATUS_LABELS } from '../../constants/work-order-status.constants'

/**
 * Renders a single work order as a positioned bar within a timeline row.
 *
 * The parent timeline component is responsible for computing `barStyle`
 * (left offset and width) since it owns the column-width and visible-range
 * state. This component handles only the visual presentation — label, status
 * badge, and the three-dot menu trigger — keeping the template lean and the
 * bar logic reusable outside of the timeline context.
 *
 * Emits:
 *  - `menuButtonClicked` when the ⋯ button is clicked, passing the raw
 *    MouseEvent so the parent can position the context menu relative to the
 *    grid element.
 */
@Component({
  selector: 'app-work-order-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './work-order-bar.component.html',
  styleUrls: ['./work-order-bar.component.scss'],
})
export class WorkOrderBarComponent {
  @Input()  order!:    WorkOrderDocument
  @Input()  barStyle!: { [key: string]: string }

  /** Emits the raw MouseEvent from the ⋯ button click so the parent can
   *  compute menu position relative to the grid container. */
  @Output() menuButtonClicked = new EventEmitter<MouseEvent>()

  get statusLabel(): string {
    return STATUS_LABELS[this.order.data.status as WorkOrderStatus] ?? this.order.data.status
  }

  get badgeStyle(): { [key: string]: string } {
    const status = this.order.data.status as WorkOrderStatus
    return {
      'background-color': STATUS_BADGE_COLORS[status] ?? '#E4FDFF',
      'color':            STATUS_TEXT_COLORS[status]  ?? 'rgba(0,176,191,1)',
    }
  }

  onMenuButtonClick(event: MouseEvent): void {
    event.stopPropagation()
    this.menuButtonClicked.emit(event)
  }
}