import { TestBed } from '@angular/core/testing'
import { TimelineComponent } from './timeline.component'
import { SimpleChanges } from '@angular/core'

describe('TimelineComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineComponent],
    }).compileComponents()
  })

  it('should set activeTimescale to selected timescale on input change', () => {
    const fixture = TestBed.createComponent(TimelineComponent)
    const app = fixture.componentInstance
    const constructChangesObj = (
      currentValue: any,
      previousValue: any,
      firstChange: any,
      isFirstChange: any
    ): SimpleChanges => ({
      currentValue,
      previousValue,
      firstChange,
      isFirstChange
    })
    app.selectedTimescale = 'Day'
    app.ngOnChanges(constructChangesObj('Day', 'Month', false, () => false))
    expect(app._activeTimescale).toBe('Day')
    app.selectedTimescale = 'Hour'
    app.ngOnChanges(constructChangesObj('Hour', 'Day', false, () => false))
    expect(app._activeTimescale).toBe('Hour')
    app.selectedTimescale = 'Week'
    app.ngOnChanges(constructChangesObj('Week', 'Hour', false, () => false))
    expect(app._activeTimescale).toBe('Week')
    app.selectedTimescale = 'Month'
    app.ngOnChanges(constructChangesObj('Month', 'Week', false, () => false))
    expect(app._activeTimescale).toBe('Month')
  })
  
})
