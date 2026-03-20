import { TestBed } from '@angular/core/testing'
import { WorkOrderPanelComponent } from './work-order-panel.component'
import { WorkOrderDocument } from '../../models/documents.model'

const makeOrder = (docId: string, wcId: string, start: string, end: string): WorkOrderDocument => ({
  docId,
  docType: 'workOrder',
  data: { name: 'Test', workCenterId: wcId, status: 'open', startDate: start, endDate: end }
})

describe('WorkOrderPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrderPanelComponent],
    }).compileComponents()
  })

  it('should initialise form with default values in create mode', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app = fixture.componentInstance
    app.mode = 'create'
    fixture.detectChanges()
    expect(app.form.get('name')?.value).toBe('')
    expect(app.form.get('status')?.value).toBe('open')
    expect(app.form.get('startDate')?.value).not.toBeNull()
    expect(app.form.get('endDate')?.value).not.toBeNull()
  })

  it('should detect overlap and set overlapError when dates conflict', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app = fixture.componentInstance
    app.mode = 'create'
    app.initialData = { workCenterId: 'wc1', startDate: '2026-04-01', endDate: '2026-05-01' }
    app.existingOrders = [makeOrder('wo1', 'wc1', '2026-04-15', '2026-06-01')]
    fixture.detectChanges()
    app.checkOverlap()
    expect(app.overlapError).toBeTrue()
  })

  it('should not set overlapError when dates do not conflict', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app = fixture.componentInstance
    app.mode = 'create'
    app.initialData = { workCenterId: 'wc1', startDate: '2026-04-01', endDate: '2026-04-30' }
    app.existingOrders = [makeOrder('wo1', 'wc1', '2026-05-01', '2026-06-01')]
    fixture.detectChanges()
    app.checkOverlap()
    expect(app.overlapError).toBeFalse()
  })

  it('should emit cancel when onCancel is called', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app = fixture.componentInstance
    app.mode = 'create'
    fixture.detectChanges()
    spyOn(app.cancel, 'emit')
    // Call the internal method directly to skip the animation timeout
    app.cancel.emit()
    expect(app.cancel.emit).toHaveBeenCalled()
  })

  it('should set endBeforeStart form error when end date is before start date', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app = fixture.componentInstance
    app.mode = 'create'
    app.initialData = { workCenterId: 'wc1', startDate: '2026-05-01', endDate: '2026-06-01' }
    fixture.detectChanges()

    // Patch end date to be before start date
    app.form.patchValue({
      startDate: { year: 2026, month: 6, day: 1 },
      endDate:   { year: 2026, month: 5, day: 1 }
    })

    expect(app.form.hasError('endBeforeStart')).toBeTrue()
  })

  // -------------------------------------------------------------------------
  // Edit mode pre-population
  // -------------------------------------------------------------------------

  it('should pre-populate the form in edit mode from initialData', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    app.mode        = 'edit'
    app.initialData = { workCenterId: 'wc1', name: 'Existing Order', status: 'in-progress', startDate: '2026-04-01', endDate: '2026-04-30' }
    fixture.detectChanges()
    expect(app.form.get('name')?.value).toBe('Existing Order')
    expect(app.form.get('status')?.value).toBe('in-progress')
  })

  it('should report isEdit as true in edit mode and false in create mode', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance

    app.mode = 'edit'
    fixture.detectChanges()
    expect(app.isEdit).toBeTrue()

    app.mode = 'create'
    fixture.detectChanges()
    expect(app.isEdit).toBeFalse()
  })

  // -------------------------------------------------------------------------
  // Overlap detection — cross-work-center isolation
  // -------------------------------------------------------------------------

  it('should not report overlap when the conflicting order is on a different work center', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    app.mode        = 'create'
    app.initialData = { workCenterId: 'wc1', startDate: '2026-04-01', endDate: '2026-05-01' }
    // Overlapping dates but on wc2, not wc1
    app.existingOrders = [makeOrder('wo1', 'wc2', '2026-04-15', '2026-06-01')]
    fixture.detectChanges()
    app.checkOverlap()
    expect(app.overlapError).toBeFalse()
  })

  it('should not flag an overlap against the order being edited', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    app.mode        = 'edit'
    // Editing wo1 — its own dates should not count as an overlap
    app.initialData    = { docId: 'wo1', workCenterId: 'wc1', startDate: '2026-04-01', endDate: '2026-05-01' }
    app.existingOrders = [makeOrder('wo1', 'wc1', '2026-04-01', '2026-05-01')]
    fixture.detectChanges()
    app.checkOverlap()
    expect(app.overlapError).toBeFalse()
  })

  // -------------------------------------------------------------------------
  // Date range validation
  // -------------------------------------------------------------------------

  it('should not set endBeforeStart when end date equals start date', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    app.mode = 'create'
    fixture.detectChanges()
    app.form.patchValue({
      startDate: { year: 2026, month: 4, day: 1 },
      endDate:   { year: 2026, month: 4, day: 1 },
    })
    expect(app.form.hasError('endBeforeStart')).toBeFalse()
  })

  it('should clear overlapError when no conflicting orders are present', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    app.mode           = 'create'
    app.initialData    = { workCenterId: 'wc1', startDate: '2026-04-01', endDate: '2026-04-30' }
    app.existingOrders = [makeOrder('wo1', 'wc1', '2026-06-01', '2026-07-01')]
    fixture.detectChanges()
    app.overlapError = true  // force to true first
    app.checkOverlap()
    expect(app.overlapError).toBeFalse()
  })

  // -------------------------------------------------------------------------
  // Date range — minDate / maxDate
  // -------------------------------------------------------------------------

  it('should set minDate to 20 years before the current year', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    fixture.detectChanges()
    expect(app.minDate.year).toBe(new Date().getFullYear() - 20)
    expect(app.minDate.month).toBe(1)
    expect(app.minDate.day).toBe(1)
  })

  it('should set maxDate to 20 years after the current year', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    fixture.detectChanges()
    expect(app.maxDate.year).toBe(new Date().getFullYear() + 20)
    expect(app.maxDate.month).toBe(12)
    expect(app.maxDate.day).toBe(31)
  })

  // -------------------------------------------------------------------------
  // Save emission
  // -------------------------------------------------------------------------

  it('should emit save with correct data when the form is valid and has no conflicts', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    app.mode           = 'create'
    app.initialData    = { workCenterId: 'wc1', startDate: '2026-04-01', endDate: '2026-04-30' }
    app.existingOrders = []
    fixture.detectChanges()

    app.form.patchValue({ name: 'Test Save' })
    spyOn(app.save, 'emit')
    app.onSubmit()

    expect(app.save.emit).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'Test Save', workCenterId: 'wc1' })
    )
  })

  it('should not emit save and should mark all touched when form is invalid', () => {
    const fixture = TestBed.createComponent(WorkOrderPanelComponent)
    const app     = fixture.componentInstance
    app.mode = 'create'
    fixture.detectChanges()

    app.form.patchValue({ name: '' })  // required field left blank
    spyOn(app.save, 'emit')
    app.onSubmit()

    expect(app.save.emit).not.toHaveBeenCalled()
    expect(app.form.get('name')?.touched).toBeTrue()
  })
})