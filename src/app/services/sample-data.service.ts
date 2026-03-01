import { Injectable } from '@angular/core'
import {
  WorkCenterDocument,
  WorkOrderDocument,
  WorkOrderStatus
} from '../models/documents.model'

@Injectable({
  providedIn: 'root'
})
export class SampleDataService {
  // Work centers
  private workCenters: WorkCenterDocument[] = [
    { docId: 'wc1', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
    { docId: 'wc2', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
    { docId: 'wc3', docType: 'workCenter', data: { name: 'Assembly Station' } },
    { docId: 'wc4', docType: 'workCenter', data: { name: 'Quality Control' } },
    { docId: 'wc5', docType: 'workCenter', data: { name: 'Packaging Line' } }
  ]

  // Work orders
  private workOrders: WorkOrderDocument[] = [
    {
      docId: 'wo1',
      docType: 'workOrder',
      data: {
        name: 'Order A',
        workCenterId: 'wc1',
        status: 'open' as WorkOrderStatus,
        startDate: '2026-01-14',
        endDate: '2026-01-17'
      }
    },
    {
      docId: 'wo2',
      docType: 'workOrder',
      data: {
        name: 'Order B',
        workCenterId: 'wc2',
        status: 'in-progress' as WorkOrderStatus,
        startDate: '2026-01-15',
        endDate: '2026-01-20'
      }
    },
    {
      docId: 'wo3',
      docType: 'workOrder',
      data: {
        name: 'Order C',
        workCenterId: 'wc3',
        status: 'complete' as WorkOrderStatus,
        startDate: '2026-01-14',
        endDate: '2026-01-16'
      }
    },
    {
      docId: 'wo4',
      docType: 'workOrder',
      data: {
        name: 'Order D',
        workCenterId: 'wc3',
        status: 'blocked' as WorkOrderStatus,
        startDate: '2026-01-18',
        endDate: '2026-01-22'
      }
    },
    {
      docId: 'wo5',
      docType: 'workOrder',
      data: {
        name: 'Order E',
        workCenterId: 'wc4',
        status: 'open' as WorkOrderStatus,
        startDate: '2026-01-16',
        endDate: '2026-01-19'
      }
    },
    {
      docId: 'wo6',
      docType: 'workOrder',
      data: {
        name: 'Order F',
        workCenterId: 'wc5',
        status: 'in-progress' as WorkOrderStatus,
        startDate: '2026-01-14',
        endDate: '2026-01-21'
      }
    },
    {
      docId: 'wo7',
      docType: 'workOrder',
      data: {
        name: 'Order G',
        workCenterId: 'wc1',
        status: 'complete' as WorkOrderStatus,
        startDate: '2026-01-20',
        endDate: '2026-01-25'
      }
    },
    {
      docId: 'wo8',
      docType: 'workOrder',
      data: {
        name: 'Order H',
        workCenterId: 'wc2',
        status: 'blocked' as WorkOrderStatus,
        startDate: '2026-01-22',
        endDate: '2026-01-28'
      }
    }
  ]

  getWorkCenters(): WorkCenterDocument[] {
    return this.workCenters
  }

  getWorkOrders(): WorkOrderDocument[] {
    return this.workOrders
  }
}