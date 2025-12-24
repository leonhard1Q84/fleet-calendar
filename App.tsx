
import React, { useState, useMemo } from 'react';
import { 
  Search, RotateCcw, ChevronDown, CheckCircle2, 
  LayoutDashboard, ShoppingCart, Car, List, Settings, 
  Menu, Bell, User, Maximize2, RefreshCw, Layers,
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, HelpCircle, ArrowLeft
} from 'lucide-react';
import Timeline from './components/Timeline';
import EventDetailModal from './components/EventDetailModal';
import CreateEventModal from './components/CreateEventModal';
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

  // Creation State
  const [createModalData, setCreateModalData] = useState<{
    vehicle: Vehicle;
    startDate: Date;
    endDate: Date;
  } | null>(null);

  // Filter States
  const [filters, setFilters] = useState({
    store: '',
    sipp: '',
    plate: '', 
    group: '',
    source: '', 
    status: '', 
    notes: '',
    onlyWithBookings: false,
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
      onlyWithBookings: false,
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
      const matchStore = !filters.store || v.storeId.includes(filters.store);
      const searchTerm = filters.plate.toLowerCase();
      const matchPlate = !filters.plate || v.plate.toLowerCase().includes(searchTerm) || v.model.toLowerCase().includes(searchTerm);
      const matchGroup = !filters.group || v.groupId === filters.group;
      const matchSipp = !filters.sipp || v.sipp.toLowerCase().includes(filters.sipp.toLowerCase());
      
      let matchBookings = true;
      if (filters.onlyWithBookings) {
        const vehicleEvents = events.filter(e => e.vehicleId === v.id);
        const hasOverlap = vehicleEvents.some(e => checkOverlap(e.startDate, e.endDate, currentDate.toISOString(), currentViewEnd.toISOString()));
        matchBookings = hasOverlap;
      }
      return matchStore && matchPlate && matchGroup && matchSipp && matchBookings;
    });
  }, [filters, currentDate, daysToShow, currentViewEnd, events]);

  const filteredEvents = useMemo(() => {
    let visibleEvents = events;
    if (filters.plate || filters.notes) {
         const term = (filters.plate + filters.notes).toLowerCase();
         visibleEvents = visibleEvents.filter(e => 
             (e.notes?.toLowerCase().includes(term) || e.reservationId?.toLowerCase().includes(term) || e.customerName?.toLowerCase().includes(term)) || 
             filteredVehicles.some(v => v.id === e.vehicleId) ||
             (e.type === EventType.BOOKING_UNASSIGNED && (e.modelPreference?.toLowerCase().includes(term) || e.customerName?.toLowerCase().includes(term)))
         );
    }
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
    return visibleEvents;
  }, [filters, filteredVehicles, statusFilters, events]);

  const kpiData = useMemo(() => {
    const now = new Date();
    const startWindow = currentDate;
    const endWindow = addDays(currentDate, daysToShow);
    const totalHoursInWindow = differenceInHours(endWindow, startWindow);

    let vehiclesAvailableToday = 0;
    let totalRevenueHours = 0;
    
    filteredVehicles.forEach(v => {
      if (!v.isVirtual) {
        const vehicleEvents = events.filter(e => e.vehicleId === v.id);
        const isBlockedNow = vehicleEvents.some(e => {
            const isActive = e.status !== 'Completed' && e.status !== 'Returned';
            const isHappening = checkOverlap(e.startDate, e.endDate, now.toISOString(), addDays(now, 0.01).toISOString()); 
            return isActive && isHappening;
        });
        if (!isBlockedNow) vehiclesAvailableToday++;

        let hoursOccupied = 0;
        vehicleEvents.forEach(e => {
            if (e.type === EventType.BOOKING_ASSIGNED && checkOverlap(e.startDate, e.endDate, startWindow.toISOString(), endWindow.toISOString())) {
              const start = new Date(e.startDate) < startWindow ? startWindow : new Date(e.startDate);
              const end = new Date(e.endDate) > endWindow ? endWindow : new Date(e.endDate);
              const dur = differenceInHours(end, start);
              if (dur > 0) hoursOccupied += dur;
            }
        });
        totalRevenueHours += hoursOccupied;
      }
    });

    const realVehicles = filteredVehicles.filter(v => !v.isVirtual);
    const totalCapacityHours = realVehicles.length * totalHoursInWindow;
    const utilization = totalCapacityHours > 0 ? (totalRevenueHours / totalCapacityHours) * 100 : 0;

    return {
      available: vehiclesAvailableToday,
      utilization: utilization.toFixed(2),
    };
  }, [filteredVehicles, currentDate, daysToShow, events]);

  return (
    <div className="flex h-screen bg-[#f1f5f9] font-sans text-slate-800 overflow-hidden">
      
      {/* 1. SIDEBAR */}
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

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-w-0">
         
         {/* 2.1 Top Navbar */}
         <div className="h-[50px] bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-10">
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

         {/* 2.2 Content Body */}
         <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            
            {/* A. Filter Panel (Redesigned) */}
            <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200">
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
               <div className="flex items-center gap-2">
                  <input 
                     type="checkbox" 
                     id="bookedOnly" 
                     checked={filters.onlyWithBookings}
                     onChange={(e) => setFilters({...filters, onlyWithBookings: e.target.checked})}
                     className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <label htmlFor="bookedOnly" className="text-xs text-gray-600 font-medium select-none cursor-pointer">SHOW ONLY BOOKED VEHICLES</label>
               </div>
            </div>

            {/* B. Calendar Toolbar */}
            <div className="bg-white px-4 py-2 rounded-sm shadow-sm border border-gray-200 flex items-center justify-between">
               
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

               {/* Right: Stats */}
               <div className="flex items-center gap-6 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                     <span className="text-gray-500">Available Vehicles</span>
                     <span className="font-bold text-gray-900 text-sm">{kpiData.available}</span>
                  </div>
                   <div className="flex items-center gap-2">
                     <span className="text-gray-500">Utilization</span>
                     <span className="font-bold text-gray-900 text-sm">{kpiData.utilization}%</span>
                  </div>
                   <div className="flex items-center gap-2">
                     <span className="text-gray-500">Order STD Dev</span>
                     <span className="font-bold text-gray-900 text-sm">3.15</span>
                  </div>
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
                        onEventClick={setSelectedEvent}
                        onDateClick={handleDateClickFromTimeline}
                        selectedStatusFilters={statusFilters}
                        toggleStatusFilter={toggleStatusFilter}
                        onRangeSelect={handleRangeSelect}
                    />
                 </div>
            </div>

         </div>
      </div>

      {/* Modals */}
      {selectedEvent && (
        <EventDetailModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)}
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
    </div>
  );
};

export default App;
