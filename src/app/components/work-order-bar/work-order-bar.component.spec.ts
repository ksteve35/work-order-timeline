import { TestBed } from '@angular/core/testing'
import { WorkOrderBarComponent } from './work-order-bar.component'
import { WorkOrderDocument } from '../../models/documents.model'

const makeOrder = (status = 'open', name = 'Test Order'): WorkOrderDocument => ({
  docId:   'wo1',
  docType: 'workOrder',
  data: {
    name,
    workCenterId: 'wc1',
    status:       status as any,
    startDate:    '2026-04-01',
    endDate:      '2026-04-30',
  },
})

describe('WorkOrderBarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrderBarComponent],
    }).compileComponents()
  })

  it('should return the correct status label for each status', () => {
    const fixture = TestBed.createComponent(WorkOrderBarComponent)
    const comp    = fixture.componentInstance

    const cases: [string, string][] = [
      ['open',        'Open'],
      ['in-progress', 'In progress'],
      ['complete',    'Complete'],
      ['blocked',     'Blocked'],
    ]

    cases.forEach(([status, expected]) => {
      comp.order = makeOrder(status)
      expect(comp.statusLabel)
        .withContext(`Expected label for '${status}'`)
        .toBe(expected)
    })
  })

  it('should fall back to the raw status string for an unknown status', () => {
    const fixture = TestBed.createComponent(WorkOrderBarComponent)
    const comp    = fixture.componentInstance
    comp.order    = makeOrder('unknown-status')
    expect(comp.statusLabel).toBe('unknown-status')
  })

  it('should return a badgeStyle with background-color and color keys', () => {
    const fixture = TestBed.createComponent(WorkOrderBarComponent)
    const comp    = fixture.componentInstance
    comp.order    = makeOrder('open')
    const style   = comp.badgeStyle
    expect(style['background-color']).toBeTruthy()
    expect(style['color']).toBeTruthy()
  })

  it('should return distinct badge colors for different statuses', () => {
    const fixture = TestBed.createComponent(WorkOrderBarComponent)
    const comp    = fixture.componentInstance

    const colors = ['open', 'in-progress', 'complete', 'blocked'].map(status => {
      comp.order = makeOrder(status)
      return comp.badgeStyle['background-color']
    })

    expect(new Set(colors).size).toBe(4)
  })

  it('should emit menuButtonClicked with the MouseEvent when the menu button is clicked', () => {
    const fixture = TestBed.createComponent(WorkOrderBarComponent)
    const comp    = fixture.componentInstance
    comp.order    = makeOrder()
    comp.barStyle = { left: '0px', width: '100px' }
    fixture.detectChanges()

    spyOn(comp.menuButtonClicked, 'emit')
    const mockEvent = new MouseEvent('click')
    comp.onMenuButtonClick(mockEvent)

    expect(comp.menuButtonClicked.emit).toHaveBeenCalledWith(mockEvent)
  })

  it('should call stopPropagation on the event when the menu button is clicked', () => {
    const fixture = TestBed.createComponent(WorkOrderBarComponent)
    const comp    = fixture.componentInstance
    comp.order    = makeOrder()
    comp.barStyle = {}

    const mockEvent = new MouseEvent('click')
    spyOn(mockEvent, 'stopPropagation')
    comp.onMenuButtonClick(mockEvent)

    expect(mockEvent.stopPropagation).toHaveBeenCalled()
  })
})