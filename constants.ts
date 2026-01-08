

import { CarGroup, EventType, FleetEvent, Vehicle } from "./types";

// Configuration
export const CELL_WIDTH = 140; 
export const CELL_WIDTH_HOUR = 60;
export const HEADER_HEIGHT = 66; // Increased height for utilization stats
export const ROW_HEIGHT_STD = 50; // Reduced from 60 for compaction
export const EVENT_HEIGHT = 40;   // Slight reduction to fit new row height
export const EVENT_GAP = 4;

// Helper to get color based on Type AND Status AND Vehicle Context
export const getEventColor = (event: FleetEvent, vehicle?: Vehicle): string => {
  const status = event.status?.toLowerCase() || '';

  // Unified History/Done State
  if (status.includes('completed') || status.includes('returned') || status.includes('done') || status.includes('past')) {
    return 'bg-slate-100 text-slate-500 border border-slate-200'; // Universal History Color
  }

  switch (event.type) {
    case EventType.BOOKING_UNASSIGNED:
      return 'bg-amber-400 text-amber-950 border-l-4 border-amber-600 shadow-sm'; 
    
    case EventType.BOOKING_ASSIGNED:
      // Check for One-Way (Different Pickup/Dropoff)
      const isOneWay = event.pickupLocation && event.dropoffLocation && (event.pickupLocation !== event.dropoffLocation);
      
      // Check for Cross-Store (Vehicle Store != Pickup Location)
      // e.g. Using a Narita car for a Haneda pickup
      const isCrossStore = vehicle && !vehicle.isVirtual && event.pickupLocation && !event.pickupLocation.includes(vehicle.storeId);

      // Locked/Pre-assigned events (Picked Up or Explicitly Locked)
      if (status.includes('picked up') || status.includes('active') || event.isLocked) {
          if (isCrossStore) return 'bg-gradient-to-r from-teal-700 to-emerald-700 text-white shadow-md ring-1 ring-emerald-400';
          if (isOneWay) return 'bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 text-white shadow-md ring-1 ring-purple-400';
          
          if (status.includes('picked up') || status.includes('active')) {
             return 'bg-indigo-700 text-white shadow-sm';
          }
          return 'bg-blue-700 text-white shadow-md ring-1 ring-blue-800'; // Locked but not picked up
      }

      // Standard Assigned (Unlocked / Floating)
      if (isCrossStore) return 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm border border-teal-600/20';
      if (isOneWay) return 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm';
      return 'bg-blue-500 text-white shadow-sm hover:bg-blue-600 transition-colors'; 

    case EventType.MAINTENANCE:
      return 'bg-slate-600 text-white shadow-sm'; 

    case EventType.STOP_SALE:
      return 'bg-rose-500 text-white shadow-sm'; 

    case EventType.BLOCK:
      return 'bg-purple-600 text-white shadow-sm'; // Changed to Purple for Ops Lock 

    default:
      return 'bg-gray-500 text-white';
  }
};

export const EVENT_LABELS: Record<EventType, string> = {
  [EventType.BOOKING_ASSIGNED]: 'Reservation',
  [EventType.BOOKING_UNASSIGNED]: 'Pending Allocation',
  [EventType.MAINTENANCE]: 'Maintenance',
  [EventType.STOP_SALE]: 'Stop Sale',
  [EventType.BLOCK]: 'Internal/Ops',
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
  
  // VIRTUAL RESOURCE (Swap Buffer for Group A)
  { id: 'v_buffer_g1', plate: '⇄ Swap Buffer', model: 'Temporary Holding', sipp: '----', color: '', groupId: 'g1', status: 'available', storeId: 'Narita', isVirtual: true },

  // --- Group 2: Compact ---
  { id: 'v6', plate: '成田300わ2438', model: 'Toyota Corolla', sipp: 'CDAR', color: 'Black', groupId: 'g2', status: 'available', storeId: 'Narita', features: ['telematics'] },
  { id: 'v7', plate: '成田300わ2439', model: 'Mazda 3', sipp: 'CDMR', color: 'Red', groupId: 'g2', status: 'available', storeId: 'Narita' },
  { id: 'v8', plate: '成田300わ2443', model: 'Mazda 3', sipp: 'CDMR', color: 'Silver', groupId: 'g2', status: 'available', storeId: 'Narita' },
  { id: 'v9', plate: '成田300わ2444', model: 'Honda Civic', sipp: 'CDAR', color: 'White', groupId: 'g2', status: 'backup', storeId: 'Narita' },
  
  // VIRTUAL RESOURCE (Swap Buffer for Group B)
  { id: 'v_buffer_g2', plate: '⇄ Swap Buffer', model: 'Temporary Holding', sipp: '----', color: '', groupId: 'g2', status: 'available', storeId: 'Narita', isVirtual: true },

  // --- Group 3: SUV ---
  { id: 'v10', plate: '成田300わ2463', model: 'Toyota RAV4', sipp: 'IFAR', color: 'Grey', groupId: 'g3', status: 'available', storeId: 'Narita', features: ['snow_tires', 'telematics'] },
  { id: 'v11', plate: '成田300わ2507', model: 'Toyota RAV4', sipp: 'IFAR', color: 'Black', groupId: 'g3', status: 'available', storeId: 'Narita' },
];

const today = new Date();
const addDays = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0); // Default middle of day
  return d.toISOString();
};

const addDate = (days: number, hours: number = 10, minutes: number = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

export const MOCK_EVENTS: FleetEvent[] = [
  // --- Group 1 Events ---
  // Past Booking
  {
    id: 'e_past_1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v1',
    startDate: addDate(-5, 9, 0),
    endDate: addDate(-2, 18, 0),
    customerName: 'History Log',
    reservationId: 'RES-OLD-1',
    status: 'Returned',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
  },
  // Current One-Way
  {
    id: 'e1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v1', // 2234 (Narita)
    startDate: addDate(-1, 14, 0),
    endDate: addDate(4, 10, 0),
    customerName: 'Tanaka Sato',
    reservationId: 'RES-1001',
    status: 'Picked Up',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Haneda', // ONE-WAY: Narita -> Haneda
    notes: 'Late arrival by 1 hr. Flight JL808.',
    isLocked: true // Active rentals are effectively locked
  },
  // Future Booking with Notes
  {
    id: 'e1_future',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v1',
    startDate: addDate(5, 9, 0),
    endDate: addDate(8, 18, 0),
    customerName: 'Kenji Suzuki',
    reservationId: 'RES-1099',
    status: 'Confirmed',
    pickupLocation: 'Haneda',
    dropoffLocation: 'Haneda',
    notes: 'Requires English GPS system.',
  },

  // Locked / Inventory Share
  {
    id: 'e2',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v2', // 2382 (Narita)
    startDate: addDate(1, 10, 0),
    endDate: addDate(5, 17, 0),
    customerName: 'John Smith',
    reservationId: 'RES-1002',
    status: 'Confirmed', 
    isLocked: true, 
    pickupLocation: 'Haneda',
    dropoffLocation: 'Haneda',
    notes: 'Inventory Share request from Haneda branch'
  },
  
  // Operational Lock (Extension)
  {
    id: 'e_ops_lock',
    type: EventType.BLOCK,
    groupId: 'g1',
    vehicleId: 'v2',
    startDate: addDate(5, 17, 0), // Immediately after prev booking
    endDate: addDate(6, 17, 0), // +1 Day
    reason: 'Operational Lock',
    notes: 'Customer called at 2pm. Extending rental by 24h. Charging card on file.',
    status: 'Active',
    isLocked: true
  },

  // Maintenance
  {
    id: 'e3',
    type: EventType.MAINTENANCE,
    groupId: 'g1',
    vehicleId: 'v3', // 2404
    startDate: addDate(-2, 8, 0),
    endDate: addDate(6, 18, 0),
    maintenanceType: 'Inspection',
    mechanic: 'Narita Service Hub',
    status: 'In Progress',
    notes: 'Routine 6-month safety check. Check brake pads.',
    costEstimate: 250
  },

  // Short Floating Booking
  {
    id: 'e4',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v4', // 2427
    startDate: addDate(0, 11, 30),
    endDate: addDate(2, 9, 0),
    customerName: 'Suzuki K.',
    reservationId: 'RES-1004',
    status: 'Confirmed',
    isLocked: false, 
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
    notes: 'Child seat x1 (Rear facing)'
  },
  // Another booking for v4
  {
    id: 'e4_next',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g1',
    vehicleId: 'v4',
    startDate: addDate(3, 10, 0),
    endDate: addDate(5, 10, 0),
    customerName: 'Mike Ross',
    reservationId: 'RES-1045',
    status: 'Confirmed',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T2',
    notes: 'VIP Client. Clean car thoroughly.'
  },

  // --- Group 2 Events ---
  // Stop Sale
  {
    id: 'e5',
    type: EventType.STOP_SALE,
    groupId: 'g2',
    vehicleId: 'v6', // 2438
    startDate: addDate(5, 0, 0),
    endDate: addDate(10, 0, 0),
    reason: 'Manufacturer Recall',
    status: 'Active',
    notes: 'Airbag sensor replacement required per bulletin #442.'
  },
  // Short gaps booking
  {
    id: 'e_g2_1',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g2',
    vehicleId: 'v6',
    startDate: addDate(0, 9, 0),
    endDate: addDate(2, 18, 0),
    customerName: 'Liu Wei',
    reservationId: 'RES-2001',
    status: 'Picked Up',
    pickupLocation: 'Narita T2',
    dropoffLocation: 'Narita T2',
  },

  // Mazda 3 busy schedule
  {
    id: 'e_g2_2',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g2',
    vehicleId: 'v7',
    startDate: addDate(-1, 10, 0),
    endDate: addDate(1, 10, 0),
    customerName: 'Emily Clark',
    reservationId: 'RES-2005',
    status: 'Picked Up', // Changed from 'Returned' to make it colorful/active
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
  },
  {
    id: 'e_g2_3',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g2',
    vehicleId: 'v7',
    startDate: addDate(2, 8, 0),
    endDate: addDate(4, 20, 0),
    customerName: 'Hiroshi T.',
    reservationId: 'RES-2008',
    status: 'Confirmed',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
    notes: 'Requested snow chains if possible. Customer bringing pet dog.'
  },
  
  // NEW: Locked VIP Booking
  {
    id: 'e_g2_locked_new',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g2',
    vehicleId: 'v8', // 2443
    startDate: addDate(1, 14, 0),
    endDate: addDate(4, 10, 0),
    customerName: 'VIP Guest',
    reservationId: 'RES-VIP-1',
    status: 'Confirmed',
    isLocked: true,
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
    notes: 'Strict vehicle assignment. Do not move. CEO of Partner Corp.'
  },

  // NEW: Cross Store Booking
  {
    id: 'e_g2_cross_new',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g2',
    vehicleId: 'v9', // 2444
    startDate: addDate(2, 9, 0),
    endDate: addDate(5, 18, 0),
    customerName: 'Travel Agent',
    reservationId: 'RES-CROSS-1',
    status: 'Confirmed',
    pickupLocation: 'Tokyo Station', // Not Narita
    dropoffLocation: 'Tokyo Station',
    notes: 'Remote pickup arranged. Key handoff by downtown staff.'
  },

  // --- Group 3 Events ---
  // Cross Store Logic
  {
    id: 'e6',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g3',
    vehicleId: 'v10', // 2463
    startDate: addDate(-2, 14, 0),
    endDate: addDate(8, 10, 0),
    customerName: 'Wang L.',
    reservationId: 'RES-2022',
    status: 'Picked Up',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T2',
    isLocked: true,
    notes: 'Cross-terminal dropoff agreed. Flight delayed +2 hours.'
  },

  // v11 free most of the time
  {
    id: 'e7',
    type: EventType.BOOKING_ASSIGNED,
    groupId: 'g3',
    vehicleId: 'v11',
    startDate: addDate(1, 12, 0),
    endDate: addDate(3, 12, 0),
    customerName: 'Sarah J.',
    reservationId: 'RES-3001',
    status: 'Confirmed',
    pickupLocation: 'Narita T1',
    dropoffLocation: 'Narita T1',
  },

  // --- Queue (Pending) STACKED ---
  {
    id: 'q1',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDate(0, 10, 0),
    endDate: addDate(3, 10, 0),
    customerName: 'M. Johnson',
    reservationId: 'P-102',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Narita T1',
    notes: 'Needs GPS english. Prefers White color.'
  },
  // Pending 2 (Same Model/Loc, overlaps)
  {
    id: 'q2',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDate(1, 14, 0),
    endDate: addDate(4, 14, 0),
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
    startDate: addDate(0, 9, 0),
    endDate: addDate(2, 18, 0),
    customerName: 'B. Lee',
    reservationId: 'P-104',
    status: 'Pending Assignment',
    modelPreference: 'Toyota Yaris',
    pickupLocation: 'Narita T1',
    notes: 'VIP Customer. Flight NH202.'
  },
  // Pending 4 (Different Model/Loc -> Different Row)
  {
    id: 'q4',
    type: EventType.BOOKING_UNASSIGNED,
    groupId: 'g1',
    vehicleId: null,
    startDate: addDate(2, 10, 0),
    endDate: addDate(5, 10, 0),
    customerName: 'S. Fox',
    reservationId: 'P-105',
    status: 'Pending Assignment',
    modelPreference: 'Honda Fit',
    pickupLocation: 'Haneda',
    notes: 'Cross-store pickup request pending approval.'
  },
];
