import { TestBed } from '@angular/core/testing'
import { TimescaleSelectorComponent } from './timescale-selector.component'

describe('TimescaleSelectorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimescaleSelectorComponent],
    }).compileComponents()
  })

  it('should toggle dropdown on toggleDropdown call', () => {
    const fixture = TestBed.createComponent(TimescaleSelectorComponent)
    const app = fixture.componentInstance
    expect(app.dropdownOpen).toBeFalse()
    app.toggleDropdown()
    expect(app.dropdownOpen).toBeTrue()
    app.toggleDropdown()
    expect(app.dropdownOpen).toBeFalse()
  })

  it('should emit selected option on option click', () => {
    const fixture = TestBed.createComponent(TimescaleSelectorComponent)
    const app = fixture.componentInstance
    spyOn(app.selectedChange, 'emit')
    let mockEvent = new MouseEvent('click')
    app.selectOption('Day', mockEvent)
    expect(app.selectedChange.emit).toHaveBeenCalledWith('Day')
    mockEvent = new MouseEvent('click')
    app.selectOption('Hour', mockEvent)
    expect(app.selectedChange.emit).toHaveBeenCalledWith('Hour')
  })

  it('should not emit selected option if already selected', () => {
    const fixture = TestBed.createComponent(TimescaleSelectorComponent)
    const app = fixture.componentInstance
    spyOn(app.selectedChange, 'emit')
    let mockEvent = new MouseEvent('click')
    app.selectOption('Day', mockEvent)
    expect(app.selectedChange.emit).toHaveBeenCalledWith('Day')
    mockEvent = new MouseEvent('click')
    app.selectOption('Day', mockEvent)
    expect(app.selectedChange.emit).toHaveBeenCalledTimes(1)
  })
})