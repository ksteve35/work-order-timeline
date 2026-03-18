import { Injectable } from '@angular/core'
import { WorkCenterDocument, WorkOrderDocument } from '../models/documents.model'
import { WORK_CENTERS, WORK_ORDERS } from '../data/sample-data'

@Injectable({
  providedIn: 'root'
})
export class SampleDataService {
  getWorkCenters(): WorkCenterDocument[] {
    return WORK_CENTERS
  }

  getWorkOrders(): WorkOrderDocument[] {
    return WORK_ORDERS
  }
}