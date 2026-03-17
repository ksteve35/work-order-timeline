import { TestBed } from '@angular/core/testing'
import { AppComponent } from './app.component'

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents()
  })

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    expect(app).toBeTruthy()
  })

  it('should initialize work centers', () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    app.ngOnInit()
    expect(app.workCenters.length).toBeGreaterThan(0)
  })

  it('should initialize work orders', () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    app.ngOnInit()
    expect(app.workOrders.length).toBeGreaterThan(0)
  })
})
