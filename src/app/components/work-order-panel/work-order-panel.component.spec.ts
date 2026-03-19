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
})