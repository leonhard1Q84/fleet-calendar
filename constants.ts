
import { CarGroup, EventType, FleetEvent, Vehicle } from "./types";

// Configuration
export const CELL_WIDTH = 140; 
export const CELL_WIDTH_HOUR = 60;
export const HEADER_HEIGHT = 54; 
export const ROW_HEIGHT_STD = 50; // Reduced from 60 for compaction
export const EVENT_HEIGHT = 40;   // Slight reduction to fit new row height
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
      return 'bg-amber-400 text-amber-950 border-l-4 border-amber-600 shadow-sm'; 
    
    case EventType.BOOKING_ASSIGNED:
      if (status.includes('picked up') || status.includes('active')) return 'bg-indigo-600 text-white shadow-sm'; 
      return 'bg-blue-500 text-white shadow-sm'; 

    case EventType.MAINTENANCE:
      return 'bg-slate-600 text-white shadow-sm'; 

    case EventType.STOP_SALE:
      return 'bg-rose-500 text-white shadow-sm'; 

    case EventType.BLOCK:
      return 'bg-orange-500 text-white shadow-sm'; 

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
  // --- Group 1: Economy ---
  { id: 'v1', plate: '成田300わ2234', model: 'Toyota Yaris', sipp: 'ECMR', color: 'White', groupId: 'g1', status: 'available', storeId: 'Narita', features: ['snow_tires', 'telematics'] },
  { id: 'v2', plate: '成田300わ2382', model: 'Honda Fit', sipp: 'ECMR', color: 'Silver', groupId: 'g1', status: 'available', storeId: 'Narita', features: ['telematics'] },
  { id: 'v3', plate: '成田300わ2404', model: 'Nissan Note', sipp: 'ECAR', color: 'Blue', groupId: 'g1', status: 'maintenance', storeId: 'Narita' },
  { id: 'v4', plate: '成田300わ2427', model: 'Toyota Yaris', sipp: 'ECMR', color: 'Black', groupId: 'g1', status: 'available', storeId: 'Narita' },
  { id: 'v5', plate: '成田300わ2435', model: 'Toyota Yaris', sipp: 'ECMR', color: 'White', groupId: 'g1', status: 'backup', storeId: 'Narita', features: ['snow_tires'] }, 
  
  // VIRTUAL RESOURCE (3rd Party Pool)
  { id: 'v_virt_1', plate: 'Orix Sub-fleet', model: 'Ext. Pool (Any)', sipp: 'ECMR', color: 'Mixed', groupId: 'g1', status: 'available', storeId: 'Narita', isVirtual: true },

  // --- Group 2: Compact ---
  { id: 'v6', plate: '成田300わ2438', model: 'Toyota Corolla', sipp: 'CDAR', color: 'Black', groupId: 'g2', status: 'available', storeId: 'Narita', features: ['telematics'] },
  { id: 'v7', plate: '成田300わ2439', model: 'Mazda 3', sipp: 'CDMR', color: 'Red', groupId: 'g2', status: 'available', storeId: 'Narita' },
  { id: 'v8', plate: '成田300わ2443', model: 'Mazda 3', sipp: 'CDMR', color: 'Silver', groupId: 'g2', status: 'available', storeId: 'Narita' },
  { id: 'v9', plate: '成田300わ2444', model: 'Honda Civic', sipp: 'CDAR', color: 'White', groupId: 'g2', status: 'backup', storeId: 'Narita' },
  
  // --- Group 3: SUV ---
  { id: 'v10', plate: '成田300わ2463', model: 'Toyota RAV4', sipp: 'IFAR', color: 'Grey', groupId: 'g3', status: 'available', storeId: 'Narita', features: ['snow_tires', 'telematics'] },
  { id: 'v11', plate: '成田300わ2507', model: 'Toyota RAV4', sipp: 'IFAR', color: 'Black', groupId: 'g3', status: 'available', storeId: 'Narita' },
];

const today = new Date();
const addDays = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

export const MOCK_EVENTS: FleetEvent[] = [
  // --- Group 1 Events ---
  {
    id: 'e1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v1', // 2234
    startDate: addDays(-1),
    endDate: addDays(4),
    customerName: 'Tanaka Sato',
    reservationId: 'RES-1001',
    status: 'Picked Up',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
    notes: 'Late arrival'
  },
  {
    id: 'e2',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v2', // 2382
    startDate: addDays(1),
    endDate: addDays(5),
    customerName: 'John Smith',
    reservationId: 'RES-1002',
    status: 'Confirmed',
    pickupLocation: 'Narita T2',
    dropoffLocation: 'Haneda',
  },
  {
    id: 'e3',
    type: EventType.MAINTENANCE,
    groupId: 'g1',
    vehicleId: 'v3', // 2404
    startDate: addDays(-1),
    endDate: addDays(6),
    maintenanceType: 'Inspection',
    mechanic: 'Narita Service Hub',
    status: 'In Progress',
  },
  {
    id: 'e4',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v4', // 2427
    startDate: addDays(0),
    endDate: addDays(2),
    customerName: 'Suzuki K.',
    reservationId: 'RES-1004',
    status: 'Confirmed',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
    notes: 'Child seat x1'
  },

  // --- VIRTUAL VEHICLE EVENTS (Stacked) ---
  // Overlapping 1
  {
    id: 'e_virt_1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v_virt_1',
    startDate: addDays(0),
    endDate: addDays(3),
    customerName: 'External Cust A',
    reservationId: 'EXT-9901',
    status: 'Confirmed',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
  },
  // Overlapping 2 (Same time as above)
  {
    id: 'e_virt_2',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v_virt_1',
    startDate: addDays(0),
    endDate: addDays(4),
    customerName: 'External Cust B',
    reservationId: 'EXT-9902',
    status: 'Confirmed',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
  },
  // Overlapping 3 (Staggered)
  {
    id: 'e_virt_3',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v_virt_1',
    startDate: addDays(2),
    endDate: addDays(5),
    customerName: 'External Cust C',
    reservationId: 'EXT-9903',
    status: 'Confirmed',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T2',
  },

  // --- Group 2 Events ---
  {
    id: 'e5',
    type: EventType.STOP_SALE,
    groupId: 'g2',
    vehicleId: 'v6', // 2438
    startDate: addDays(5),
    endDate: addDays(10),
    reason: 'Recall',
    status: 'Active',
  },
  
  // --- Group 3 Events ---
  {
    id: 'e6',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g3',
    vehicleId: 'v10', // 2463
    startDate: addDays(-2),
    endDate: addDays(8),
    customerName: 'Wang L.',
    reservationId: 'RES-2022',
    status: 'Picked Up',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T2',
  },

  // --- Queue (Pending) STACKED ---
  {
    id: 'q1',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(0),
    endDate: addDays(3),
    customerName: 'M. Johnson',
    reservationId: 'P-102',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Narita T1',
    notes: 'Needs GPS english'
  },
  // Pending 2 (Same Model/Loc, overlaps)
  {
    id: 'q2',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(1),
    endDate: addDays(4),
    customerName: 'K. Tanaka',
    reservationId: 'P-103',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Narita T1',
  },
  // Pending 3 (Same Model/Loc, overlaps both)
  {
    id: 'q3',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(0),
    endDate: addDays(2),
    customerName: 'B. Lee',
    reservationId: 'P-104',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Narita T1',
    notes: 'VIP'
  },
  // Pending 4 (Different Model/Loc -> Different Row)
  {
    id: 'q4',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDays(2),
    endDate: addDays(5),
    customerName: 'S. Fox',
    reservationId: 'P-105',
    status: 'Pending Assignment',
    modelPreference: 'Honda Fit',
    pickupLocation: 'Haneda',
  },
];
