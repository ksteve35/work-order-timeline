import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SampleDataService } from './services/sample-data.service'
import { WorkCenterDocument, WorkOrderDocument } from './models/documents.model'
import { TimescaleSelectorComponent } from './components/timescale-selector/timescale-selector.component'
import { TimelineComponent } from './components/timeline/timeline.component'

type Timescale = 'Hour' | 'Day' | 'Week' | 'Month'

// ---------------------------------------------------------------------------
// localStorage persistence
//
// KEY: 'wot_work_orders'
//   Stores the full WorkOrderDocument[] array as a JSON string.
//   This includes all user-created, edited, and surviving (non-deleted) orders.
//   Work centers are NOT persisted — they are static reference data from
//   sample-data.ts and never change at runtime.
//
// DURATION: Indefinite.
//   localStorage has no built-in expiry. Data survives browser restarts,
//   tab closes, and page refreshes. It is only cleared by:
//     - The user clearing browser storage manually
//     - Calling localStorage.removeItem('wot_work_orders') programmatically
//     - The browser clearing site data (e.g. incognito mode on close)
//
// WHAT IS SAVED: Every time workOrders changes (create, edit, delete), the
//   entire array is serialised to JSON and written to localStorage. On next
//   load, if the key exists and parses successfully, those orders are used
//   instead of the sample data. If the key is missing or corrupt, the app
//   falls back to the sample data from sample-data.ts.
//
// STORAGE SIZE: Each WorkOrderDocument is ~200 bytes serialised. With 25
//   orders that is ~5 KB, well within the typical 5 MB localStorage limit.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'wot_work_orders'

function loadFromStorage(): WorkOrderDocument[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Basic shape check — ensure we have an array of objects with a docId
    if (!Array.isArray(parsed) || !parsed.every(o => o?.docId && o?.data)) return null
    return parsed as WorkOrderDocument[]
  } catch {
    // JSON.parse failed — storage is corrupt, fall back to sample data
    return null
  }
}

function saveToStorage(orders: WorkOrderDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch (e) {
    // setItem can throw if storage quota is exceeded — fail silently
    console.warn('wot: could not persist work orders to localStorage', e)
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TimescaleSelectorComponent, TimelineComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  selectedTimescale: Timescale = 'Month'
  workCenters: WorkCenterDocument[] = []
  workOrders:  WorkOrderDocument[]  = []

  constructor(private sampleData: SampleDataService) {}

  ngOnInit(): void {
    this.workCenters = this.sampleData.getWorkCenters()

    // Attempt to restore previously persisted orders.
    // Falls back to sample data if nothing is stored or storage is corrupt.
    const persisted = loadFromStorage()
    this.workOrders = persisted ?? this.sampleData.getWorkOrders()
  }

  onTimescaleSelected(ts: Timescale): void {
    this.selectedTimescale = ts
  }

  // Called by TimelineComponent whenever its workOrders array changes
  // (create, edit, delete). Receives the updated array and persists it.
  onWorkOrdersChanged(orders: WorkOrderDocument[]): void {
    this.workOrders = orders
    saveToStorage(orders)
  }
}