import { TestBed, fakeAsync, tick } from '@angular/core/testing'
import { TimelineComponent } from './timeline.component'
import { SimpleChanges } from '@angular/core'

describe('TimelineComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineComponent],
    }).compileComponents()
  })

  it('should set activeTimescale to selected timescale on input change', fakeAsync(() => {
    const fixture = TestBed.createComponent(TimelineComponent)
    const app = fixture.componentInstance

    // ngOnInit must run first to set up _activeTimescale initial state
    fixture.detectChanges()

    const makeChange = (currentValue: any, previousValue: any): SimpleChanges => ({
      selectedTimescale: {
        currentValue,
        previousValue,
        firstChange: false,
        isFirstChange: () => false
      }
    })

    app.selectedTimescale = 'Day'
    app.ngOnChanges(makeChange('Day', 'Month'))
    // _activeTimescale updates inside setTimeout(80) — flush it
    tick(80)
    expect(app._activeTimescale).toBe('Day')

    app.selectedTimescale = 'Hour'
    app.ngOnChanges(makeChange('Hour', 'Day'))
    tick(80)
    expect(app._activeTimescale).toBe('Hour')

    app.selectedTimescale = 'Week'
    app.ngOnChanges(makeChange('Week', 'Hour'))
    tick(80)
    expect(app._activeTimescale).toBe('Week')

    app.selectedTimescale = 'Month'
    app.ngOnChanges(makeChange('Month', 'Week'))
    tick(80)
    expect(app._activeTimescale).toBe('Month')
  }))
})