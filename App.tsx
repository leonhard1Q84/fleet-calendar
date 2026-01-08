

import React, { useState, useMemo } from 'react';
import { 
  Search, RotateCcw, ChevronDown, CheckCircle2, 
  LayoutDashboard, ShoppingCart, Car, List, Settings, 
  Menu, Bell, User, Maximize2, Minimize2, RefreshCw, Layers,
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, HelpCircle, ArrowLeft,
  Milestone, Share2, FileText
} from 'lucide-react';
import Timeline from './components/Timeline';
import EventDetailModal from './components/EventDetailModal';
import CreateEventModal from './components/CreateEventModal';
import EventContextMenu from './components/EventContextMenu';
import AssignVehicleModal from './components/AssignVehicleModal';
import { MOCK_EVENTS, MOCK_GROUPS, MOCK_VEHICLES, checkOverlap } from './constants';
import { FleetEvent, EventType, Vehicle } from './types';
import { addDays, subDays, format, differenceInHours, startOfDay, differenceInDays } from 'date-fns';

const SidebarItem = ({ icon: Icon, label, active = false, hasSub = false }: any) => (
  <div className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${active ? 'bg-[#38bdf8] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
    <div className="flex items-center gap-3">
      <Icon size={18} />
      <span className="text-sm font-medium">{label}</span>
    </div>
    {hasSub && <ChevronDown size={14} />}
  </div>
);

const FilterLabel = ({ children }: {children?: React.ReactNode}) => (
  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">{children}</label>
);

const App: React.FC = () => {
  // Global State
  const [events, setEvents] = useState<FleetEvent[]>(MOCK_EVENTS);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysToShow, setDaysToShow] = useState(21); // Default to roughly a month/3 weeks
  const [viewScale, setViewScale] = useState<'day' | 'hour'>('day'); 
  const [selectedEvent, setSelectedEvent] = useState<FleetEvent | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    event: FleetEvent | null;
  }>({ isOpen: false, x: 0, y: 0, event: null });
  
  // Layout State
  const [isMaximized, setIsMaximized] = useState(false);

  // Creation State
  const [createModalData, setCreateModalData] = useState<{
    vehicle: Vehicle;
    startDate: Date;
    endDate: Date;
  } | null>(null);

  // Assign Vehicle Modal State
  const [assignModalData, setAssignModalData] = useState<{
    isOpen: boolean;
    event: FleetEvent | null;
  }>({ isOpen: false, event: null });

  // Filter States
  const [filters, setFilters] = useState({
    store: '',
    sipp: '',
    plate: '', 
    group: '',
    source: '', 
    status: '', 
    notes: '',
    orderId: '', // New Filter
    onlyWithBookings: false,
    oneWayOnly: false,     // New Filter
    crossStoreOnly: false, // New Filter
  });

  // Legend Status Filters
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  // Toggle Logic
  const toggleStatusFilter = (key: string) => {
    setStatusFilters(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      return [...prev, key];
    });
  };

  // Creation Handlers
  const handleRangeSelect = (vehicle: Vehicle, start: Date, end: Date) => {
    setCreateModalData({ vehicle, startDate: start, endDate: end });
  };

  const handleCreateEvent = (newEventData: Partial<FleetEvent>) => {
    const newEvent: FleetEvent = {
      id: `new_${Date.now()}`,
      type: EventType.BLOCK, 
      groupId: '', 
      vehicleId: null, 
      startDate: new Date().toISOString(), 
      endDate: new Date().toISOString(),
      ...newEventData as any
    };
    setEvents(prev => [...prev, newEvent]);
    setCreateModalData(null);
  };

  // Update Event Handler (Locking, etc)
  const handleEventUpdate = (updatedEvent: FleetEvent) => {
     setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
     setSelectedEvent(updatedEvent); // Update current modal view if open
  };

  // Move / Reassign Handler (Drag and Drop)
  const handleEventMove = (eventId: string, newVehicleId: string | null, newStart?: string, newEnd?: string) => {
    setEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e;
        
        // Cannot move locked events via DnD (though the UI should prevent the drag initiation too)
        if (e.isLocked && newVehicleId !== null) return e; 

        const updatedEvent = { ...e, vehicleId: newVehicleId };
        
        // If moving from Pending (Unassigned) to Assigned, change type
        if (e.type === EventType.BOOKING_UNASSIGNED && newVehicleId) {
             updatedEvent.type = EventType.BOOKING_ASSIGNED;
             updatedEvent.status = 'Confirmed';
        }
        
        // If moving back to unassigned (Reassign Action)
        if (newVehicleId === null) {
            updatedEvent.type = EventType.BOOKING_UNASSIGNED;
            updatedEvent.status = 'Pending Assignment';
        }

        // Update times if provided
        if (newStart && newEnd) {
            updatedEvent.startDate = newStart;
            updatedEvent.endDate = newEnd;
        }

        return updatedEvent;
    }));
  };

  // Manual Assignment Confirmation Handler
  const handleAssignVehicleConfirm = (vehicleId: string) => {
     if (assignModalData.event) {
        handleEventMove(assignModalData.event.id, vehicleId);
     }
     setAssignModalData({ isOpen: false, event: null });
  };
  
  // Event Click Handling Logic
  const handleEventClick = (event: FleetEvent, e: React.MouseEvent) => {
     const isReservation = event.type === EventType.BOOKING_ASSIGNED || event.type === EventType.BOOKING_UNASSIGNED;
     
     if (isReservation) {
        // Show Context Menu for Reservations
        // Calculate a safe position (simple logic for now)
        let x = e.clientX;
        let y = e.clientY;
        
        // Prevent going off screen right
        if (x > window.innerWidth - 200) x = window.innerWidth - 200;
        
        setContextMenu({ isOpen: true, x, y, event });
     } else {
        // Directly open detail for other types
        setSelectedEvent(event);
     }
  };

  const handleContextMenuAction = (action: 'LOCK' | 'DETAILS' | 'NOTES' | 'ASSIGN', event: FleetEvent) => {
      setContextMenu({ ...contextMenu, isOpen: false });

      switch(action) {
          case 'LOCK':
             // Toggle Lock
             handleEventUpdate({ ...event, isLocked: !event.isLocked });
             break;
          case 'DETAILS':
             setSelectedEvent(event);
             break;
          case 'NOTES':
             // Using prompt for quick note editing as per request for "Add Notes" capability
             const currentNote = event.notes || '';
             const newNote = window.prompt("请输入订单备注 (Order Notes):", currentNote);
             if (newNote !== null) {
                 handleEventUpdate({ ...event, notes: newNote });
             }
             break;
          case 'ASSIGN':
             // Open Assignment Modal
             setAssignModalData({ isOpen: true, event });
             break;
      }
  };

  // Navigation Handlers
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    const shift = daysToShow >= 20 ? 7 : 1; // Shift by a week if in wide view, else 1 day
    const newDate = direction === 'next' ? addDays(currentDate, shift) : subDays(currentDate, shift);
    setCurrentDate(newDate);
  };

  const handleViewMode = (mode: 'week' | 'month') => {
    setViewScale('day'); // Ensure we leave hour view
    setDaysToShow(mode === 'week' ? 7 : 30);
  };

  const handleBackToOverview = () => {
    setViewScale('day');
    setDaysToShow(21); // Restore to default overview
  };

  // Toolbar Date Input Handlers
  const handleToolbarStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const newStart = new Date(e.target.value);
    if (isNaN(newStart.getTime())) return;

    if (viewScale === 'hour') {
        setCurrentDate(newStart);
    } else {
        // Calculate current end date
        const currentEnd = addDays(currentDate, daysToShow);
        // Calculate new duration to keep the end date visually consistent (or close to it)
        // If user moves start date forward, duration shrinks. If backward, duration grows.
        let newDays = differenceInDays(currentEnd, newStart);
        if (newDays < 1) newDays = 1; // Minimum 1 day view

        setCurrentDate(newStart);
        setDaysToShow(newDays);
    }
  };

  const handleToolbarEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const newEnd = new Date(e.target.value);
    if (isNaN(newEnd.getTime())) return;
    
    // Only valid for Day view
    let newDays = differenceInDays(newEnd, currentDate);
    if (newDays < 1) newDays = 1;
    setDaysToShow(newDays);
  };

  // Date Handlers (Timeline Click)
  const handleDateClickFromTimeline = (date: Date) => {
    setCurrentDate(date);
    setDaysToShow(1); 
    setViewScale('hour');
  };

  const handleReset = () => {
    setFilters({
      store: '',
      sipp: '',
      plate: '',
      group: '',
      source: '',
      status: '',
      notes: '',
      orderId: '',
      onlyWithBookings: false,
      oneWayOnly: false,
      crossStoreOnly: false,
    });
    setStatusFilters([]);
    setCurrentDate(new Date());
    setDaysToShow(21);
    setViewScale('day');
  };

  // --- FILTER & KPI LOGIC ---
  const currentViewEnd = addDays(currentDate, daysToShow);

  const filteredVehicles = useMemo(() => {
    return MOCK_VEHICLES.filter(v => {
      // 1. Standard Filters
      const matchStore = !filters.store || v.storeId.includes(filters.store);
      const searchTerm = filters.plate.toLowerCase();
      const matchPlate = !filters.plate || v.plate.toLowerCase().includes(searchTerm) || v.model.toLowerCase().includes(searchTerm);
      const matchGroup = !filters.group || v.groupId === filters.group;
      const matchSipp = !filters.sipp || v.sipp.toLowerCase().includes(filters.sipp.toLowerCase());
      
      // Get events for this vehicle in the current view
      const vehicleEvents = events.filter(e => e.vehicleId === v.id);
      const eventsInView = vehicleEvents.filter(e => checkOverlap(e.startDate, e.endDate, currentDate.toISOString(), currentViewEnd.toISOString()));

      // 2. Only Booked Filter
      let matchBookings = true;
      if (filters.onlyWithBookings) {
        matchBookings = eventsInView.length > 0;
      }

      // 3. One-Way Filter (Vehicle must have at least one One-Way trip in view)
      let matchOneWay = true;
      if (filters.oneWayOnly) {
         matchOneWay = eventsInView.some(e => e.pickupLocation && e.dropoffLocation && e.pickupLocation !== e.dropoffLocation);
      }

      // 4. Cross-Store Filter (Vehicle must have at least one Cross-Store trip in view)
      let matchCrossStore = true;
      if (filters.crossStoreOnly) {
         // Skip logic for virtual vehicles as they are usually pools
         if (v.isVirtual) {
            matchCrossStore = false; 
         } else {
            matchCrossStore = eventsInView.some(e => e.pickupLocation && !e.pickupLocation.includes(v.storeId));
         }
      }

      return matchStore && matchPlate && matchGroup && matchSipp && matchBookings && matchOneWay && matchCrossStore;
    });
  }, [filters, currentDate, daysToShow, currentViewEnd, events]);

  const filteredEvents = useMemo(() => {
    let visibleEvents = events;

    // A. ID Search (Reservation ID or Work Order ID/Event ID)
    if (filters.orderId) {
        const term = filters.orderId.toLowerCase();
        visibleEvents = visibleEvents.filter(e => 
            (e.reservationId && e.reservationId.toLowerCase().includes(term)) || 
            (e.id && e.id.toLowerCase().includes(term))
        );
    }

    // B. Text Search Filters
    if (filters.plate || filters.notes) {
         const term = (filters.plate + filters.notes).toLowerCase();
         visibleEvents = visibleEvents.filter(e => 
             (e.notes?.toLowerCase().includes(term) || e.reservationId?.toLowerCase().includes(term) || e.customerName?.toLowerCase().includes(term)) || 
             filteredVehicles.some(v => v.id === e.vehicleId) ||
             (e.type === EventType.BOOKING_UNASSIGNED && (e.modelPreference?.toLowerCase().includes(term) || e.customerName?.toLowerCase().includes(term)))
         );
    }

    // C. Status Filters (Legend)
    if (statusFilters.length > 0) {
      visibleEvents = visibleEvents.filter(e => {
         const status = e.status?.toLowerCase() || '';
         const isPickedUp = status.includes('picked up') || status.includes('active');
         if (statusFilters.includes('PENDING') && e.type === EventType.BOOKING_UNASSIGNED) return true;
         if (statusFilters.includes('ASSIGNED') && e.type === EventType.BOOKING_ASSIGNED && !isPickedUp) return true;
         if (statusFilters.includes('PICKED_UP') && e.type === EventType.BOOKING_ASSIGNED && isPickedUp) return true;
         if (statusFilters.includes('MAINT') && e.type === EventType.MAINTENANCE) return true;
         if (statusFilters.includes('STOP') && e.type === EventType.STOP_SALE) return true;
         if (statusFilters.includes('BLOCK') && e.type === EventType.BLOCK) return true;
         return false;
      });
    }

    // D. Special Filters (One-Way / Cross-Store) for PENDING events
    // For assigned events, the vehicle filtering handles the rows, but we generally keep the events visible for context.
    // However, for Unassigned (Pending) events, we must filter them explicitly here.
    if (filters.oneWayOnly) {
        visibleEvents = visibleEvents.filter(e => {
            if (e.type === EventType.BOOKING_UNASSIGNED) {
                return e.pickupLocation && e.dropoffLocation && e.pickupLocation !== e.dropoffLocation;
            }
            return true; // Keep assigned events if their vehicle is shown
        });
    }
    
    if (filters.crossStoreOnly) {
         visibleEvents = visibleEvents.filter(e => {
            if (e.type === EventType.BOOKING_UNASSIGNED) {
                return false; 
            }
            return true; 
        });
    }

    return visibleEvents;
  }, [filters, filteredVehicles, statusFilters, events]);

  return (
    <div className="flex h-screen bg-[#f1f5f9] font-sans text-slate-800 overflow-hidden">
      
      {/* 1. SIDEBAR - Hidden when maximized */}
      {!isMaximized && (
        <div className="w-[200px] bg-[#0f172a] flex flex-col flex-shrink-0 shadow-xl z-20 transition-all">
          <div className="h-[50px] bg-[#1e293b] flex items-center justify-start px-4 gap-2 text-white font-bold text-sm shadow-sm border-b border-gray-800">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs">F</div>
            <span>FleetEdge <span className="text-gray-400 font-normal">管理系统</span></span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mt-2">Workspace</div>
             <SidebarItem icon={RotateCcw} label="工作台" />
             <SidebarItem icon={LayoutDashboard} label="订单管理" hasSub />
             <SidebarItem icon={ShoppingCart} label="商品管理" hasSub />
             <SidebarItem icon={Settings} label="价格管理" hasSub />
             <SidebarItem icon={List} label="库存管理" hasSub />
             <div className="bg-[#1e293b] py-1">
                <div className="text-[#94a3b8] hover:text-white px-10 py-2 text-xs cursor-pointer">销售库存管理</div>
                <div className="text-white bg-[#3b82f6] px-10 py-2 text-xs cursor-pointer border-r-2 border-white">车辆排班日历</div>
                <div className="text-[#94a3b8] hover:text-white px-10 py-2 text-xs cursor-pointer">库存占用概览</div>
                <div className="text-[#94a3b8] hover:text-white px-10 py-2 text-xs cursor-pointer">库存参数配置</div>
                <div className="text-[#94a3b8] hover:text-white px-10 py-2 text-xs cursor-pointer">可用库存查询</div>
             </div>
             <SidebarItem icon={Car} label="车辆管理" hasSub />
             <SidebarItem icon={User} label="政策管理" hasSub />
             <SidebarItem icon={Settings} label="门店管理" hasSub />
             <SidebarItem icon={Settings} label="系统设置" />
          </div>
        </div>
      )}

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-w-0">
         
         {/* 2.1 Top Navbar - Hidden when maximized */}
         {!isMaximized && (
           <div className="h-[50px] bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-10 flex-shrink-0">
              <div className="flex items-center gap-4">
                 <Menu size={20} className="text-gray-500 cursor-pointer hover:text-gray-700" />
                 <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="hover:text-gray-700 cursor-pointer">首页</span>
                 </div>
                 <div className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-xs font-bold border border-blue-100">
                    车辆排单日历
                 </div>
                 <div className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                    <ChevronDown size={14} className="text-gray-400" />
                 </div>
              </div>
              <div className="flex items-center gap-4 text-gray-500">
                 <HelpCircle size={18} className="cursor-pointer hover:text-blue-600"/>
                 <div className="w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold cursor-pointer">中</div>
                 <Bell size={18} className="cursor-pointer hover:text-blue-600"/>
                 <div className="flex items-center gap-2 cursor-pointer pl-2 border-l border-gray-200">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                       <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" alt="avatar" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">admin</span>
                    <ChevronDown size={14} />
                 </div>
              </div>
           </div>
         )}

         {/* 2.2 Content Body */}
         <div className={`flex-1 overflow-auto p-4 flex flex-col gap-3 ${isMaximized ? 'p-0' : ''}`}>
            
            {/* A. Filter Panel (Redesigned) - Hidden when maximized */}
            {!isMaximized && (
              <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 flex-shrink-0">
                 {/* Row 1: Filters */}
                 <div className="flex flex-wrap items-end gap-3 mb-3">
                    <div className="w-[180px]">
                       <FilterLabel>STORES</FilterLabel>
                       <div className="relative">
                          <select 
                             value={filters.store} 
                             onChange={(e: any) => setFilters({...filters, store: e.target.value})}
                             className="w-full h-[36px] pl-3 pr-8 text-xs border border-gray-300 rounded text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none bg-white shadow-sm"
                          >
                             <option value="">All STORES</option>
                             <option value="Asakusabashi">Asakusabashi</option>
                             <option value="Fukuoka">Fukuoka</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                       </div>
                    </div>

                    <div className="w-[180px]">
                       <FilterLabel>CAR GROUP</FilterLabel>
                       <div className="relative">
                          <select 
                             value={filters.group} 
                             onChange={(e: any) => setFilters({...filters, group: e.target.value})}
                             className="w-full h-[36px] pl-3 pr-8 text-xs border border-gray-300 rounded text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none bg-white shadow-sm"
                          >
                             <option value="">All Group</option>
                             {MOCK_GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                       </div>
                    </div>

                    <div className="w-[180px]">
                       <FilterLabel>SIPP CODE</FilterLabel>
                       <div className="relative">
                          <select 
                             value={filters.sipp} 
                             onChange={(e: any) => setFilters({...filters, sipp: e.target.value})}
                             className="w-full h-[36px] pl-3 pr-8 text-xs border border-gray-300 rounded text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none bg-white shadow-sm"
                          >
                             <option value="">All SIPP</option>
                             <option value="ECMR">ECMR</option>
                             <option value="CDAR">CDAR</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                       </div>
                    </div>

                    <div className="w-[180px]">
                       <FilterLabel>PLATE NUMBER</FilterLabel>
                       <div className="relative">
                          <input 
                            type="text" 
                            placeholder="All Vehicles"
                            value={filters.plate}
                            onChange={(e) => setFilters({...filters, plate: e.target.value})}
                            className="w-full h-[36px] pl-3 pr-8 text-xs border border-gray-300 rounded text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white shadow-sm"
                          />
                           <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none opacity-50" />
                       </div>
                    </div>
                    
                    <div className="w-[180px]">
                       <FilterLabel>ORDER / WORK ID</FilterLabel>
                       <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Res / Work ID"
                            value={filters.orderId}
                            onChange={(e) => setFilters({...filters, orderId: e.target.value})}
                            className="w-full h-[36px] pl-3 pr-8 text-xs border border-gray-300 rounded text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white shadow-sm"
                          />
                           <FileText size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none opacity-50" />
                       </div>
                    </div>

                    {/* Restrict width to avoid huge input */}
                    <div className="flex-1 min-w-[200px] max-w-[400px]">
                       <FilterLabel>NOTES</FilterLabel>
                       <div className="flex gap-2">
                          <input 
                             type="text" 
                             placeholder="Notes"
                             value={filters.notes}
                             onChange={(e) => setFilters({...filters, notes: e.target.value})}
                             className="w-full h-[36px] px-3 text-xs border border-gray-300 rounded text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white shadow-sm"
                          />
                       </div>
                    </div>
                    
                    {/* Action Buttons: Moved to the far right using ml-auto */}
                    <div className="flex items-end gap-2 ml-auto">
                      <button className="h-[36px] px-3 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap">
                         <Search size={14} /> Search
                      </button>
                      <button onClick={handleReset} className="h-[36px] px-3 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors border border-gray-200 flex items-center gap-1.5 whitespace-nowrap">
                         <RotateCcw size={14} /> Reset
                      </button>
                    </div>
                 </div>

                 {/* Row 2: Checkboxes */}
                 <div className="flex flex-wrap items-center gap-6 mt-3 pt-3 border-t border-gray-100">
                    {/* Existing: Booked Only */}
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setFilters({...filters, onlyWithBookings: !filters.onlyWithBookings})}>
                       <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${filters.onlyWithBookings ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                          {filters.onlyWithBookings && <CheckCircle2 size={10} className="text-white" />}
                       </div>
                       <label className="text-xs text-gray-600 font-bold cursor-pointer select-none">SHOW BOOKED ONLY</label>
                    </div>

                    {/* New: One-Way Only */}
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setFilters({...filters, oneWayOnly: !filters.oneWayOnly})}>
                       <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${filters.oneWayOnly ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300 group-hover:border-orange-400'}`}>
                           {filters.oneWayOnly && <Milestone size={10} className="text-white" />}
                       </div>
                       <label className={`text-xs font-bold cursor-pointer select-none flex items-center gap-1.5 ${filters.oneWayOnly ? 'text-orange-600' : 'text-gray-600'}`}>
                          ONE-WAY ONLY <Milestone size={12} className={filters.oneWayOnly ? 'text-orange-500' : 'text-gray-400'} />
                       </label>
                    </div>

                    {/* New: Cross-Store Only */}
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setFilters({...filters, crossStoreOnly: !filters.crossStoreOnly})}>
                       <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${filters.crossStoreOnly ? 'bg-pink-600 border-pink-600' : 'bg-white border-gray-300 group-hover:border-pink-400'}`}>
                           {filters.crossStoreOnly && <Share2 size={10} className="text-white" />}
                       </div>
                       <label className={`text-xs font-bold cursor-pointer select-none flex items-center gap-1.5 ${filters.crossStoreOnly ? 'text-pink-600' : 'text-gray-600'}`}>
                          CROSS-STORE ONLY <Share2 size={12} className={filters.crossStoreOnly ? 'text-pink-500' : 'text-gray-400'} />
                       </label>
                    </div>
                 </div>
              </div>
            )}

            {/* B & C Wrapper: Calendar Area + Toolbar (Target for Fullscreen) */}
            <div className={`flex flex-col flex-1 gap-3 ${isMaximized ? 'fixed inset-0 z-50 bg-white p-4' : ''}`}>
               {/* B. Calendar Toolbar */}
               <div className="bg-white px-4 py-2 rounded-sm shadow-sm border border-gray-200 flex items-center justify-between flex-shrink-0">
                  
                  {/* Left: Nav & View */}
                  <div className="flex items-center gap-4">
                     {/* Back Button (Only in Hour View) */}
                     {viewScale === 'hour' && (
                        <>
                           <button 
                              onClick={handleBackToOverview} 
                              className="h-7 px-3 flex items-center gap-1.5 rounded border border-gray-200 hover:border-blue-400 bg-white text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                           >
                              <ArrowLeft size={14} /> Back
                           </button>
                           <div className="w-px h-5 bg-gray-300"></div>
                        </>
                     )}

                     {/* Nav Arrows */}
                     <div className="flex items-center gap-1">
                        <button onClick={() => handleNavigate('prev')} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={handleToday} className="px-3 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">Today</button>
                        <button onClick={() => handleNavigate('next')} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition-colors"><ChevronRight size={16} /></button>
                     </div>

                     <div className="w-px h-5 bg-gray-300 mx-1"></div>

                     {/* View Toggles (Hide in Hour Mode to avoid confusion, or keep active) */}
                     <div className="flex items-center bg-gray-100 p-0.5 rounded text-xs font-medium">
                        <button 
                           onClick={() => handleViewMode('week')}
                           className={`px-3 py-1 rounded-sm transition-all ${viewScale === 'day' && daysToShow === 7 ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                           Week
                        </button>
                        <button 
                           onClick={() => handleViewMode('month')}
                           className={`px-3 py-1 rounded-sm transition-all ${viewScale === 'day' && daysToShow >= 20 ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                           Month
                        </button>
                     </div>

                     <div className="w-px h-5 bg-gray-300 mx-1"></div>

                     {/* Date Range Display (Interactive) */}
                     <div className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1 bg-white shadow-sm hover:border-gray-300 transition-colors group">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                           {viewScale === 'hour' ? 'Viewing:' : 'Custom:'}
                        </span>
                        
                        {/* Start Date Input */}
                        <input 
                           type="date"
                           className="text-xs font-mono text-gray-700 font-medium bg-transparent outline-none border-b border-transparent focus:border-blue-500 transition-all w-[85px]"
                           value={format(currentDate, 'yyyy-MM-dd')}
                           onChange={handleToolbarStartDateChange}
                        />
                        
                        {!viewScale.includes('hour') && (
                           <>
                              <span className="text-gray-400">-</span>
                              {/* End Date Input */}
                              <input 
                                 type="date"
                                 className="text-xs font-mono text-gray-700 font-medium bg-transparent outline-none border-b border-transparent focus:border-blue-500 transition-all w-[85px]"
                                 value={format(addDays(currentDate, daysToShow), 'yyyy-MM-dd')}
                                 onChange={handleToolbarEndDateChange}
                              />
                           </>
                        )}
                     </div>
                  </div>

                  {/* Right: Stats & Maximize */}
                  <div className="flex items-center gap-6 text-xs text-gray-600">
                     
                     {/* Maximize Toggle */}
                     <button 
                        onClick={() => setIsMaximized(!isMaximized)}
                        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${isMaximized ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}
                        title={isMaximized ? "Exit Fullscreen" : "Fullscreen Calendar"}
                     >
                        {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                     </button>
                  </div>
               </div>

               {/* C. Calendar Area */}
               <div className="flex-1 bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden relative">
                    <div className="absolute inset-0 pb-2"> {/* Padding bottom to avoid scroll overlap */}
                       <Timeline 
                           groups={MOCK_GROUPS}
                           vehicles={filteredVehicles}
                           events={filteredEvents}
                           startDate={addDays(currentDate, -1)}
                           daysToShow={daysToShow}
                           viewScale={viewScale}
                           onEventClick={handleEventClick} // CHANGED: Now handles logic split
                           onDateClick={handleDateClickFromTimeline}
                           selectedStatusFilters={statusFilters}
                           toggleStatusFilter={toggleStatusFilter}
                           onRangeSelect={handleRangeSelect}
                           onEventMove={handleEventMove}
                       />
                    </div>
               </div>
            </div>

         </div>
      </div>

      {/* Context Menu */}
      <EventContextMenu 
         isOpen={contextMenu.isOpen}
         position={{ x: contextMenu.x, y: contextMenu.y }}
         event={contextMenu.event}
         onClose={() => setContextMenu({...contextMenu, isOpen: false})}
         onAction={handleContextMenuAction}
      />

      {/* Modals */}
      {selectedEvent && (
        <EventDetailModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)}
          onUpdate={handleEventUpdate}
          getVehicle={(id) => MOCK_VEHICLES.find(v => v.id === id)}
          getGroup={(id) => MOCK_GROUPS.find(g => g.id === id)}
        />
      )}
      <CreateEventModal 
        isOpen={!!createModalData}
        onClose={() => setCreateModalData(null)}
        onConfirm={handleCreateEvent}
        initialData={createModalData}
      />
      
      {/* Assign Vehicle Modal */}
      <AssignVehicleModal
         isOpen={assignModalData.isOpen}
         event={assignModalData.event}
         vehicles={MOCK_VEHICLES} // Pass all vehicles or filteredVehicles
         groups={MOCK_GROUPS}
         onClose={() => setAssignModalData({isOpen: false, event: null})}
         onConfirm={handleAssignVehicleConfirm}
      />
    </div>
  );
};

export default App;
