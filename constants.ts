

import { CarGroup, EventType, FleetEvent, Vehicle } from "./types";

// Configuration
export const CELL_WIDTH = 140; 
export const CELL_WIDTH_HOUR = 60;
export const HEADER_HEIGHT = 54; // Increased height to support stacked Date/Day header
export const ROW_HEIGHT_STD = 60; 
export const EVENT_HEIGHT = 42; 
export const EVENT_GAP = 4;

// Helper to get color based on Type AND Status
export const getEventColor = (event: FleetEvent): string => {
  const status = event.status?.toLowerCase() || '';

  // Unified History/Done State
  if (status.includes('completed') || status.includes('returned') || status.includes('done') || status.includes('past')) {
    return 'bg-slate-100 text-slate-500 border border-slate-200'; // Universal History Color
  }

  switch (event.type) {
    case EventType.BOOKING_UNASSIGNED:
      return 'bg-amber-400 text-amber-950 border-l-4 border-amber-600 shadow-sm'; // Pending Assignment - Darker yellow/amber
    
    case EventType.BOOKING_ASSIGNED:
      if (status.includes('picked up') || status.includes('active')) return 'bg-indigo-600 text-white shadow-sm'; // Picked Up
      return 'bg-blue-500 text-white shadow-sm'; // Assigned / Confirmed

    case EventType.MAINTENANCE:
      return 'bg-slate-600 text-white shadow-sm'; // In Progress

    case EventType.STOP_SALE:
      return 'bg-rose-500 text-white shadow-sm'; // Active

    case EventType.BLOCK:
      return 'bg-orange-500 text-white shadow-sm'; // Active

    default:
      return 'bg-gray-500 text-white';
  }
};

export const EVENT_LABELS: Record<EventType, string> = {
  [EventType.BOOKING_ASSIGNED]: 'Reservation',
  [EventType.BOOKING_UNASSIGNED]: 'Pending Allocation',
  [EventType.MAINTENANCE]: 'Maintenance',
  [EventType.STOP_SALE]: 'Stop Sale',
  [EventType.BLOCK]: 'Internal Block',
};

// Helper: Check date overlap
export const checkOverlap = (
  start1: string, 
  end1: string, 
  start2: string, 
  end2: string
): boolean => {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && s2 < e1;
};

// Mock Data
export const MOCK_GROUPS: CarGroup[] = [
  { id: 'g1', name: 'Economy (Group A)' },
  { id: 'g2', name: 'Compact (Group B)' },
  { id: 'g3', name: 'SUV (Group C)' },
];

export const MOCK_VEHICLES: Vehicle[] = [
  // Group 1
  { id: 'v1', plate: 'T-YARIS-01', model: 'Toyota Yaris', sipp: 'ECMR', color: 'White', groupId: 'g1', status: 'active', storeId: 'Asakusabashi', features: ['snow_tires'] },
  { id: 'v2', plate: 'H-FIT-88', model: 'Honda Fit', sipp: 'ECMR', color: 'Silver', groupId: 'g1', status: 'active', storeId: 'Asakusabashi' },
  { id: 'v3', plate: 'N-NOTE-23', model: 'Nissan Note', sipp: 'ECAR', color: 'Blue', groupId: 'g1', status: 'maintenance', storeId: 'Asakusabashi', features: ['snow_tires'] },
  // Group 1 - 3rd Party
  { id: 'v_ext_1', plate: '3RD PARTY', model: 'Outsourced', sipp: 'XXXX', color: 'Var', groupId: 'g1', status: 'active', storeId: 'Asakusabashi', isVirtual: true },

  // Group 2
  { id: 'v4', plate: 'T-COR-99', model: 'Toyota Corolla', sipp: 'CDAR', color: 'Black', groupId: 'g2', status: 'active', storeId: 'Fukuoka', features: ['snow_tires'] },
  { id: 'v5', plate: 'M-MAZ3-77', model: 'Mazda 3', sipp: 'CDMR', color: 'Red', groupId: 'g2', status: 'active', storeId: 'Fukuoka' },
  
  // Group 3
  { id: 'v6', plate: 'T-RAV4-55', model: 'Toyota RAV4', sipp: 'IFAR', color: 'Grey', groupId: 'g3', status: 'active', storeId: 'Hakata', features: ['snow_tires'] },
];

const today = new Date();
const addDays = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};
const addHours = (hours: number) => {
    const d = new Date(today);
    d.setHours(d.getHours() + hours);
    return d.toISOString();
}

export const MOCK_EVENTS: FleetEvent[] = [
  // --- Group 1: Standard Vehicles ---
  {
    id: 'e1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v1',
    startDate: addDays(-1),
    endDate: addDays(4),
    customerName: 'Tanaka Sato',
    reservationId: 'RES-1001',
    status: 'Picked Up',
    pickupLocation: 'Asakusabashi',
    dropoffLocation: 'Asakusabashi',
    notes: 'Flight arriving late. Check tires.'
  },
  {
    id: 'e2',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v2',
    startDate: addDays(1),
    endDate: addDays(5),
    customerName: 'John Smith',
    reservationId: 'RES-1002',
    status: 'Confirmed',
    pickupLocation: 'Asakusabashi',
    dropoffLocation: 'Haneda Airport',
  },
  {
    id: 'e4',
    type: EventType.MAINTENANCE,
    groupId: 'g1',
    vehicleId: 'v3',
    startDate: addDays(-1),
    endDate: addDays(6),
    maintenanceType: 'Engine Repair',
    mechanic: 'Tokyo Auto Service',
    costEstimate: 45000,
    status: 'In Progress',
    notes: 'Oil leak check.'
  },

  // --- Group 1: Virtual / 3rd Party Overlaps ---
  // These should stack on the VENDOR-01 row
  {
    id: 'e_ext_1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v_ext_1',
    startDate: addDays(0),
    endDate: addDays(3),
    customerName: 'Ext: Suzuki',
    reservationId: 'EXT-001',
    status: 'Confirmed',
    pickupLocation: 'Asakusabashi',
  },
  {
    id: 'e_ext_2',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v_ext_1',
    startDate: addDays(1),
    endDate: addDays(4),
    customerName: 'Ext: Yamamoto',
    reservationId: 'EXT-002',
    status: 'Confirmed',
    pickupLocation: 'Asakusabashi',
  },
  {
    id: 'e_ext_3',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v_ext_1',
    startDate: addDays(2),
    endDate: addDays(5),
    customerName: 'Ext: Kato',
    reservationId: 'EXT-003',
    status: 'Confirmed',
    pickupLocation: 'Asakusabashi',
  },

  // --- Group 1: Queue Overlaps (Pending Allocation) ---
  // These should stack on the Queue row
  {
    id: 'q1',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(0),
    endDate: addDays(2),
    customerName: 'Pending #1',
    reservationId: 'P-101',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Asakusabashi'
  },
  {
    id: 'q2',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(0),
    endDate: addDays(3),
    customerName: 'Pending #2',
    reservationId: 'P-102',
    status: 'Pending Assignment',
    modelPreference: 'Honda Fit',
    pickupLocation: 'Asakusabashi'
  },
  {
    id: 'q3',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(1),
    endDate: addDays(4),
    customerName: 'Pending #3',
    reservationId: 'P-103',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Haneda Airport'
  },
   {
    id: 'q4',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(2),
    endDate: addDays(5),
    customerName: 'Pending #4',
    reservationId: 'P-104',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Asakusabashi'
  },


  // --- Stop Sale ---
  {
    id: 'e5',
    type: EventType.STOP_SALE,
    groupId: 'g2',
    vehicleId: 'v4',
    startDate: addDays(5),
    endDate: addDays(10),
    reason: 'Recall Notice',
    status: 'Active',
    notes: 'Airbag replacement required.'
  },
  
  // --- Block ---
  {
    id: 'e6',
    type: EventType.BLOCK,
    groupId: 'g2',
    vehicleId: 'v5',
    startDate: addDays(0),
    endDate: addDays(2),
    reason: 'VIP Prep',
    status: 'Active',
    notes: 'Cleaning for VIP client.'
  },
];