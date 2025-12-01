
import React, { useRef, useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, addDays, addHours, format, isSameDay, isWeekend, startOfDay } from 'date-fns';
import { CarGroup, Vehicle, FleetEvent, EventType } from '../types';
import { CELL_WIDTH, ROW_HEIGHT, HEADER_HEIGHT, getEventColor } from '../constants';
import { AlertCircle, Snowflake, ChevronLeft, ChevronRight, Eye, ArrowLeft } from 'lucide-react';

interface TimelineProps {
  groups: CarGroup[];
  vehicles: Vehicle[];
  events: FleetEvent[];
  startDate: Date;
  daysToShow: number;
  onEventClick: (event: FleetEvent) => void;
}

type ViewScale = 'day' | 'hour';

const Timeline: React.FC<TimelineProps> = ({ groups, vehicles, events, startDate: propStartDate, daysToShow, onEventClick }) => {
  // View State
  const [viewScale, setViewScale] = useState<ViewScale>('day');
  const [focusDate, setFocusDate] = useState<Date>(propStartDate);

  // If daysToShow is 1 (Day view mode), we might default to hour view or just show 1 big day column.
  // The user requirement says "Clicking a date header... switches to Hour View". 
  // So we keep 'day' scale by default even for 1 day, unless clicked.
  
  // Calculated properties based on scale
  const activeStartDate = viewScale === 'day' ? propStartDate : startOfDay(focusDate);
  const cellWidth = viewScale === 'day' ? CELL_WIDTH : 80; // Smaller cells for hours
  const columnsCount = viewScale === 'day' ? daysToShow : 24; // 24 hours
  
  // Generate columns (dates or hours)
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

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Switch to Hourly View
  const handleDateClick = (date: Date) => {
    if (viewScale === 'day') {
      setFocusDate(date);
      setViewScale('hour');
    }
  };

  const handleBackToDay = () => {
    setViewScale('day');
  };

  // Helper to calculate position and width
  const getEventStyle = (event: FleetEvent) => {
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
      width = Math.max(durationDays * cellWidth, 20);
    } else {
      const diffHours = differenceInHours(eventStart, activeStartDate) + eventStart.getMinutes() / 60;
      const durationHours = differenceInHours(eventEnd, eventStart) + (eventEnd.getMinutes() - eventStart.getMinutes()) / 60;
      
      left = diffHours * cellWidth;
      width = Math.max(durationHours * cellWidth, 20);
    }

    return {
      left: `${left}px`,
      width: `${width}px`,
      rawWidth: width,
      rawLeft: left
    };
  };

  // Organize Data
  const vehiclesByGroup = vehicles.reduce((acc, v) => {
    if (!acc[v.groupId]) acc[v.groupId] = [];
    acc[v.groupId].push(v);
    return acc;
  }, {} as Record<string, Vehicle[]>);

  const getEventsForVehicle = (vid: string) => events.filter(e => e.vehicleId === vid);
  const getUnassignedEventsForGroup = (gid: string) => events.filter(e => e.groupId === gid && !e.vehicleId);

  // Helper to format duration
  const getDurationLabel = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const days = differenceInDays(e, s);
    if (days < 1) {
       const hours = differenceInHours(e, s);
       return `${hours}h`;
    }
    return `${days}d`;
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded shadow-sm overflow-hidden select-none ring-1 ring-gray-950/5">
      
      {/* Top Sync Scrollbar */}
      <div 
        ref={topScrollContainerRef}
        onScroll={handleScrollTop}
        className="overflow-x-auto border-b border-gray-100 bg-gray-50/50 flex-shrink-0"
        style={{ height: '12px' }} 
      >
        <div style={{ width: totalContentWidth + 260, height: '1px' }}></div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Scrollable Main Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScrollMain}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`overflow-auto flex-1 timeline-scroll relative h-full flex cursor-${isDragging ? 'grabbing' : 'grab'}`}
        >
          {/* COLUMN 1: STICKY SIDEBAR (Vehicle List) */}
          <div className="sticky left-0 z-40 flex-shrink-0 w-[260px] bg-white border-r border-gray-200 pointer-events-auto">
             
             {/* Sticky Corner Header */}
             <div style={{ height: HEADER_HEIGHT }} className="sticky top-0 z-50 bg-gray-50 border-b border-gray-200 flex flex-col justify-end p-3 shadow-sm">
                <div className="flex justify-between items-center w-full text-xs font-bold text-gray-500 uppercase tracking-wider">
                   <span>Fleet / Resource</span>
                   <span>Group</span>
                </div>
                {viewScale === 'hour' && (
                   <button onClick={handleBackToDay} className="mt-2 text-xs flex items-center text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                     <ArrowLeft size={12} className="mr-1" /> Back to Days
                   </button>
                )}
             </div>
             
             {/* Rows Container */}
             <div className="divide-y divide-gray-100 bg-white">
               {groups.map(group => {
                 const groupVehicles = vehiclesByGroup[group.id] || [];
                 const unassignedEvents = getUnassignedEventsForGroup(group.id);
                 const hasUnassigned = unassignedEvents.length > 0;

                 return (
                   <div key={group.id}>
                     {/* Group Header */}
                     <div className="bg-slate-100/95 backdrop-blur-sm px-4 py-1.5 border-y border-gray-200 flex justify-between items-center sticky top-[80px] z-30 shadow-sm">
                       <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{group.name}</span>
                       <span className="text-[10px] bg-slate-200 px-1.5 rounded text-slate-600 font-mono">{group.code}</span>
                     </div>

                     {/* Queue Row */}
                     <div style={{ height: ROW_HEIGHT }} className="flex flex-col justify-center px-4 border-b border-gray-100 bg-stripes">
                       <div className="flex items-center gap-2">
                           <span className={`text-sm font-bold ${hasUnassigned ? "text-yellow-700" : "text-gray-400"}`}>Queue / 3rd Party</span>
                           {hasUnassigned && (
                               <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-yellow-200">
                                   <AlertCircle size={10} />
                                   {unassignedEvents.length}
                               </div>
                           )}
                       </div>
                       <div className="text-[10px] text-gray-400 mt-0.5">Unassigned or Outsourced</div>
                     </div>

                     {/* Vehicle Rows */}
                     {groupVehicles.map(v => (
                       <div key={v.id} style={{ height: ROW_HEIGHT }} className="flex flex-col justify-center px-4 border-b border-gray-50 hover:bg-blue-50/30 transition-colors relative border-l-4 border-l-transparent hover:border-l-blue-500 bg-white group">
                         <div className="flex items-baseline justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-800 font-mono group-hover:text-blue-700 transition-colors">{v.plate}</span>
                              {v.features?.includes('snow_tires') && (
                                <div className="text-sky-500" title="Snow Tires Equipped">
                                  <Snowflake size={12} />
                                </div>
                              )}
                            </div>
                            <span className={`w-2 h-2 rounded-full ${v.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                         </div>
                         <div className="flex items-center text-xs text-gray-500 mt-0.5 truncate">
                           <span className="truncate">{v.model}</span>
                           <span className="mx-1.5 text-gray-300">|</span>
                           <span className="text-gray-400">{v.storeId}</span>
                         </div>
                       </div>
                     ))}
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
                 const highlight = viewScale === 'day' && isSameDay(date, new Date());
                 
                 return (
                   <div 
                     key={i} 
                     style={{ width: cellWidth, minWidth: cellWidth }} 
                     className={`flex flex-col justify-center items-center border-r border-gray-100 h-full cursor-pointer hover:bg-slate-50 transition-colors group ${isSat || isSun ? 'bg-slate-50/50' : ''}`}
                     onClick={() => handleDateClick(date)}
                   >
                     {viewScale === 'day' ? (
                       <>
                         <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${highlight ? 'text-blue-600' : 'text-gray-400'}`}>
                           {format(date, 'EEE')}
                         </span>
                         <div className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${highlight ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-700 group-hover:bg-slate-200'}`}>
                           {format(date, 'd')}
                         </div>
                         <div className="text-[9px] text-gray-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Hourly</div>
                       </>
                     ) : (
                        <>
                          <span className="text-[10px] text-gray-400 font-medium mb-1">{format(date, 'EEE, MMM d')}</span>
                          <div className="text-sm font-bold text-slate-700">{format(date, 'HH:mm')}</div>
                        </>
                     )}
                   </div>
                 );
               })}
            </div>

            {/* Grid Body */}
            <div className="relative pointer-events-none">
              {/* Vertical Grid Lines */}
              <div className="absolute inset-0 flex z-0">
                {columns.map((d, i) => (
                  <div 
                    key={i} 
                    style={{ width: cellWidth, minWidth: cellWidth }} 
                    className={`border-r border-gray-100 h-full ${viewScale === 'day' && isWeekend(d) ? 'bg-slate-50/30' : ''}`} 
                  />
                ))}
              </div>

              {/* Rows & Events */}
              <div className="relative z-0">
                 {groups.map(group => {
                    const groupVehicles = vehiclesByGroup[group.id] || [];
                    const unassignedEvents = getUnassignedEventsForGroup(group.id);

                    return (
                      <div key={group.id}>
                        {/* Header Spacer */}
                        <div className="h-[31px] w-full border-y border-transparent bg-slate-50/50 sticky top-[80px] z-20"></div>
                        
                        {/* Queue Row */}
                        <div style={{ height: ROW_HEIGHT }} className="relative w-full border-b border-transparent">
                           {unassignedEvents.map(event => {
                             const { left, width, rawWidth, rawLeft } = getEventStyle(event);
                             const isCroppedLeft = rawLeft < 0;
                             const isCroppedRight = rawLeft + rawWidth > totalContentWidth;
                             const colorClass = getEventColor(event);

                             return (
                               <div
                                 key={event.id}
                                 onClick={() => onEventClick(event)}
                                 className={`absolute top-2 bottom-2 rounded px-2 py-1 flex items-center pointer-events-auto cursor-pointer hover:brightness-95 transition-all ${colorClass}`}
                                 style={{ left, width }}
                               >
                                  {isCroppedLeft && <ChevronLeft size={12} className="absolute left-1" />}
                                  <span className="text-xs font-semibold whitespace-nowrap truncate mx-3">{event.customerName || 'Unknown'}</span>
                                  {isCroppedRight && <ChevronRight size={12} className="absolute right-1" />}
                               </div>
                             );
                           })}
                        </div>

                        {/* Vehicle Rows */}
                        {groupVehicles.map(v => {
                          const vehicleEvents = getEventsForVehicle(v.id);
                          return (
                            <div key={v.id} style={{ height: ROW_HEIGHT }} className="relative w-full border-b border-transparent">
                               {vehicleEvents.map(event => {
                                 const { left, width, rawWidth, rawLeft } = getEventStyle(event);
                                 const isTiny = rawWidth < 40;
                                 const isSmall = rawWidth < 100;
                                 const isCroppedLeft = rawLeft < 0; 
                                 const isCroppedRight = rawLeft + rawWidth > totalContentWidth;
                                 const colorClass = getEventColor(event);

                                 return (
                                   <div
                                    key={event.id}
                                    onClick={() => onEventClick(event)}
                                    className={`absolute top-2 bottom-2 rounded pointer-events-auto cursor-pointer flex flex-col justify-center px-2 overflow-hidden hover:brightness-95 transition-all ${colorClass}`}
                                    style={{ left, width }}
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
                                              <div className="text-[9px] opacity-90 truncate mt-1 flex items-center gap-1">
                                                <span>{format(new Date(event.startDate), 'HH:mm')}</span>
                                                <span>•</span>
                                                <span>{getDurationLabel(event.startDate, event.endDate)}</span>
                                                <span>•</span>
                                                <span className="truncate">{event.pickupLocation || event.mechanic}</span>
                                              </div>
                                           )}
                                           {!isSmall && event.notes && (
                                             <div className="text-[8px] opacity-75 truncate mt-0.5 italic">
                                               "{event.notes}"
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
      
      {/* Footer / Legend */}
      <div className="border-t border-gray-200 bg-white px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] flex-shrink-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
         
         {/* Group: Reservation */}
         <div className="flex items-center gap-3">
            <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Reservation:</span>
            <div className="flex items-center gap-1.5" title="Pending Allocation">
               <span className="w-2.5 h-2.5 bg-yellow-500 rounded-sm"></span>
               <span className="text-gray-600">Pending</span>
            </div>
            <div className="flex items-center gap-1.5" title="Vehicle Assigned">
               <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span>
               <span className="text-gray-600">Assigned</span>
            </div>
             <div className="flex items-center gap-1.5" title="Vehicle Picked Up">
               <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span>
               <span className="text-gray-600">Picked Up</span>
            </div>
         </div>

         <div className="w-px h-3 bg-gray-300"></div>

         {/* Group: Maintenance */}
         <div className="flex items-center gap-3">
            <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Maint:</span>
             <div className="flex items-center gap-1.5" title="In Progress">
               <span className="w-2.5 h-2.5 bg-slate-600 rounded-sm"></span>
               <span className="text-gray-600">Active</span>
            </div>
         </div>

         <div className="w-px h-3 bg-gray-300"></div>

         {/* Group: Stop Sale */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Stop Sale:</span>
             <div className="flex items-center gap-1.5">
               <span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span>
               <span className="text-gray-600">Active</span>
            </div>
         </div>

         <div className="w-px h-3 bg-gray-300"></div>

          {/* Group: Block */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Block:</span>
             <div className="flex items-center gap-1.5">
               <span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span>
               <span className="text-gray-600">Active</span>
            </div>
         </div>

         <div className="w-px h-3 bg-gray-300"></div>

          {/* Group: History */}
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5">
               <span className="w-2.5 h-2.5 bg-slate-200 rounded-sm border border-slate-300"></span>
               <span className="text-gray-500 font-medium">History / Released</span>
            </div>
         </div>

         <div className="w-px h-3 bg-gray-300"></div>

         {/* Extra */}
         <div className="flex items-center gap-2">
            <Snowflake size={12} className="text-sky-500" />
            <span className="text-gray-600">Snow Tires</span>
         </div>

         <div className="flex-1 text-right text-gray-400 text-[10px]">
           {viewScale === 'day' ? `${daysToShow} Day View` : `Hourly View: ${format(focusDate, 'MMM d, yyyy')}`}
         </div>
      </div>

      <style>{`
        .bg-stripes {
          background-image: linear-gradient(45deg,rgba(255,255,255,1) 25%,rgba(243,244,246,1) 25%,rgba(243,244,246,1) 50%,rgba(255,255,255,1) 50%,rgba(255,255,255,1) 75%,rgba(243,244,246,1) 75%,rgba(243,244,246,1) 100%);
          background-size: 10px 10px;
        }
      `}</style>
    </div>
  );
};

export default Timeline;
