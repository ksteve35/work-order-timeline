import { TestBed } from '@angular/core/testing'
import { TimescaleSelectorComponent } from './timescale-selector.component'

describe('TimescaleSelectorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimescaleSelectorComponent],
    }).compileComponents()
  })

  it('should have four timescale options', () => {
    const fixture = TestBed.createComponent(TimescaleSelectorComponent)
    const app = fixture.componentInstance
    expect(app.options.length).toBe(4)
    expect(app.options.map(o => o.value)).toEqual(['Hour', 'Day', 'Week', 'Month'])
  })

  it('should emit selected option on onSelect call', () => {
    const fixture = TestBed.createComponent(TimescaleSelectorComponent)
    const app = fixture.componentInstance
    spyOn(app.selectedChange, 'emit')
    app.onSelect('Day')
    expect(app.selectedChange.emit).toHaveBeenCalledWith('Day')
    app.onSelect('Hour')
    expect(app.selectedChange.emit).toHaveBeenCalledWith('Hour')
  })

  it('should not emit if the same option is selected again', () => {
    const fixture = TestBed.createComponent(TimescaleSelectorComponent)
    const app = fixture.componentInstance
    spyOn(app.selectedChange, 'emit')
    app.onSelect('Day')
    expect(app.selectedChange.emit).toHaveBeenCalledWith('Day')
    app.onSelect('Day')
    expect(app.selectedChange.emit).toHaveBeenCalledTimes(1)
  })

  it('should update selected value optimistically on onSelect', () => {
    const fixture = TestBed.createComponent(TimescaleSelectorComponent)
    const app = fixture.componentInstance
    expect(app.selected).toBe('Month')
    app.onSelect('Week')
    expect(app.selected).toBe('Week')
  })
})