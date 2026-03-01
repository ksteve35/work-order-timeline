export interface BaseDocument<T> {
  docId: string;
  docType: string;
  data: T;
}

export interface WorkCenterData {
  name: string;
}

export interface WorkOrderData {
  name: string;
  workCenterId: string;
  status: WorkOrderStatus;
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

export type WorkOrderStatus =
  | 'open'
  | 'in-progress'
  | 'complete'
  | 'blocked'

export type WorkCenterDocument = BaseDocument<WorkCenterData> & {
  docType: 'workCenter';
}

export type WorkOrderDocument = BaseDocument<WorkOrderData> & {
  docType: 'workOrder';
}
