import {
  ChangeDetectorRef, Component, ElementRef, EventEmitter, Injectable, Input, OnChanges,
  OnInit, OnDestroy, Output, SimpleChanges, ViewChild
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms'
import { NgbDatepickerModule, NgbDateStruct, NgbDateParserFormatter, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap'
import { NgSelectModule } from '@ng-select/ng-select'
import { WorkCenterDocument, WorkOrderDocument, WorkOrderStatus } from '../../models/documents.model'

// Formats dates as MM.DD.YYYY in the input display
@Injectable()
class CustomDateFormatter extends NgbDateParserFormatter {
  parse(value: string): NgbDateStruct | null {
    if (!value) return null
    const parts = value.split('.')
    if (parts.length !== 3) return null
    return { month: +parts[0], day: +parts[1], year: +parts[2] }
  }
  format(date: NgbDateStruct | null): string {
    if (!date) return ''
    return `${String(date.month).padStart(2,'0')}.${String(date.day).padStart(2,'0')}.${date.year}`
  }
}



// Cross-field validator: end date must be after start date
function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const s = group.get('startDate')?.value
  const e = group.get('endDate')?.value
  if (!s?.year || !s?.month || !s?.day || !e?.year || !e?.month || !e?.day) return null
  const start = new Date(s.year, s.month - 1, s.day)
  const end   = new Date(e.year, e.month - 1, e.day)
  return end < start ? { endBeforeStart: true } : null
}

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
  providers: [{ provide: NgbDateParserFormatter, useClass: CustomDateFormatter }],
  templateUrl: './work-order-panel.component.html',
  styleUrls: ['./work-order-panel.component.scss'],

})
export class WorkOrderPanelComponent implements OnInit, OnChanges, OnDestroy {

  constructor(public cdr: ChangeDetectorRef, private el: ElementRef) {}
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
      startDate: new FormControl(this.toNgbDate(startDate),          Validators.required),
      endDate:   new FormControl(this.toNgbDate(endDate),            Validators.required)
    }, { validators: endAfterStart })

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

  // Which datepicker is currently open: null | "start" | "end"
  @ViewChild('startPicker') startPicker!: NgbInputDatepicker
  @ViewChild('endPicker')   endPicker!:   NgbInputDatepicker

  activePicker: string | null = null

  ngOnDestroy(): void {}

  togglePicker(name: string, picker: NgbInputDatepicker): void {
    picker.toggle()
    this.activePicker = picker.isOpen() ? name : null
    this.cdr.detectChanges()
  }

  closeAllPickers(): void {
    if (this.startPicker?.isOpen()) this.startPicker.close()
    if (this.endPicker?.isOpen())   this.endPicker.close()
    this.activePicker = null
  }

  checkOverlap(): void {
    const v = this.form.value
    const s = v.startDate, e = v.endDate
    // Guard: only check when both controls hold a fully populated NgbDateStruct
    // and the date order is valid (end >= start)
    if (!s?.year || !s?.month || !s?.day || !e?.year || !e?.month || !e?.day ||
        this.form.hasError('endBeforeStart')) {
      this.overlapError = false
      return
    }
    const startDate = this.fromNgbDate(s)
    const endDate   = this.fromNgbDate(e)
    const wcId      = this.initialData?.workCenterId ?? ''
    this.overlapError = this.existingOrders.some(o => {
      if (o.data.workCenterId !== wcId) return false
      if (this.isEdit && o.docId === this.initialData?.docId) return false
      return startDate <= o.data.endDate && endDate >= o.data.startDate
    })
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }

    if (this.form.hasError('endBeforeStart')) return
    this.checkOverlap()
    if (this.overlapError) return

    const v    = this.form.value
    const wcId = this.initialData?.workCenterId ?? ''
    this.save.emit({
      docId:        this.initialData?.docId,
      workCenterId: wcId,
      name:         v.name,
      status:       v.status,
      startDate:    this.fromNgbDate(v.startDate),
      endDate:      this.fromNgbDate(v.endDate)
    })
  }

  isClosing = false

  onCancel(): void {
    this.isClosing = true
    setTimeout(() => {
      this.isClosing = false
      this.cancel.emit()
    }, 180)
  }

  // ---------------------------------------------------------------------------
  // Status badge helpers (mirrors work order bar colors)
  // ---------------------------------------------------------------------------

  getStatusBadgeStyle(status: string): { [k: string]: string } {
    const bg:   Record<string,string> = { open: '#E4FDFF', 'in-progress': '#D6D8FF', complete: '#E1FFCC', blocked: '#FCEEB5' }
    const text: Record<string,string> = { open: 'rgba(0,176,191,1)', 'in-progress': 'rgba(62,64,219,1)', complete: 'rgba(8,162,104,1)', blocked: 'rgba(177,54,0,1)' }
    return { 'background-color': bg[status] ?? '#E4FDFF', 'color': text[status] ?? 'rgba(0,176,191,1)' }
  }

  // ---------------------------------------------------------------------------
  // Date utilities
  // ---------------------------------------------------------------------------

  // @upgrade Hour-level scheduling: these helpers currently strip time entirely,
  // always resolving dates to midnight. To support hour-specific scheduling,
  // replace NgbDatepicker with a combined date+time input (e.g. NgbDatepicker +
  // a separate hour/minute select or NgbTimepicker), store values as ISO-8601
  // datetime strings ('YYYY-MM-DDTHH:mm'), and update toNgbDate/fromNgbDate to
  // preserve and serialize the time component. The endAfterStart validator and
  // checkOverlap would also need to compare full datetime strings rather than
  // date-only strings.
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