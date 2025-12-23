

export enum EventType {
  BOOKING_ASSIGNED = 'BOOKING_ASSIGNED',
  BOOKING_UNASSIGNED = 'BOOKING_UNASSIGNED', // Overbooking/Pending
  MAINTENANCE = 'MAINTENANCE',
  STOP_SALE = 'STOP_SALE',
  BLOCK = 'BLOCK', // Temporary internal hold
}

export interface CarGroup {
  id: string;
  name: string;
  // code: string; // Removed generic code from group, moved to vehicle/logic
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  sipp: string; // Added SIPP code specific to vehicle/model
  color: string;
  groupId: string;
  status: 'active' | 'maintenance' | 'stopped';
  storeId: string;
  features?: string[]; // e.g. ['snow_tires']
  isVirtual?: boolean; // If true, this represents a 3rd party or pool resource with infinite capacity
}

export interface FleetEvent {
  id: string;
  type: EventType;
  groupId: string; // Belongs to a car group
  vehicleId: string | null; // Null if unassigned
  startDate: string; // ISO string
  endDate: string; // ISO string
  
  // Detailed fields
  customerName?: string;
  reservationId?: string;
  // Status: 
  // For Bookings: 'Confirmed', 'Picked Up', 'Returned', 'Completed', 'Pending Assignment'
  // For Maint/Stop/Block: 'Active', 'In Progress', 'Completed'
  status?: string; 
  pickupLocation?: string;
  dropoffLocation?: string;
  
  // Booking specific
  modelPreference?: string; // The model requested by customer (e.g. "Toyota Yaris")

  // Maintenance specific
  maintenanceType?: string; // "Routine", "Repair", "Inspection"
  mechanic?: string;
  costEstimate?: number;

  // Stop Sale / Block specific
  reason?: string;
  
  notes?: string;
}

// Props for the detail modal
export interface EventModalProps {
  event: FleetEvent | null;
  onClose: () => void;
  getVehicle: (id: string | null) => Vehicle | undefined;
  getGroup: (id: string) => CarGroup | undefined;
}