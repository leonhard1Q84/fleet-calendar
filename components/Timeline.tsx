import React, { useRef, useState, useMemo } from 'react';
import { differenceInDays, differenceInHours, addDays, addHours, format, isSameDay, isWeekend, startOfDay } from 'date-fns';
import { CarGroup, Vehicle, FleetEvent, EventType } from '../types';
import { CELL_WIDTH, CELL_WIDTH_HOUR, ROW_HEIGHT_STD, EVENT_HEIGHT, EVENT_GAP, HEADER_HEIGHT, getEventColor, checkOverlap } from '../constants';
import { Snowflake, ChevronLeft, ChevronRight, Eye, Layers } from 'lucide-react';

interface TimelineProps {
  groups: CarGroup[];
  vehicles: Vehicle[];
  events: FleetEvent[];
  startDate: Date;
  daysToShow: number;
  viewScale: 'day' | 'hour';
  onEventClick: (event: FleetEvent) => void;
  onDateClick: (date: Date) => void;
  selectedStatusFilters?: string[];
  toggleStatusFilter?: (key: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({ 
  groups, 
  vehicles, 
  events, 
  startDate: propStartDate, 
  daysToShow, 
  viewScale,
  onEventClick,
  onDateClick,
  selectedStatusFilters = [],
  toggleStatusFilter = (_: string) => {},
}) => {
  
  // Calculated properties based on scale
  const activeStartDate = viewScale === 'day' ? propStartDate : startOfDay(propStartDate);
  const cellWidth = viewScale === 'day' ? CELL_WIDTH : CELL_WIDTH_HOUR; 
  const columnsCount = viewScale === 'day' ? daysToShow : 24; 
  
  const columns = Array.from({ length: columnsCount }, (_, i) => {
    if (viewScale === 'day') return addDays(activeStartDate, i);
    return addHours(activeStartDate, i);
  });

  const totalContentWidth = columnsCount * cellWidth;

  // Scroll State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topScrollContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // --- LAYOUT ENGINE: STACKING LOGIC ---
  
  // 1. Group vehicles
  const vehiclesByGroup = useMemo(() => vehicles.reduce((acc, v) => {
    if (!acc[v.groupId]) acc[v.groupId] = [];
    acc[v.groupId].push(v);
    return acc;
  }, {} as Record<string, Vehicle[]>), [vehicles]);

  // 2. Identify Unique Pending Queues (Model + Location)
  const pendingQueuesByGroup = useMemo(() => {
    const map = new Map<string, string[]>(); // groupId -> ["Toyota Yaris|Asakusabashi", "Honda Fit|Haneda"]
    
    groups.forEach(g => {
       const groupPendingEvents = events.filter(e => e.groupId === g.id && e.type === EventType.BOOKING_UNASSIGNED);
       const uniqueKeys = new Set<string>();
       groupPendingEvents.forEach(e => {
         const key = `${e.modelPreference || 'Unknown Model'}|${e.pickupLocation || 'Unknown Loc'}`;
         uniqueKeys.add(key);
       });
       map.set(g.id, Array.from(uniqueKeys));
    });
    return map;
  }, [events, groups]);

  // 3. Pre-calculate layout for every row (Queue and Vehicles)
  // Returns a Map of key (vehicleId or 'queue_groupId_key') -> { height: number, lanes: Event[][] }
  const rowLayouts = useMemo(() => {
    const layouts = new Map<string, { height: number, eventsWithLanes: (FleetEvent & { laneIndex: number })[] }>();

    const computeLanes = (rowEvents: FleetEvent[], isInfinite: boolean) => {
      // If not infinite/virtual, we don't stack visually (or we just let them overlap absolutely). 
      if (!isInfinite) {
         return {
           height: ROW_HEIGHT_STD,
           eventsWithLanes: rowEvents.map(e => ({ ...e, laneIndex: 0 }))
         };
      }

      // Sort by start time
      const sorted = [...rowEvents].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const lanes: FleetEvent[][] = [];
      const eventsWithLanes: (FleetEvent & { laneIndex: number })[] = [];

      sorted.forEach(ev => {
        let placed = false;
        // Try to find a lane where this event fits
        for (let i = 0; i < lanes.length; i++) {
          const lastEvent = lanes[i][lanes[i].length - 1];
          if (!checkOverlap(ev.startDate, ev.endDate, lastEvent.startDate, lastEvent.endDate)) {
             // If we want to append, we need ev.start >= lastEvent.end.
             if (new Date(ev.startDate) >= new Date(lastEvent.endDate)) {
                lanes[i].push(ev);
                eventsWithLanes.push({ ...ev, laneIndex: i });
                placed = true;
                break;
             }
          }
        }
        if (!placed) {
          lanes.push([ev]);
          eventsWithLanes.push({ ...ev, laneIndex: lanes.length - 1 });
        }
      });

      const laneCount = Math.max(1, lanes.length);
      // Dynamic Height: Padding Top (10) + Lanes * (Height + Gap) + Padding Bottom (10)
      const dynamicHeight = 12 + (laneCount * (EVENT_HEIGHT + EVENT_GAP)) + 12;
      
      return {
        height: Math.max(ROW_HEIGHT_STD, dynamicHeight),
        eventsWithLanes
      };
    };

    groups.forEach(g => {
       // A. Queue Layouts (Split by key)
       const queueKeys = pendingQueuesByGroup.get(g.id) || [];
       queueKeys.forEach(key => {
          const [model, loc] = key.split('|');
          const queueEvents = events.filter(e => 
            e.groupId === g.id && 
            e.type === EventType.BOOKING_UNASSIGNED && 
            (e.modelPreference || 'Unknown Model') === model && 
            (e.pickupLocation || 'Unknown Loc') === loc
          );
          layouts.set(`queue_${g.id}_${key}`, computeLanes(queueEvents, true));
       });

       // B. Vehicle Layouts
       const groupVehicles = vehiclesByGroup[g.id] || [];
       groupVehicles.forEach(v => {
         const vEvents = events.filter(e => e.vehicleId === v.id);
         layouts.set(v.id, computeLanes(vEvents, !!v.isVirtual));
       });
    });

    return layouts;
  }, [events, groups, vehicles, vehiclesByGroup, pendingQueuesByGroup]);


  // Sync scroll handlers
  const handleScrollMain = () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (topScrollContainerRef.current && scrollContainerRef.current) {
      topScrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
    isSyncingRef.current = false;
  };

  const handleScrollTop = () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (scrollContainerRef.current && topScrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = topScrollContainerRef.current.scrollLeft;
    }
    isSyncingRef.current = false;
  };

  // Drag to Scroll Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    if ((e.target as HTMLElement).closest('.pointer-events-auto')) return;
    
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Helper to calculate position and width
  const getEventStyle = (event: FleetEvent, laneIndex: number) => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    
    let left = 0;
    let width = 0;

    if (viewScale === 'day') {
      const diffDays = differenceInDays(eventStart, activeStartDate);
      const startOffsetHours = (eventStart.getHours() + eventStart.getMinutes() / 60) / 24;
      const endOffsetHours = (eventEnd.getHours() + eventEnd.getMinutes() / 60) / 24;
      const durationDays = differenceInDays(eventEnd, eventStart) + (endOffsetHours - startOffsetHours);
      
      left = (diffDays + startOffsetHours) * cellWidth;
      width = Math.max(durationDays * cellWidth, 4); // Min width check
    } else {
      const diffHours = differenceInHours(eventStart, activeStartDate) + eventStart.getMinutes() / 60;
      const durationHours = differenceInHours(eventEnd, eventStart) + (eventEnd.getMinutes() - eventStart.getMinutes()) / 60;
      
      left = diffHours * cellWidth;
      width = Math.max(durationHours * cellWidth, 4);
    }
    
    const top = 10 + (laneIndex * (EVENT_HEIGHT + EVENT_GAP));

    return {
      left: `${left}px`,
      width: `${width}px`,
      top: `${top}px`,
      height: `${EVENT_HEIGHT}px`,
      rawWidth: width,
      rawLeft: left
    };
  };

  // View Info String
  const viewInfo = useMemo(() => {
     if (viewScale === 'hour') {
         return format(activeStartDate, 'MMMM d, yyyy');
     }
     const endDate = addDays(activeStartDate, daysToShow);
     return `${format(activeStartDate, 'MMM d')} - ${format(endDate, 'MMM d')} (${daysToShow} Days)`;
  }, [activeStartDate, daysToShow, viewScale]);

  // Helper for legend opacity
  const getLegendClass = (key: string) => {
     if (selectedStatusFilters.length === 0) return 'opacity-100 hover:brightness-95';
     return selectedStatusFilters.includes(key) 
        ? 'opacity-100 ring-1 ring-offset-1 ring-blue-400 shadow-sm' 
        : 'opacity-40 grayscale hover:opacity-70 transition-all';
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden select-none ring-1 ring-gray-950/5">
      
      {/* Top Sync Scrollbar */}
      <div 
        ref={topScrollContainerRef}
        onScroll={handleScrollTop}
        className="overflow-x-auto border-b border-gray-100 bg-gray-50/50 flex-shrink-0"
        style={{ height: '10px' }} 
      >
        <div style={{ width: totalContentWidth + 260, height: '1px' }}></div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Scrollable Main Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScrollMain}
          onMouseDown={handleMouseDown}
          onMouseLeave={() => setIsDragging(false)}
          onMouseUp={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
          className={`overflow-auto flex-1 timeline-scroll relative h-full flex cursor-${isDragging ? 'grabbing' : 'grab'}`}
        >
          {/* COLUMN 1: STICKY SIDEBAR (Vehicle List) */}
          <div className="sticky left-0 z-40 flex-shrink-0 w-[260px] bg-white border-r border-gray-200 pointer-events-auto shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
             
             {/* Sticky Corner Header */}
             <div style={{ height: HEADER_HEIGHT }} className="sticky top-0 z-50 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resource</span>
                  {/* Small Legend for Vehicle Status */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1" title="Active Fleet">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="text-[9px] text-gray-500">Act</span>
                    </div>
                    <div className="flex items-center gap-1" title="Maintenance/Stopped">
                       <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                       <span className="text-[9px] text-gray-500">Stop</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Group</span>
             </div>
             
             {/* Rows Container */}
             <div className="bg-white">
               {groups.map(group => {
                 const groupVehicles = vehiclesByGroup[group.id] || [];
                 const realVehicles = groupVehicles.filter(v => !v.isVirtual);
                 const virtualVehicles = groupVehicles.filter(v => !!v.isVirtual);
                 const queueKeys = pendingQueuesByGroup.get(group.id) || [];

                 return (
                   <div key={group.id}>
                     {/* Group Header */}
                     <div className="bg-slate-50 px-4 py-1.5 border-y border-gray-200 flex justify-between items-center sticky top-[54px] z-30 shadow-sm" style={{ top: HEADER_HEIGHT }}>
                       <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{group.name}</span>
                     </div>

                     {/* 1. Queue Rows (Split by Model/Location) */}
                     {queueKeys.map(key => {
                        const [model, loc] = key.split('|');
                        const layout = rowLayouts.get(`queue_${group.id}_${key}`);
                        const count = layout?.eventsWithLanes.length || 0;

                        return (
                            <div key={key} style={{ height: layout?.height }} className="flex flex-col justify-center px-4 border-b border-gray-100 bg-stripes transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-amber-800 truncate pr-2">{model}</span>
                                    {count > 0 && (
                                        <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200 whitespace-nowrap">
                                            <Layers size={10} />
                                            {count}
                                        </div>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5 truncate">{loc}</div>
                            </div>
                        );
                     })}

                     {/* 2. Virtual / 3rd Party Rows (Infinite Capacity) */}
                     {virtualVehicles.map(v => {
                       const layout = rowLayouts.get(v.id);
                       const activeCount = layout?.eventsWithLanes.length || 0;
                       
                       return (
                        <div key={v.id} style={{ height: layout?.height }} className="flex flex-col justify-center px-4 border-b border-gray-100 bg-slate-50/60 hover:bg-blue-50/20 transition-colors relative border-l-4 border-l-transparent group">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <span className="text-sm font-mono font-bold text-slate-600 italic">
                                 {v.plate}
                               </span>
                             </div>
                             {activeCount > 0 && (
                                 <span className="text-[9px] bg-slate-200 px-1.5 rounded-full text-slate-600 font-bold">{activeCount} Assigned</span>
                             )}
                          </div>
                        </div>
                       );
                     })}

                     {/* 3. Real Vehicle Rows */}
                     {realVehicles.map(v => {
                       const layout = rowLayouts.get(v.id);
                       return (
                        <div key={v.id} style={{ height: layout?.height }} className="flex flex-col justify-center px-4 border-b border-gray-50 hover:bg-blue-50/20 transition-colors relative border-l-4 border-l-transparent hover:border-l-blue-500 bg-white group">
                          <div className="flex items-baseline justify-between">
                             <div className="flex items-center gap-2">
                               <span className="text-sm font-mono font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                                 {v.plate}
                               </span>
                               {v.features?.includes('snow_tires') && (
                                 <div className="text-sky-500" title="Snow Tires Equipped">
                                   <Snowflake size={12} />
                                 </div>
                               )}
                             </div>
                             <span className={`w-2 h-2 rounded-full ${v.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-0.5 truncate justify-between">
                            <div className="flex items-center truncate">
                                <span className="truncate">{v.model}</span>
                                <span className="mx-1.5 text-gray-300">|</span>
                                <span className="text-gray-400">{v.storeId}</span>
                            </div>
                            {/* MOVED SIPP TAG HERE */}
                            {v.sipp && <span className="text-[9px] bg-gray-100 text-gray-500 border border-gray-200 px-1 rounded font-mono ml-2">{v.sipp}</span>}
                          </div>
                        </div>
                       );
                     })}
                   </div>
                 );
               })}
             </div>
          </div>

          {/* COLUMN 2: TIMELINE GRID */}
          <div className="flex-grow relative" style={{ minWidth: totalContentWidth }}>
            
            {/* Sticky Date Header */}
            <div style={{ height: HEADER_HEIGHT }} className="sticky top-0 z-30 bg-white border-b border-gray-200 flex shadow-sm">
               {columns.map((date, i) => {
                 const isSat = isWeekend(date) && date.getDay() === 6;
                 const isSun = isWeekend(date) && date.getDay() === 0;
                 const isToday = isSameDay(date, new Date());
                 
                 return (
                   <div 
                     key={i} 
                     style={{ width: cellWidth, minWidth: cellWidth }} 
                     className={`flex flex-col justify-center items-center border-r border-gray-100 h-full cursor-pointer hover:bg-slate-50 transition-colors group 
                        ${isSat || isSun ? 'bg-slate-100' : ''} 
                        ${isToday ? 'bg-blue-50/50 border-b-2 border-b-blue-500' : ''}
                     `}
                     onClick={() => onDateClick(date)}
                   >
                     {viewScale === 'day' ? (
                        <div className="flex flex-col items-center justify-center">
                            <span className={`text-[10px] uppercase font-bold tracking-wider leading-tight ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                              {format(date, 'EEE')}
                            </span>
                            <span className={`text-xl font-bold leading-none mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                              {format(date, 'd')}
                            </span>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center leading-none">
                           <span className="text-[9px] text-gray-400 font-medium mb-0.5">{format(date, 'EEE d')}</span>
                           <span className="text-xs font-bold text-slate-700">{format(date, 'HH:mm')}</span>
                        </div>
                     )}
                   </div>
                 );
               })}
            </div>

            {/* Grid Body */}
            <div className="relative pointer-events-none">
              {/* Vertical Grid Lines */}
              <div className="absolute inset-0 flex z-0">
                {columns.map((d, i) => {
                  const isToday = isSameDay(d, new Date());
                  return (
                    <div 
                        key={i} 
                        style={{ width: cellWidth, minWidth: cellWidth }} 
                        className={`border-r border-gray-100 h-full 
                            ${viewScale === 'day' && isWeekend(d) ? 'bg-slate-100' : ''}
                            ${isToday ? 'bg-blue-50/10 border-r-blue-200 border-l border-l-blue-200' : ''}
                        `} 
                    />
                  );
                })}
              </div>

              {/* Rows & Events */}
              <div className="relative z-0">
                 {groups.map(group => {
                    const groupVehicles = vehiclesByGroup[group.id] || [];
                    const realVehicles = groupVehicles.filter(v => !v.isVirtual);
                    const virtualVehicles = groupVehicles.filter(v => !!v.isVirtual);
                    const queueKeys = pendingQueuesByGroup.get(group.id) || [];

                    return (
                      <div key={group.id}>
                        {/* Header Spacer */}
                        <div className="h-[29px] w-full border-y border-transparent bg-slate-50/50 sticky top-[54px] z-20" style={{ top: HEADER_HEIGHT }}></div>
                        
                        {/* 1. Queue Row Events (Rendered First - Split) */}
                        {queueKeys.map(key => {
                            const layout = rowLayouts.get(`queue_${group.id}_${key}`);
                            return (
                                <div key={key} style={{ height: layout?.height }} className="relative w-full border-b border-transparent transition-all duration-300">
                                {layout?.eventsWithLanes.map(event => {
                                    const { left, width, top, height, rawWidth, rawLeft } = getEventStyle(event, event.laneIndex);
                                    const isCroppedLeft = rawLeft < 0;
                                    const isCroppedRight = rawLeft + rawWidth > totalContentWidth;
                                    const colorClass = getEventColor(event);

                                    return (
                                    <div
                                        key={event.id}
                                        onClick={() => onEventClick(event)}
                                        className={`absolute rounded-sm px-2 flex items-center pointer-events-auto cursor-pointer hover:brightness-95 transition-all shadow-sm ${colorClass}`}
                                        style={{ left, width, top, height }}
                                    >
                                        {isCroppedLeft && <ChevronLeft size={12} className="absolute left-1" />}
                                        <div className="flex flex-col overflow-hidden w-full">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold truncate opacity-90 leading-none">
                                                    {event.modelPreference || 'Unknown Model'}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-medium whitespace-nowrap truncate opacity-80 mt-0.5">{event.customerName}</span>
                                        </div>
                                        {isCroppedRight && <ChevronRight size={12} className="absolute right-1" />}
                                    </div>
                                    );
                                })}
                                </div>
                            );
                        })}

                        {/* 2. Virtual Vehicle Rows Events */}
                        {virtualVehicles.map(v => {
                          const layout = rowLayouts.get(v.id);
                          return (
                            <div key={v.id} style={{ height: layout?.height }} className="relative w-full border-b border-transparent transition-all duration-300">
                               {layout?.eventsWithLanes.map(event => {
                                 const { left, width, top, height, rawWidth, rawLeft } = getEventStyle(event, event.laneIndex);
                                 const colorClass = getEventColor(event);

                                 return (
                                   <div
                                    key={event.id}
                                    onClick={() => onEventClick(event)}
                                    className={`absolute rounded-sm pointer-events-auto cursor-pointer flex flex-col justify-center px-2 overflow-hidden hover:brightness-95 transition-all shadow-sm ${colorClass}`}
                                    style={{ left, width, top, height }}
                                   >
                                      <div className="flex flex-col leading-none">
                                          <span className="text-[11px] font-bold truncate">{event.customerName}</span>
                                          <span className="text-[9px] opacity-90 truncate mt-1">{event.pickupLocation}</span>
                                      </div>
                                   </div>
                                 );
                               })}
                            </div>
                          )
                        })}

                        {/* 3. Real Vehicle Rows Events */}
                        {realVehicles.map(v => {
                          const layout = rowLayouts.get(v.id);
                          return (
                            <div key={v.id} style={{ height: layout?.height }} className="relative w-full border-b border-transparent transition-all duration-300">
                               {layout?.eventsWithLanes.map(event => {
                                 const { left, width, top, height, rawWidth, rawLeft } = getEventStyle(event, event.laneIndex);
                                 const isTiny = rawWidth < 40;
                                 const isSmall = rawWidth < 100;
                                 const isCroppedLeft = rawLeft < 0; 
                                 const isCroppedRight = rawLeft + rawWidth > totalContentWidth;
                                 const colorClass = getEventColor(event);

                                 return (
                                   <div
                                    key={event.id}
                                    onClick={() => onEventClick(event)}
                                    className={`absolute rounded-sm pointer-events-auto cursor-pointer flex flex-col justify-center px-2 overflow-hidden hover:brightness-95 transition-all shadow-sm ${colorClass}`}
                                    style={{ left, width, top, height }}
                                    title={`${event.customerName || 'Event'} - ${event.notes || ''}`}
                                   >
                                      {isCroppedLeft && <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/10 to-transparent flex items-center justify-center"><ChevronLeft size={10} className="text-white drop-shadow-md" /></div>}
                                      {isCroppedRight && <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-black/10 to-transparent flex items-center justify-center"><ChevronRight size={10} className="text-white drop-shadow-md" /></div>}

                                      {isTiny ? (
                                        <div className="flex justify-center"><Eye size={14} /></div>
                                      ) : (
                                        <div className={`flex flex-col leading-none ${isCroppedLeft ? 'pl-2' : ''} ${isCroppedRight ? 'pr-2' : ''}`}>
                                           <div className="flex items-center gap-1">
                                             <span className="text-[11px] font-bold truncate">
                                                {event.type === EventType.MAINTENANCE ? event.maintenanceType : 
                                                 event.type === EventType.STOP_SALE ? event.reason :
                                                 event.customerName}
                                             </span>
                                           </div>
                                           {!isSmall && (
                                              <div className="text-[9px] opacity-90 truncate mt-1 flex items-center gap-1 font-medium">
                                                <span>{format(new Date(event.startDate), 'HH:mm')}</span>
                                                <span className="opacity-50">|</span>
                                                <span className="truncate">{event.pickupLocation || event.mechanic}</span>
                                              </div>
                                           )}
                                        </div>
                                      )}
                                   </div>
                                 );
                               })}
                            </div>
                          )
                        })}
                      </div>
                    );
                 })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Interactive Footer / Legend */}
      <div className="border-t border-gray-200 bg-white px-4 py-2 flex flex-wrap items-center justify-between gap-y-2 text-[11px] flex-shrink-0 z-30">
         
         <div className="flex items-center gap-6">
            {/* Group: Reservation */}
            <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Orders</span>
                
                <button onClick={() => toggleStatusFilter('PENDING')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('PENDING')}`}>
                   <span className="w-2.5 h-2.5 bg-amber-400 rounded-sm"></span>
                   <span className="text-gray-600 font-medium">Pending</span>
                </button>

                <button onClick={() => toggleStatusFilter('ASSIGNED')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('ASSIGNED')}`}>
                   <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span>
                   <span className="text-gray-600 font-medium">Assigned</span>
                </button>

                 <button onClick={() => toggleStatusFilter('PICKED_UP')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('PICKED_UP')}`}>
                   <span className="w-2.5 h-2.5 bg-indigo-600 rounded-sm"></span>
                   <span className="text-gray-600 font-medium">Picked Up</span>
                </button>
            </div>

            <div className="w-px h-3 bg-gray-300"></div>

            {/* Group: Non-Revenue */}
            <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Non-Rev</span>
                
                 <button onClick={() => toggleStatusFilter('MAINT')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('MAINT')}`}>
                   <span className="w-2.5 h-2.5 bg-slate-600 rounded-sm"></span>
                   <span className="text-gray-600 font-medium">Maint</span>
                </button>

                <button onClick={() => toggleStatusFilter('STOP')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('STOP')}`}>
                   <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span>
                   <span className="text-gray-600 font-medium">Stop</span>
                </button>

                 <button onClick={() => toggleStatusFilter('BLOCK')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('BLOCK')}`}>
                   <span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span>
                   <span className="text-gray-600 font-medium">Block</span>
                </button>
            </div>
         </div>
         
         <div className="flex items-center gap-4 text-gray-400 text-[10px]">
           <span className="font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{viewInfo}</span>
           <span>Use <span className="font-bold text-gray-500">Shift + Wheel</span> to scroll horizontally</span>
         </div>
      </div>

      <style>{`
        .bg-stripes {
          background-image: linear-gradient(45deg,rgba(0,0,0,0.02) 25%,transparent 25%,transparent 50%,rgba(0,0,0,0.02) 50%,rgba(0,0,0,0.02) 75%,transparent 75%,transparent 100%);
          background-size: 8px 8px;
        }
      `}</style>
    </div>
  );
};

export default Timeline;