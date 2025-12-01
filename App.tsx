
import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import Timeline from './components/Timeline';
import EventDetailModal from './components/EventDetailModal';
import { MOCK_EVENTS, MOCK_GROUPS, MOCK_VEHICLES } from './constants';
import { FleetEvent } from './types';
import { addDays, subDays, format } from 'date-fns';

const App: React.FC = () => {
  // Global State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<FleetEvent | null>(null);

  // Filter States
  const [filters, setFilters] = useState({
    store: '',
    sipp: '',
    plate: '',
    status: '',
    notes: '',
    source: '',
    group: ''
  });

  const handleDatePrev = () => setCurrentDate(curr => subDays(curr, 7));
  const handleDateNext = () => setCurrentDate(curr => addDays(curr, 7));
  const handleToday = () => setCurrentDate(new Date());

  const handleReset = () => {
    setFilters({
      store: '',
      sipp: '',
      plate: '',
      status: '',
      notes: '',
      source: '',
      group: ''
    });
    setCurrentDate(new Date());
  };

  // Filter Logic
  const filteredVehicles = useMemo(() => {
    return MOCK_VEHICLES.filter(v => {
      const matchStore = !filters.store || v.storeId.includes(filters.store);
      const matchPlate = !filters.plate || v.plate.toLowerCase().includes(filters.plate.toLowerCase()) || v.model.toLowerCase().includes(filters.plate.toLowerCase());
      const matchGroup = !filters.group || v.groupId === filters.group;
      return matchStore && matchPlate && matchGroup;
    });
  }, [filters]);

  const filteredEvents = useMemo(() => {
    // In a real app, you'd filter events by status/notes here too.
    // For visual demo, we return all, but we could implement note filtering:
    if (!filters.notes) return MOCK_EVENTS;
    return MOCK_EVENTS.filter(e => e.notes?.toLowerCase().includes(filters.notes.toLowerCase()) || e.reservationId?.toLowerCase().includes(filters.notes.toLowerCase()));
  }, [filters.notes]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* Header / Filter Section */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 shadow-sm z-30 flex-shrink-0">
        
        {/* Breadcrumb / Title */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
           <span className="hover:text-blue-600 cursor-pointer">Home</span>
           <span>/</span>
           <span className="font-semibold text-slate-800">Fleet Schedule</span>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          
          {/* Store */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Store</label>
            <div className="relative">
              <select 
                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded text-sm appearance-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
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

          {/* SIPP Code */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">SIPP / Group</label>
             <div className="relative">
              <select 
                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded text-sm appearance-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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

           {/* Plate/Model */}
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Plate / Model</label>
            <input 
              type="text" 
              placeholder="e.g. Toyota or HH003"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={filters.plate}
              onChange={(e) => setFilters({...filters, plate: e.target.value})}
            />
          </div>

           {/* Time Range (With Nav) */}
           <div className="flex flex-col gap-1 xl:col-span-2">
            <label className="text-xs font-semibold text-gray-500">Schedule Range</label>
            <div className="flex items-center gap-2">
               <div className="relative flex-1 flex items-center bg-white border border-gray-200 rounded px-2 py-1.5">
                  <Calendar size={14} className="text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700 font-medium tabular-nums">{format(currentDate, 'yyyy-MM-dd')}</span>
                  <span className="mx-2 text-gray-400 text-xs">to</span>
                  <span className="text-sm text-gray-700 font-medium tabular-nums">{format(addDays(currentDate, 21), 'yyyy-MM-dd')}</span>
               </div>
               
               <div className="flex items-center border border-gray-200 rounded bg-white">
                 <button onClick={handleDatePrev} className="p-2 hover:bg-gray-50 border-r border-gray-100 text-gray-600"><ChevronLeft size={16} /></button>
                 <button onClick={handleToday} className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 uppercase">Today</button>
                 <button onClick={handleDateNext} className="p-2 hover:bg-gray-50 border-l border-gray-100 text-gray-600"><ChevronRight size={16} /></button>
               </div>
            </div>
          </div>

          {/* Notes/Search */}
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Notes / Order ID</label>
             <div className="flex gap-2">
               <input 
                type="text" 
                placeholder="Search notes..."
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={filters.notes}
                onChange={(e) => setFilters({...filters, notes: e.target.value})}
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded shadow-sm transition-colors">
                <Search size={16} />
              </button>
              <button onClick={handleReset} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded transition-colors">
                <RotateCcw size={16} />
              </button>
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
            startDate={addDays(currentDate, -2)} // Start slightly before for context
            daysToShow={21} // 3 weeks view
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
