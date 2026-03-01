import {
  WorkCenterDocument,
  WorkOrderDocument
} from '../models/documents.model'

export const WORK_CENTERS: WorkCenterDocument[] = [
  {
    docId: 'wc-1',
    docType: 'workCenter',
    data: { name: 'Extrusion Line A' }
  },
  {
    docId: 'wc-2',
    docType: 'workCenter',
    data: { name: 'CNC Machine 1' }
  },
  {
    docId: 'wc-3',
    docType: 'workCenter',
    data: { name: 'Assembly Station' }
  },
  {
    docId: 'wc-4',
    docType: 'workCenter',
    data: { name: 'Quality Control' }
  },
  {
    docId: 'wc-5',
    docType: 'workCenter',
    data: { name: 'Packaging Line' }
  }
]

export const WORK_ORDERS: WorkOrderDocument[] = [
  {
    docId: 'wo-1',
    docType: 'workOrder',
    data: {
      name: 'Order A',
      workCenterId: 'wc-1',
      status: 'complete',
      startDate: '2025-01-10',
      endDate: '2025-01-15'
    }
  },
  {
    docId: 'wo-2',
    docType: 'workOrder',
    data: {
      name: 'Order B',
      workCenterId: 'wc-1',
      status: 'in-progress',
      startDate: '2025-01-18',
      endDate: '2025-01-25'
    }
  },
  {
    docId: 'wo-3',
    docType: 'workOrder',
    data: {
      name: 'Order C',
      workCenterId: 'wc-2',
      status: 'open',
      startDate: '2025-01-12',
      endDate: '2025-01-20'
    }
  },
  {
    docId: 'wo-4',
    docType: 'workOrder',
    data: {
      name: 'Order D',
      workCenterId: 'wc-3',
      status: 'blocked',
      startDate: '2025-01-05',
      endDate: '2025-01-14'
    }
  },
  {
    docId: 'wo-5',
    docType: 'workOrder',
    data: {
      name: 'Order E',
      workCenterId: 'wc-3',
      status: 'complete',
      startDate: '2025-01-16',
      endDate: '2025-01-22'
    }
  },
  {
    docId: 'wo-6',
    docType: 'workOrder',
    data: {
      name: 'Order F',
      workCenterId: 'wc-4',
      status: 'in-progress',
      startDate: '2025-01-08',
      endDate: '2025-01-28'
    }
  },
  {
    docId: 'wo-7',
    docType: 'workOrder',
    data: {
      name: 'Order G',
      workCenterId: 'wc-5',
      status: 'open',
      startDate: '2025-01-02',
      endDate: '2025-01-09'
    }
  },
  {
    docId: 'wo-8',
    docType: 'workOrder',
    data: {
      name: 'Order H',
      workCenterId: 'wc-5',
      status: 'blocked',
      startDate: '2025-01-12',
      endDate: '2025-01-18'
    }
  }
]
