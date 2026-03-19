import {
  Component, EventEmitter, Input, OnChanges,
  OnInit, Output, SimpleChanges
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms'
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap'
import { NgSelectModule } from '@ng-select/ng-select'
import { WorkCenterDocument, WorkOrderDocument, WorkOrderStatus } from '../../models/documents.model'

export interface PanelWorkOrder {
  docId?:       string
  workCenterId: string
  name:         string
  status:       WorkOrderStatus
  startDate:    string  // YYYY-MM-DD
  endDate:      string  // YYYY-MM-DD
}

@Component({
  selector: 'app-work-order-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDatepickerModule, NgSelectModule],
  templateUrl: './work-order-panel.component.html',
  styleUrls: ['./work-order-panel.component.scss']
})
export class WorkOrderPanelComponent implements OnInit, OnChanges {
  @Input()  mode: 'create' | 'edit' = 'create'
  @Input()  initialData?: Partial<PanelWorkOrder>
  @Input()  workCenters: WorkCenterDocument[] = []
  @Input()  existingOrders: WorkOrderDocument[] = []
  @Output() save   = new EventEmitter<PanelWorkOrder>()
  @Output() cancel = new EventEmitter<void>()

  form!: FormGroup
  overlapError = false

  statusOptions: { label: string; value: WorkOrderStatus }[] = [
    { label: 'Open',        value: 'open'        },
    { label: 'In progress', value: 'in-progress'  },
    { label: 'Complete',    value: 'complete'     },
    { label: 'Blocked',     value: 'blocked'      }
  ]

  get isEdit(): boolean { return this.mode === 'edit' }
  get title(): string   { return 'Work Order Details' }
  get subtitle(): string { return 'Specify the dates, name and status for this order' }
  get submitLabel(): string { return this.isEdit ? 'Save' : 'Create' }

  ngOnInit(): void {
    this.buildForm()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.form) {
      this.patchForm()
    }
  }

  private buildForm(): void {
    const today     = new Date()
    const startDate = this.initialData?.startDate ?? this.formatDate(today)
    const endDate   = this.initialData?.endDate   ?? this.formatDate(this.addDays(today, 7))

    this.form = new FormGroup({
      name:      new FormControl(this.initialData?.name   ?? '',      Validators.required),
      status:    new FormControl(this.initialData?.status ?? 'open',  Validators.required),
      startDate: new FormControl(this.toNgbDate(startDate),           Validators.required),
      endDate:   new FormControl(this.toNgbDate(endDate),             Validators.required)
    })
  }

  private patchForm(): void {
    if (!this.initialData) return
    this.form.patchValue({
      name:      this.initialData.name   ?? '',
      status:    this.initialData.status ?? 'open',
      startDate: this.initialData.startDate ? this.toNgbDate(this.initialData.startDate) : null,
      endDate:   this.initialData.endDate   ? this.toNgbDate(this.initialData.endDate)   : null
    })
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }

    const v         = this.form.value
    const startDate = this.fromNgbDate(v.startDate)
    const endDate   = this.fromNgbDate(v.endDate)
    const wcId      = this.initialData?.workCenterId ?? ''

    // Overlap validation
    const overlap = this.existingOrders.some(o => {
      if (o.data.workCenterId !== wcId) return false
      if (this.isEdit && o.docId === this.initialData?.docId) return false
      return startDate <= o.data.endDate && endDate >= o.data.startDate
    })

    if (overlap) {
      this.overlapError = true
      return
    }

    this.overlapError = false
    this.save.emit({
      docId:        this.initialData?.docId,
      workCenterId: wcId,
      name:         v.name,
      status:       v.status,
      startDate,
      endDate
    })
  }

  onCancel(): void {
    this.cancel.emit()
  }

  // ---------------------------------------------------------------------------
  // Date utilities
  // ---------------------------------------------------------------------------

  private toNgbDate(dateStr: string): NgbDateStruct {
    const [y, m, d] = dateStr.split('-').map(Number)
    return { year: y, month: m, day: d }
  }

  private fromNgbDate(d: NgbDateStruct): string {
    return `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  private addDays(d: Date, n: number): Date {
    const r = new Date(d); r.setDate(r.getDate() + n); return r
  }
}