
import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Filter, BarChart3, Clock, CheckCircle2 } from 'lucide-react';
import Timeline from './components/Timeline';
import EventDetailModal from './components/EventDetailModal';
import { MOCK_EVENTS, MOCK_GROUPS, MOCK_VEHICLES, checkOverlap } from './constants';
import { FleetEvent, EventType } from './types';
import { addDays, subDays, format, differenceInHours, startOfDay, endOfDay } from 'date-fns';

const App: React.FC = () => {
  // Global State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysToShow, setDaysToShow] = useState(21);
  const [selectedEvent, setSelectedEvent] = useState<FleetEvent | null>(null);

  // Filter States
  const [filters, setFilters] = useState({
    store: '',
    sipp: '',
    plate: '',
    status: '',
    notes: '',
    source: '',
    group: '',
    onlyWithBookings: false
  });

  // Date Navigation Handlers
  const handleDatePrev = () => setCurrentDate(curr => subDays(curr, daysToShow === 1 ? 1 : 7));
  const handleDateNext = () => setCurrentDate(curr => addDays(curr, daysToShow === 1 ? 1 : 7));
  const handleToday = () => setCurrentDate(new Date());

  const handleReset = () => {
    setFilters({
      store: '',
      sipp: '',
      plate: '',
      status: '',
      notes: '',
      source: '',
      group: '',
      onlyWithBookings: false
    });
    setCurrentDate(new Date());
    setDaysToShow(21);
  };

  // 1. FILTER LOGIC
  const currentViewEnd = addDays(currentDate, daysToShow);

  const filteredVehicles = useMemo(() => {
    return MOCK_VEHICLES.filter(v => {
      // Basic Text/Dropdown Filters
      const matchStore = !filters.store || v.storeId.includes(filters.store);
      const matchPlate = !filters.plate || v.plate.toLowerCase().includes(filters.plate.toLowerCase()) || v.model.toLowerCase().includes(filters.plate.toLowerCase());
      const matchGroup = !filters.group || v.groupId === filters.group;
      
      // "Only With Orders" Logic
      let matchBookings = true;
      if (filters.onlyWithBookings) {
        // Check if this vehicle has any event overlapping the CURRENT VIEW window
        const vehicleEvents = MOCK_EVENTS.filter(e => e.vehicleId === v.id);
        const hasOverlap = vehicleEvents.some(e => checkOverlap(e.startDate, e.endDate, currentDate.toISOString(), currentViewEnd.toISOString()));
        matchBookings = hasOverlap;
      }

      return matchStore && matchPlate && matchGroup && matchBookings;
    });
  }, [filters, currentDate, daysToShow, currentViewEnd]);

  const filteredEvents = useMemo(() => {
    let events = MOCK_EVENTS;
    if (filters.notes) {
      events = events.filter(e => e.notes?.toLowerCase().includes(filters.notes.toLowerCase()) || e.reservationId?.toLowerCase().includes(filters.notes.toLowerCase()));
    }
    return events;
  }, [filters.notes]);

  // 2. KPI CALCULATIONS
  const kpiData = useMemo(() => {
    const now = new Date();
    const startWindow = currentDate;
    const endWindow = addDays(currentDate, daysToShow);
    const totalHoursInWindow = differenceInHours(endWindow, startWindow);

    let vehiclesAvailableToday = 0;
    let totalRevenueHours = 0;
    const vehicleUsageCounts: number[] = [];

    filteredVehicles.forEach(v => {
      // Availability Check (Right Now)
      const vehicleEvents = MOCK_EVENTS.filter(e => e.vehicleId === v.id);
      const isBlockedNow = vehicleEvents.some(e => {
         const isActive = e.status !== 'Completed' && e.status !== 'Returned' && e.status !== 'Released';
         const isHappening = checkOverlap(e.startDate, e.endDate, now.toISOString(), addDays(now, 0.01).toISOString()); // Tiny slice for "now"
         return isActive && isHappening;
      });
      if (!isBlockedNow) vehiclesAvailableToday++;

      // Utilization Check (In Window)
      let hoursOccupied = 0;
      vehicleEvents.forEach(e => {
        if (e.type === EventType.BOOKING_ASSIGNED && checkOverlap(e.startDate, e.endDate, startWindow.toISOString(), endWindow.toISOString())) {
           // Simplify intersection for demo math
           const start = new Date(e.startDate) < startWindow ? startWindow : new Date(e.startDate);
           const end = new Date(e.endDate) > endWindow ? endWindow : new Date(e.endDate);
           const dur = differenceInHours(end, start);
           if (dur > 0) hoursOccupied += dur;
        }
      });
      totalRevenueHours += hoursOccupied;
      vehicleUsageCounts.push(hoursOccupied);
    });

    // Calc Util %
    const totalCapacityHours = filteredVehicles.length * totalHoursInWindow;
    const utilization = totalCapacityHours > 0 ? (totalRevenueHours / totalCapacityHours) * 100 : 0;

    // Calc Std Dev
    let stdDev = 0;
    if (vehicleUsageCounts.length > 0) {
      const mean = vehicleUsageCounts.reduce((a, b) => a + b, 0) / vehicleUsageCounts.length;
      const variance = vehicleUsageCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vehicleUsageCounts.length;
      stdDev = Math.sqrt(variance);
    }

    return {
      available: vehiclesAvailableToday,
      utilization: utilization.toFixed(1),
      stdDev: stdDev.toFixed(2)
    };
  }, [filteredVehicles, currentDate, daysToShow]);


  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* Header / Filter Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm z-30 flex-shrink-0">
        
        {/* Top Bar: Breadcrumb + Reset */}
        <div className="px-6 pt-4 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="hover:text-blue-600 cursor-pointer">Home</span>
              <span>/</span>
              <span className="font-semibold text-slate-800">Fleet Schedule</span>
            </div>
            <button onClick={handleReset} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
              <RotateCcw size={12} /> Reset Filters
            </button>
        </div>

        {/* Filter Grid */}
        <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Store (2 cols) */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Store</label>
            <div className="relative">
              <select 
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-gray-200 rounded text-sm font-medium text-slate-700 appearance-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                value={filters.store}
                onChange={(e) => setFilters({...filters, store: e.target.value})}
              >
                <option value="">All Stores</option>
                <option value="SFO-01">SFO-01 (San Francisco)</option>
                <option value="LAX-01">LAX-01 (Los Angeles)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* SIPP Code (2 cols) */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Group</label>
             <div className="relative">
              <select 
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-gray-200 rounded text-sm font-medium text-slate-700 appearance-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={filters.group}
                onChange={(e) => setFilters({...filters, group: e.target.value})}
              >
                <option value="">All Groups</option>
                {MOCK_GROUPS.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

           {/* Plate/Model (2 cols) */}
           <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Plate / Model</label>
            <input 
              type="text" 
              placeholder="Toyota or HH003"
              className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded text-sm font-medium text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder:font-normal placeholder:text-gray-400"
              value={filters.plate}
              onChange={(e) => setFilters({...filters, plate: e.target.value})}
            />
          </div>

           {/* Time Range (4 cols) */}
           <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Schedule View</label>
            <div className="flex gap-2">
               {/* Nav */}
               <div className="flex items-center border border-gray-200 rounded bg-white shadow-sm">
                 <button onClick={handleDatePrev} className="p-2 hover:bg-gray-50 border-r border-gray-100 text-gray-600"><ChevronLeft size={16} /></button>
                 <button onClick={handleToday} className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 uppercase">Today</button>
                 <button onClick={handleDateNext} className="p-2 hover:bg-gray-50 border-l border-gray-100 text-gray-600"><ChevronRight size={16} /></button>
               </div>
               
               {/* Segment Control */}
               <div className="flex bg-slate-100 p-0.5 rounded border border-gray-200 flex-1">
                  {[1, 7, 30].map(d => (
                    <button 
                      key={d}
                      onClick={() => setDaysToShow(d)}
                      className={`flex-1 text-xs font-semibold rounded py-1.5 transition-all ${daysToShow === d ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {d === 1 ? 'Day' : d === 7 ? 'Week' : 'Month'}
                    </button>
                  ))}
               </div>
            </div>
          </div>

          {/* Search/Notes (2 cols) */}
           <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Search</label>
             <div className="flex gap-2">
               <input 
                type="text" 
                placeholder="Order ID / Notes"
                className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={filters.notes}
                onChange={(e) => setFilters({...filters, notes: e.target.value})}
              />
             </div>
          </div>

          {/* Advanced Toggles Row (Full Width) */}
          <div className="md:col-span-12 flex items-center pt-2 border-t border-dashed border-gray-200 mt-1">
             <label className="flex items-center gap-2 cursor-pointer select-none group">
               <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.onlyWithBookings ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                 {filters.onlyWithBookings && <CheckCircle2 size={12} className="text-white" />}
                 <input type="checkbox" className="hidden" checked={filters.onlyWithBookings} onChange={e => setFilters({...filters, onlyWithBookings: e.target.checked})} />
               </div>
               <span className="text-xs font-medium text-slate-600 group-hover:text-blue-600">Show only vehicles with orders in view</span>
             </label>
          </div>

        </div>

        {/* KPI Dashboard Strip */}
        <div className="bg-slate-50 border-t border-gray-200 px-6 py-3 flex items-center gap-8">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <CheckCircle2 size={18} />
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Available Today</div>
                  <div className="text-lg font-bold text-slate-800 leading-none">{kpiData.available} <span className="text-sm font-normal text-gray-400">/ {filteredVehicles.length}</span></div>
               </div>
            </div>

            <div className="w-px h-8 bg-gray-200"></div>

             <div className="flex items-center gap-3">
               <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Clock size={18} />
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Utilization ({daysToShow}d)</div>
                  <div className="text-lg font-bold text-slate-800 leading-none">{kpiData.utilization}%</div>
               </div>
            </div>

            <div className="w-px h-8 bg-gray-200"></div>

             <div className="flex items-center gap-3">
               <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <BarChart3 size={18} />
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Dist. Std Dev</div>
                  <div className="text-lg font-bold text-slate-800 leading-none">{kpiData.stdDev}</div>
               </div>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-6 relative">
         <Timeline 
            groups={MOCK_GROUPS}
            vehicles={filteredVehicles}
            events={filteredEvents}
            startDate={addDays(currentDate, -1)} // Start slightly before for context
            daysToShow={daysToShow} 
            onEventClick={setSelectedEvent}
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
