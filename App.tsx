

import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Calendar as CalIcon, Users, ArrowLeft } from 'lucide-react';
import Timeline from './components/Timeline';
import EventDetailModal from './components/EventDetailModal';
import { MOCK_EVENTS, MOCK_GROUPS, MOCK_VEHICLES, checkOverlap } from './constants';
import { FleetEvent, EventType } from './types';
import { addDays, subDays, format, differenceInHours, startOfDay, differenceInDays } from 'date-fns';

const App: React.FC = () => {
  // Global State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysToShow, setDaysToShow] = useState(21);
  const [viewScale, setViewScale] = useState<'day' | 'hour'>('day'); 
  const [selectedEvent, setSelectedEvent] = useState<FleetEvent | null>(null);

  // Filter States
  const [filters, setFilters] = useState({
    store: '',
    group: '',
    plate: '', // Acts as generic search for now
    sipp: '', // New SIPP filter
    onlyWithBookings: false,
    only3rdParty: false, // New 3rd party filter
  });

  // Legend Status Filters (Array of keys: 'PENDING', 'ASSIGNED', 'PICKED_UP', 'MAINT', 'STOP', 'BLOCK')
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  // Date Logic
  const handleDatePrev = () => setCurrentDate(curr => subDays(curr, 7));
  const handleDateNext = () => setCurrentDate(curr => addDays(curr, 7));
  const handleToday = () => {
    setCurrentDate(new Date());
    setViewScale('day');
  };

  const handleDateClickFromTimeline = (date: Date) => {
    setCurrentDate(date);
    setDaysToShow(1); 
    setViewScale('hour');
  };
  
  const handleBackToOverview = () => {
     setViewScale('day');
     setDaysToShow(21); // Reset to default multi-day view
  };

  const toggleStatusFilter = (key: string) => {
    setStatusFilters(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // Custom Range Handlers
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if(!e.target.value) return;
    const newStart = new Date(e.target.value);
    const currentEnd = addDays(currentDate, daysToShow);
    const newDiff = differenceInDays(currentEnd, newStart);
    if(newDiff > 0) {
        setCurrentDate(newStart);
        setDaysToShow(newDiff);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if(!e.target.value) return;
    const newEnd = new Date(e.target.value);
    const newDiff = differenceInDays(newEnd, currentDate);
    if(newDiff > 0) {
        setDaysToShow(newDiff);
    }
  };

  const handleReset = () => {
    setFilters({
      store: '',
      group: '',
      plate: '',
      sipp: '',
      onlyWithBookings: false,
      only3rdParty: false
    });
    setStatusFilters([]);
    setCurrentDate(new Date());
    setDaysToShow(21);
    setViewScale('day');
  };

  // 1. FILTER LOGIC
  const currentViewEnd = addDays(currentDate, daysToShow);

  const filteredVehicles = useMemo(() => {
    return MOCK_VEHICLES.filter(v => {
      // Basic Text/Dropdown Filters
      const matchStore = !filters.store || v.storeId.includes(filters.store);
      
      // Expanded Text Search (Plate or Model)
      const searchTerm = filters.plate.toLowerCase();
      const matchPlateOrModel = !filters.plate || 
         v.plate.toLowerCase().includes(searchTerm) || 
         v.model.toLowerCase().includes(searchTerm);
      
      const matchGroup = !filters.group || v.groupId === filters.group;
      const matchSipp = !filters.sipp || v.sipp.toLowerCase().includes(filters.sipp.toLowerCase());
      
      // 3rd Party Logic
      const match3rdParty = !filters.only3rdParty || v.isVirtual;

      // "Only With Orders" Logic
      let matchBookings = true;
      if (filters.onlyWithBookings) {
        // Check if this vehicle has any event overlapping the CURRENT VIEW window
        const vehicleEvents = MOCK_EVENTS.filter(e => e.vehicleId === v.id);
        const hasOverlap = vehicleEvents.some(e => checkOverlap(e.startDate, e.endDate, currentDate.toISOString(), currentViewEnd.toISOString()));
        matchBookings = hasOverlap;
      }

      return matchStore && matchPlateOrModel && matchGroup && matchSipp && match3rdParty && matchBookings;
    });
  }, [filters, currentDate, daysToShow, currentViewEnd]);

  const filteredEvents = useMemo(() => {
    let events = MOCK_EVENTS;
    
    // A. Text Search Filter (Plate/Notes)
    if (filters.plate) {
         const term = filters.plate.toLowerCase();
         events = events.filter(e => 
             (e.notes?.toLowerCase().includes(term) || 
              e.reservationId?.toLowerCase().includes(term) ||
              e.customerName?.toLowerCase().includes(term))
             || 
             // Keep events if their vehicle matches
             filteredVehicles.some(v => v.id === e.vehicleId)
             ||
             // Keep events if they are pending (no vehicle) but match search text
             (e.type === EventType.BOOKING_UNASSIGNED && (e.modelPreference?.toLowerCase().includes(term) || e.customerName?.toLowerCase().includes(term)))
         );
    }

    // B. Legend Status Filter
    if (statusFilters.length > 0) {
      events = events.filter(e => {
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

    return events;
  }, [filters.plate, filteredVehicles, statusFilters]);

  // 2. KPI CALCULATIONS
  const kpiData = useMemo(() => {
    const now = new Date();
    const startWindow = currentDate;
    const endWindow = addDays(currentDate, daysToShow);
    const totalHoursInWindow = differenceInHours(endWindow, startWindow);

    let vehiclesAvailableToday = 0;
    let totalRevenueHours = 0;
    
    // 3rd Party Stats
    let thirdPartyActive = 0;

    filteredVehicles.forEach(v => {
      // 3rd Party calc
      if (v.isVirtual) {
          const active3rdEvents = MOCK_EVENTS.filter(e => e.vehicleId === v.id && checkOverlap(e.startDate, e.endDate, startWindow.toISOString(), endWindow.toISOString()));
          thirdPartyActive += active3rdEvents.length;
      }

      // Availability Check (Right Now) - only for Real vehicles
      if (!v.isVirtual) {
        const vehicleEvents = MOCK_EVENTS.filter(e => e.vehicleId === v.id);
        const isBlockedNow = vehicleEvents.some(e => {
            const isActive = e.status !== 'Completed' && e.status !== 'Returned' && e.status !== 'Released';
            const isHappening = checkOverlap(e.startDate, e.endDate, now.toISOString(), addDays(now, 0.01).toISOString()); 
            return isActive && isHappening;
        });
        if (!isBlockedNow) vehiclesAvailableToday++;

        // Utilization Check (In Window)
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

    // Calc Util % (only for real vehicles)
    const realVehicles = filteredVehicles.filter(v => !v.isVirtual);
    const totalCapacityHours = realVehicles.length * totalHoursInWindow;
    const utilization = totalCapacityHours > 0 ? (totalRevenueHours / totalCapacityHours) * 100 : 0;

    return {
      available: vehiclesAvailableToday,
      utilization: utilization.toFixed(1),
      thirdPartyActive
    };
  }, [filteredVehicles, currentDate, daysToShow]);


  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* 1. TOP HEADER: Consolidated Filters */}
      <div className="bg-white border-b border-gray-200 shadow-sm z-30 flex-shrink-0">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-y-3">
          
          <div className="flex items-center gap-4 flex-wrap">
                {/* Logo */}
                <div className="flex items-center gap-2 mr-2">
                   <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/20">F</div>
                   <h1 className="font-bold text-slate-800 text-lg tracking-tight hidden md:block">FleetTrack</h1>
                </div>

                {/* Vertical Divider */}
                <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

                {/* Store Select */}
                <div className="relative">
                    <select 
                    className="pl-3 pr-8 py-1.5 bg-slate-100 border-transparent hover:bg-slate-200 rounded text-sm font-semibold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer w-32 md:w-auto"
                    value={filters.store}
                    onChange={(e) => setFilters({...filters, store: e.target.value})}
                    >
                    <option value="">All Stores</option>
                    <option value="Asakusabashi">Asakusabashi</option>
                    <option value="Fukuoka">Fukuoka</option>
                    <option value="Hakata">Hakata</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>

                {/* Group Select */}
                <div className="relative">
                    <select 
                    className="pl-3 pr-8 py-1.5 bg-slate-100 border-transparent hover:bg-slate-200 rounded text-sm font-semibold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer w-32 md:w-auto"
                    value={filters.group}
                    onChange={(e) => setFilters({...filters, group: e.target.value})}
                    >
                    <option value="">All Groups</option>
                    {MOCK_GROUPS.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>

                 {/* SIPP Input */}
                 <div className="relative group w-24">
                    <input 
                      type="text" 
                      placeholder="SIPP"
                      className="px-3 py-1.5 bg-slate-100 border-transparent hover:bg-slate-200 rounded text-sm font-semibold text-slate-700 w-full focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase placeholder-gray-400"
                      value={filters.sipp}
                      onChange={(e) => setFilters({...filters, sipp: e.target.value})}
                    />
                 </div>

                 {/* Search Input (Plate/Model) */}
                 <div className="relative group w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Plate / Model / ID..."
                      className="pl-9 pr-3 py-1.5 bg-slate-50 border border-gray-200 rounded-full text-sm w-full focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      value={filters.plate}
                      onChange={(e) => setFilters({...filters, plate: e.target.value})}
                    />
                 </div>

                 {/* Reset */}
                 <button onClick={handleReset} className="p-2 text-gray-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all" title="Reset Filters">
                    <RotateCcw size={16} />
                 </button>
          </div>

          <div className="flex items-center gap-4">
             {/* Show Booked Only Toggle */}
             <label className="flex items-center gap-2 cursor-pointer group select-none">
               <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.onlyWithBookings ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                 {filters.onlyWithBookings && <CheckCircle2 size={12} className="text-white" />}
               </div>
               <input type="checkbox" className="hidden" checked={filters.onlyWithBookings} onChange={e => setFilters({...filters, onlyWithBookings: e.target.checked})} />
               <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">Only booked</span>
             </label>

             {/* Show 3rd Party Only Toggle */}
             <label className="flex items-center gap-2 cursor-pointer group select-none">
               <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.only3rdParty ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                 {filters.only3rdParty && <CheckCircle2 size={12} className="text-white" />}
               </div>
               <input type="checkbox" className="hidden" checked={filters.only3rdParty} onChange={e => setFilters({...filters, only3rdParty: e.target.checked})} />
               <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">3rd Party Only</span>
             </label>
          </div>
          
        </div>
      </div>

      {/* 2. TOOLBAR: Date Controls & Stats */}
      <div className="bg-slate-50 px-6 py-3 flex justify-between items-end">
         
         <div className="flex items-center gap-4">
             {/* Date Nav */}
             <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2">
                    {/* BACK BUTTON (Visible only in detail view) */}
                    {viewScale === 'hour' && (
                        <button 
                           onClick={handleBackToOverview}
                           className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm transition-all mr-2"
                        >
                           <ArrowLeft size={14} />
                           Back to Overview
                        </button>
                    )}

                    {/* Basic Nav */}
                    <div className="flex items-center bg-white rounded-md shadow-sm border border-gray-200 p-0.5">
                       <button onClick={handleDatePrev} className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-sm"><ChevronLeft size={16} /></button>
                       <button onClick={handleToday} className="px-3 py-1 text-xs font-bold text-slate-700 hover:text-blue-600 border-x border-gray-100">Today</button>
                       <button onClick={handleDateNext} className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-sm"><ChevronRight size={16} /></button>
                    </div>

                    {/* Scale Buttons (Removed Day) */}
                    <div className="flex bg-slate-200/50 p-0.5 rounded-lg border border-slate-200/50">
                        <button onClick={() => { setDaysToShow(7); setViewScale('day'); }} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewScale === 'day' && daysToShow === 7 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Week</button>
                        <button onClick={() => { setDaysToShow(30); setViewScale('day'); }} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewScale === 'day' && daysToShow >= 30 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Month</button>
                    </div>

                    {/* Custom Range */}
                    <div className="flex items-center gap-1 ml-4 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm text-xs">
                        <span className="font-semibold text-slate-500 mr-1">Custom:</span>
                        <input 
                            type="date" 
                            className="bg-transparent outline-none text-slate-700 font-mono w-[90px]"
                            value={format(currentDate, 'yyyy-MM-dd')}
                            onChange={handleStartDateChange}
                        />
                        <span className="text-gray-400 mx-1">to</span>
                        <input 
                            type="date" 
                            className="bg-transparent outline-none text-slate-700 font-mono w-[90px]"
                            value={format(addDays(currentDate, daysToShow), 'yyyy-MM-dd')}
                            onChange={handleEndDateChange}
                        />
                    </div>
                 </div>
             </div>
         </div>
         
         {/* Right Side: KPIs */}
         <div className="flex items-center gap-6">
             {/* KPI Mini */}
             <div className="flex gap-4">
                 {kpiData.thirdPartyActive > 0 && (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1"><Users size={10}/> 3rd Party</span>
                        <span className="text-lg font-bold text-slate-700 leading-none">{kpiData.thirdPartyActive}</span>
                    </div>
                 )}
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] uppercase font-bold text-gray-400">Available</span>
                   <span className="text-lg font-bold text-slate-700 leading-none">{kpiData.available}</span>
                </div>
                 <div className="flex flex-col items-end">
                   <span className="text-[10px] uppercase font-bold text-gray-400">Util %</span>
                   <span className={`text-lg font-bold leading-none ${Number(kpiData.utilization) > 80 ? 'text-emerald-600' : 'text-slate-700'}`}>{kpiData.utilization}%</span>
                </div>
             </div>

         </div>

      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden px-6 pb-6 relative">
         <Timeline 
            groups={MOCK_GROUPS}
            vehicles={filteredVehicles}
            events={filteredEvents}
            startDate={addDays(currentDate, -1)} // Start slightly before for context
            daysToShow={daysToShow}
            viewScale={viewScale}
            onEventClick={setSelectedEvent}
            onDateClick={handleDateClickFromTimeline}
            selectedStatusFilters={statusFilters}
            toggleStatusFilter={toggleStatusFilter}
         />
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <EventDetailModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)}
          getVehicle={(id) => MOCK_VEHICLES.find(v => v.id === id)}
          getGroup={(id) => MOCK_GROUPS.find(g => g.id === id)}
        />
      )}

    </div>
  );
};

export default App;