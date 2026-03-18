import {
  WorkCenterDocument,
  WorkOrderDocument,
  WorkOrderStatus
} from '../models/documents.model'

export const WORK_CENTERS: WorkCenterDocument[] = [
  { docId: 'wc1', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
  { docId: 'wc2', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
  { docId: 'wc3', docType: 'workCenter', data: { name: 'Assembly Station' } },
  { docId: 'wc4', docType: 'workCenter', data: { name: 'Quality Control' } },
  { docId: 'wc5', docType: 'workCenter', data: { name: 'Packaging Line' } }
]

export const WORK_ORDERS: WorkOrderDocument[] = [
  // --- Extrusion Line A (wc1) ---
  {
    docId: 'wo1',
    docType: 'workOrder',
    data: { name: 'Order A', workCenterId: 'wc1', status: 'open' as WorkOrderStatus, startDate: '2026-03-01', endDate: '2026-04-04' }
  },
  {
    docId: 'wo2',
    docType: 'workOrder',
    data: { name: 'Order B', workCenterId: 'wc1', status: 'in-progress' as WorkOrderStatus, startDate: '2026-04-17', endDate: '2026-05-17' }
  },
  {
    docId: 'wo3',
    docType: 'workOrder',
    data: { name: 'Order C', workCenterId: 'wc1', status: 'complete' as WorkOrderStatus, startDate: '2026-06-01', endDate: '2026-07-02' }
  },
  {
    docId: 'wo4',
    docType: 'workOrder',
    data: { name: 'Order D', workCenterId: 'wc1', status: 'blocked' as WorkOrderStatus, startDate: '2026-07-13', endDate: '2026-08-19' }
  },
  {
    docId: 'wo5',
    docType: 'workOrder',
    data: { name: 'Order E', workCenterId: 'wc1', status: 'open' as WorkOrderStatus, startDate: '2026-08-28', endDate: '2026-10-08' }
  },

  // --- CNC Machine 1 (wc2) ---
  {
    docId: 'wo6',
    docType: 'workOrder',
    data: { name: 'Order F', workCenterId: 'wc2', status: 'in-progress' as WorkOrderStatus, startDate: '2026-03-08', endDate: '2026-04-11' }
  },
  {
    docId: 'wo7',
    docType: 'workOrder',
    data: { name: 'Order G', workCenterId: 'wc2', status: 'complete' as WorkOrderStatus, startDate: '2026-04-24', endDate: '2026-05-24' }
  },
  {
    docId: 'wo8',
    docType: 'workOrder',
    data: { name: 'Order H', workCenterId: 'wc2', status: 'blocked' as WorkOrderStatus, startDate: '2026-06-08', endDate: '2026-07-09' }
  },
  {
    docId: 'wo9',
    docType: 'workOrder',
    data: { name: 'Order I', workCenterId: 'wc2', status: 'open' as WorkOrderStatus, startDate: '2026-07-20', endDate: '2026-08-26' }
  },
  {
    docId: 'wo10',
    docType: 'workOrder',
    data: { name: 'Order J', workCenterId: 'wc2', status: 'in-progress' as WorkOrderStatus, startDate: '2026-09-04', endDate: '2026-10-15' }
  },

  // --- Assembly Station (wc3) ---
  {
    docId: 'wo11',
    docType: 'workOrder',
    data: { name: 'Order K', workCenterId: 'wc3', status: 'complete' as WorkOrderStatus, startDate: '2026-03-15', endDate: '2026-04-18' }
  },
  {
    docId: 'wo12',
    docType: 'workOrder',
    data: { name: 'Order L', workCenterId: 'wc3', status: 'blocked' as WorkOrderStatus, startDate: '2026-05-01', endDate: '2026-05-31' }
  },
  {
    docId: 'wo13',
    docType: 'workOrder',
    data: { name: 'Order M', workCenterId: 'wc3', status: 'open' as WorkOrderStatus, startDate: '2026-06-15', endDate: '2026-07-16' }
  },
  {
    docId: 'wo14',
    docType: 'workOrder',
    data: { name: 'Order N', workCenterId: 'wc3', status: 'in-progress' as WorkOrderStatus, startDate: '2026-07-27', endDate: '2026-09-02' }
  },
  {
    docId: 'wo15',
    docType: 'workOrder',
    data: { name: 'Order O', workCenterId: 'wc3', status: 'complete' as WorkOrderStatus, startDate: '2026-09-11', endDate: '2026-10-22' }
  },

  // --- Quality Control (wc4) ---
  {
    docId: 'wo16',
    docType: 'workOrder',
    data: { name: 'Order P', workCenterId: 'wc4', status: 'blocked' as WorkOrderStatus, startDate: '2026-03-03', endDate: '2026-04-06' }
  },
  {
    docId: 'wo17',
    docType: 'workOrder',
    data: { name: 'Order Q', workCenterId: 'wc4', status: 'open' as WorkOrderStatus, startDate: '2026-04-19', endDate: '2026-05-19' }
  },
  {
    docId: 'wo18',
    docType: 'workOrder',
    data: { name: 'Order R', workCenterId: 'wc4', status: 'in-progress' as WorkOrderStatus, startDate: '2026-06-03', endDate: '2026-07-04' }
  },
  {
    docId: 'wo19',
    docType: 'workOrder',
    data: { name: 'Order S', workCenterId: 'wc4', status: 'complete' as WorkOrderStatus, startDate: '2026-07-15', endDate: '2026-08-21' }
  },
  {
    docId: 'wo20',
    docType: 'workOrder',
    data: { name: 'Order T', workCenterId: 'wc4', status: 'blocked' as WorkOrderStatus, startDate: '2026-08-30', endDate: '2026-10-10' }
  },

  // --- Packaging Line (wc5) ---
  {
    docId: 'wo21',
    docType: 'workOrder',
    data: { name: 'Order U', workCenterId: 'wc5', status: 'open' as WorkOrderStatus, startDate: '2026-03-10', endDate: '2026-04-13' }
  },
  {
    docId: 'wo22',
    docType: 'workOrder',
    data: { name: 'Order V', workCenterId: 'wc5', status: 'in-progress' as WorkOrderStatus, startDate: '2026-04-26', endDate: '2026-05-26' }
  },
  {
    docId: 'wo23',
    docType: 'workOrder',
    data: { name: 'Order W', workCenterId: 'wc5', status: 'complete' as WorkOrderStatus, startDate: '2026-06-10', endDate: '2026-07-11' }
  },
  {
    docId: 'wo24',
    docType: 'workOrder',
    data: { name: 'Order X', workCenterId: 'wc5', status: 'blocked' as WorkOrderStatus, startDate: '2026-07-22', endDate: '2026-08-28' }
  },
  {
    docId: 'wo25',
    docType: 'workOrder',
    data: { name: 'Order Y', workCenterId: 'wc5', status: 'open' as WorkOrderStatus, startDate: '2026-09-06', endDate: '2026-10-17' }
  }
]