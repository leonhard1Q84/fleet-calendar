
import { CarGroup, EventType, FleetEvent, Vehicle } from "./types";

// Configuration
export const CELL_WIDTH = 140; 
export const HEADER_HEIGHT = 80; 
export const ROW_HEIGHT = 64; 

// Helper to get color based on Type AND Status
export const getEventColor = (event: FleetEvent): string => {
  const status = event.status?.toLowerCase() || '';

  // Unified History/Done State
  if (status.includes('completed') || status.includes('returned') || status.includes('done') || status.includes('past')) {
    return 'bg-slate-100 text-slate-500 border border-slate-200'; // Universal History Color
  }

  switch (event.type) {
    case EventType.BOOKING_UNASSIGNED:
      return 'bg-yellow-500 text-white shadow-sm shadow-yellow-900/10 border-l-4 border-yellow-700'; // Pending Assignment
    
    case EventType.BOOKING_ASSIGNED:
      if (status.includes('picked up') || status.includes('active')) return 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/10'; // Picked Up
      return 'bg-blue-500 text-white shadow-sm shadow-blue-900/10'; // Assigned / Confirmed

    case EventType.MAINTENANCE:
      return 'bg-slate-600 text-white shadow-sm shadow-slate-900/10'; // In Progress

    case EventType.STOP_SALE:
      return 'bg-red-500 text-white shadow-sm shadow-red-900/10'; // Active

    case EventType.BLOCK:
      return 'bg-orange-500 text-white shadow-sm shadow-orange-900/10'; // Active

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
  { id: 'g1', name: 'Economy (Group A)', code: 'ECMR' },
  { id: 'g2', name: 'Compact (Group B)', code: 'CDMR' },
  { id: 'g3', name: 'SUV (Group C)', code: 'IFAR' },
];

export const MOCK_VEHICLES: Vehicle[] = [
  // Group 1
  { id: 'v1', plate: 'CA-552-AB', model: 'Toyota Yaris', color: 'White', groupId: 'g1', status: 'active', storeId: 'SFO-01', features: ['snow_tires'] },
  { id: 'v2', plate: 'NY-992-XX', model: 'Honda Fit', color: 'Silver', groupId: 'g1', status: 'active', storeId: 'SFO-01' },
  { id: 'v3', plate: 'TX-123-ZZ', model: 'Hyundai Accent', color: 'Blue', groupId: 'g1', status: 'maintenance', storeId: 'SFO-01', features: ['snow_tires'] },
  // Group 2
  { id: 'v4', plate: 'FL-888-OP', model: 'Toyota Corolla', color: 'Black', groupId: 'g2', status: 'active', storeId: 'SFO-01' },
  { id: 'v5', plate: 'WA-777-LK', model: 'Mazda 3', color: 'Red', groupId: 'g2', status: 'active', storeId: 'SFO-01' },
  // Group 3
  { id: 'v6', plate: 'NV-444-RF', model: 'Toyota RAV4', color: 'Grey', groupId: 'g3', status: 'active', storeId: 'SFO-01', features: ['snow_tires'] },
];

const today = new Date();
const addDays = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const MOCK_EVENTS: FleetEvent[] = [
  // --- Reservations ---
  // Picked Up (Indigo)
  {
    id: 'e1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v1',
    startDate: addDays(-1),
    endDate: addDays(4),
    customerName: 'Alice Johnson',
    reservationId: 'RES-1001',
    status: 'Picked Up',
    pickupLocation: 'SFO-01',
    dropoffLocation: 'SFO-01',
    notes: 'Flight arriving late. Check tires.'
  },
  // Assigned / Confirmed (Blue)
  {
    id: 'e2',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v2',
    startDate: addDays(1),
    endDate: addDays(5),
    customerName: 'Bob Smith',
    reservationId: 'RES-1002',
    status: 'Confirmed',
    pickupLocation: 'SFO-01',
    dropoffLocation: 'LAX-01',
  },
  // Completed (Gray)
  {
    id: 'e2_short',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v2',
    startDate: addDays(-3),
    endDate: addDays(-1),
    customerName: 'Short Trip',
    reservationId: 'RES-SHORT',
    status: 'Completed',
    pickupLocation: 'SFO-01',
    dropoffLocation: 'SFO-01',
  },
  // Unassigned / Pending (Yellow)
  {
    id: 'e3',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null, // No vehicle yet
    startDate: addDays(2),
    endDate: addDays(4),
    customerName: 'Pending Customer',
    reservationId: 'RES-9999',
    status: 'Pending Assignment',
    pickupLocation: 'SFO-01',
    dropoffLocation: 'SFO-01',
    notes: 'Needs automatic transmission specifically.'
  },

  // --- Maintenance ---
  // In Progress (Slate)
  {
    id: 'e4',
    type: EventType.MAINTENANCE,
    groupId: 'g1',
    vehicleId: 'v3',
    startDate: addDays(-1),
    endDate: addDays(6),
    maintenanceType: 'Engine Repair',
    mechanic: 'Mike\'s Auto Shop',
    costEstimate: 450,
    status: 'In Progress',
    notes: 'Oil leak check.'
  },
  // Completed Maintenance (Gray)
  {
    id: 'e4_past',
    type: EventType.MAINTENANCE,
    groupId: 'g1',
    vehicleId: 'v3',
    startDate: addDays(-10),
    endDate: addDays(-8),
    maintenanceType: 'Oil Change',
    mechanic: 'QuickLube',
    status: 'Completed',
  },

  // --- Stop Sale ---
  // Active (Red)
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
  // Active (Orange)
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
    // Assigned Bookings Group 3 - Returned (Gray)
    {
      id: 'e7',
      type: EventType.BOOKING_ASSIGNED,
      groupId: 'g3',
      vehicleId: 'v6',
      startDate: addDays(-5),
      endDate: addDays(0),
      customerName: 'Charlie Brown',
      reservationId: 'RES-1003',
      status: 'Returned',
      pickupLocation: 'SFO-01',
      dropoffLocation: 'SFO-01',
    },
];
