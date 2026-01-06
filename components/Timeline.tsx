
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { differenceInDays, differenceInHours, addDays, addHours, format, isSameDay, isWeekend, startOfDay, addMinutes } from 'date-fns';
import { CarGroup, Vehicle, FleetEvent, EventType } from '../types';
import { CELL_WIDTH, CELL_WIDTH_HOUR, ROW_HEIGHT_STD, EVENT_HEIGHT, EVENT_GAP, HEADER_HEIGHT, getEventColor, checkOverlap } from '../constants';
import { Snowflake, ChevronLeft, ChevronRight, Layers, NotepadText, ArrowRight, Signal, Share2, Milestone, ChevronDown, Lock, ArrowLeftRight } from 'lucide-react';

interface TimelineProps {
  groups: CarGroup[];
  vehicles: Vehicle[];
  events: FleetEvent[];
  startDate: Date;
  daysToShow: number;
  viewScale: 'day' | 'hour';
  onEventClick: (event: FleetEvent) => void;
  onDateClick: (date: Date) => void;
  onRangeSelect?: (vehicle: Vehicle, start: Date, end: Date) => void;
  onEventMove?: (eventId: string, newVehicleId: string, newStart?: string, newEnd?: string) => void;
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
  onRangeSelect,
  onEventMove,
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

  // Sidebar Width
  const SIDEBAR_WIDTH = 200;
  const totalContentWidth = columnsCount * cellWidth;

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topScrollContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  // --- STATE ---
  // Collapsed Groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Drag Scroll State
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [scrollStartLeft, setScrollStartLeft] = useState(0);

  // Drag Selection State (Create New Event)
  const [dragSelection, setDragSelection] = useState<{
    vehicleId: string;
    startX: number;
    currentX: number;
    isDragging: boolean;
  } | null>(null);

  // --- HANDLERS ---

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // --- LAYOUT ENGINE ---
  
  // 1. Group vehicles
  const vehiclesByGroup = useMemo(() => vehicles.reduce((acc, v) => {
    if (!acc[v.groupId]) acc[v.groupId] = [];
    acc[v.groupId].push(v);
    return acc;
  }, {} as Record<string, Vehicle[]>), [vehicles]);

  // 2. Identify Unique Pending Queues
  const pendingQueuesByGroup = useMemo(() => {
    const map = new Map<string, string[]>(); 
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

  // 3. Pre-calculate row layouts
  const rowLayouts = useMemo(() => {
    const layouts = new Map<string, { height: number, eventsWithLanes: (FleetEvent & { laneIndex: number })[] }>();

    const computeLanes = (rowEvents: FleetEvent[], isInfinite: boolean) => {
      if (!isInfinite) {
         return {
           height: ROW_HEIGHT_STD,
           eventsWithLanes: rowEvents.map(e => ({ ...e, laneIndex: 0 }))
         };
      }
      const sorted = [...rowEvents].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const lanes: FleetEvent[][] = [];
      const eventsWithLanes: (FleetEvent & { laneIndex: number })[] = [];

      sorted.forEach(ev => {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
          const lastEvent = lanes[i][lanes[i].length - 1];
          if (!checkOverlap(ev.startDate, ev.endDate, lastEvent.startDate, lastEvent.endDate)) {
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
      const dynamicHeight = 12 + (laneCount * (EVENT_HEIGHT + EVENT_GAP)) + 12;
      return { height: Math.max(ROW_HEIGHT_STD, dynamicHeight), eventsWithLanes };
    };

    groups.forEach(g => {
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
       const groupVehicles = vehiclesByGroup[g.id] || [];
       groupVehicles.forEach(v => {
         const vEvents = events.filter(e => e.vehicleId === v.id);
         layouts.set(v.id, computeLanes(vEvents, !!v.isVirtual));
       });
    });
    return layouts;
  }, [events, groups, vehicles, vehiclesByGroup, pendingQueuesByGroup]);

  // --- SCROLL SYNC ---
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

  // --- DRAG LOGIC (Create & Scroll) ---
  
  // Helper: Get Grid-Relative X
  const getGridRelativeX = (clientX: number) => {
      if (!scrollContainerRef.current) return 0;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      // Formula: MousePos - ContainerStart + ScrollAmount - SidebarWidth
      return clientX - rect.left + scrollLeft - SIDEBAR_WIDTH;
  };

  const handleMouseDownScroll = (e: React.MouseEvent) => {
    // Only drag-scroll on Shift+Click or if clicking header (optional)
    if (!e.shiftKey) return;
    if (!scrollContainerRef.current) return;

    setIsDraggingScroll(true);
    setScrollStartX(e.pageX);
    setScrollStartLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleRowMouseDown = (e: React.MouseEvent, vehicleId: string) => {
      if (e.button !== 0 || e.shiftKey) return; // Ignore right click or shift-click
      if ((e.target as HTMLElement).closest('.event-bar')) return; // Ignore click on events

      e.stopPropagation();
      
      const startX = Math.max(0, getGridRelativeX(e.clientX));
      
      setDragSelection({
          vehicleId,
          startX,
          currentX: startX,
          isDragging: true
      });
  };

  // Global Mouse Listeners for Dragging
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
        // 1. Drag Create
        if (dragSelection?.isDragging) {
            const currentX = Math.max(0, getGridRelativeX(e.clientX));
            setDragSelection(prev => prev ? ({ ...prev, currentX }) : null);
            return;
        }

        // 2. Drag Scroll
        if (isDraggingScroll && scrollContainerRef.current) {
            e.preventDefault();
            const walk = (e.pageX - scrollStartX) * 1.5; // Scroll speed multiplier
            scrollContainerRef.current.scrollLeft = scrollStartLeft - walk;
        }
    };

    const handleWindowMouseUp = () => {
        // End Drag Create
        if (dragSelection?.isDragging && onRangeSelect) {
             const { vehicleId, startX, currentX } = dragSelection;
             const leftX = Math.min(startX, currentX);
             const rightX = Math.max(startX, currentX);
             const width = rightX - leftX;

             if (width > 20) { // Min width threshold to trigger creation
                const startDate = getDateFromX(leftX);
                const endDate = getDateFromX(rightX);
                const vehicle = vehicles.find(v => v.id === vehicleId);
                if (vehicle) {
                    onRangeSelect(vehicle, startDate, endDate);
                }
             }
        }

        setDragSelection(null);
        setIsDraggingScroll(false);
    };

    if (isDraggingScroll || dragSelection?.isDragging) {
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingScroll, dragSelection, scrollStartX, scrollStartLeft, onRangeSelect, vehicles, viewScale, activeStartDate, cellWidth]);


  // Helper: X to Date
  const getDateFromX = (x: number): Date => {
      if (viewScale === 'day') {
          const totalDays = x / cellWidth;
          const days = Math.floor(totalDays);
          const remainder = totalDays - days;
          const result = addDays(activeStartDate, days);
          return addMinutes(result, remainder * 24 * 60);
      } else {
          const totalHours = x / cellWidth;
          const hours = Math.floor(totalHours);
          const remainder = totalHours - hours;
          const result = addHours(activeStartDate, hours);
          return addMinutes(result, remainder * 60);
      }
  };

  // --- STATS HELPER ---
  const getDailyUtilization = (date: Date) => {
    if (viewScale !== 'day') return null;

    // Denominator: Active Fleet (Not virtual, not backup)
    const activeVehicles = vehicles.filter(v => !v.isVirtual && v.status !== 'backup');
    const total = activeVehicles.length;
    if (total === 0) return 0;

    // Numerator: Occupied (Has Booking Assigned overlapping this day)
    const dayStart = startOfDay(date);
    const dayEnd = addMinutes(addDays(dayStart, 1), -1);
    const startStr = dayStart.toISOString();
    const endStr = dayEnd.toISOString();

    let occupied = 0;
    activeVehicles.forEach(v => {
       const vEvents = events.filter(e => e.vehicleId === v.id && e.type === EventType.BOOKING_ASSIGNED);
       const isOccupied = vEvents.some(e => checkOverlap(e.startDate, e.endDate, startStr, endStr));
       if (isOccupied) occupied++;
    });

    return ((occupied / total) * 100).toFixed(2);
  };

  // --- RENDER HELPERS ---
  const getEventStyle = (event: FleetEvent, laneIndex: number) => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    
    let left = 0, width = 0;

    if (viewScale === 'day') {
      const diffDays = differenceInDays(eventStart, activeStartDate);
      const startOffsetHours = (eventStart.getHours() + eventStart.getMinutes() / 60) / 24;
      const endOffsetHours = (eventEnd.getHours() + eventEnd.getMinutes() / 60) / 24;
      const durationDays = differenceInDays(eventEnd, eventStart) + (endOffsetHours - startOffsetHours);
      left = (diffDays + startOffsetHours) * cellWidth;
      width = Math.max(durationDays * cellWidth, 4); 
    } else {
      const diffHours = differenceInHours(eventStart, activeStartDate) + eventStart.getMinutes() / 60;
      const durationHours = differenceInHours(eventEnd, eventStart) + (eventEnd.getMinutes() - eventStart.getMinutes()) / 60;
      left = diffHours * cellWidth;
      width = Math.max(durationHours * cellWidth, 4);
    }
    
    const top = 5 + (laneIndex * (EVENT_HEIGHT + EVENT_GAP));

    return {
      left: `${left}px`,
      width: `${width}px`,
      top: `${top}px`,
      height: `${EVENT_HEIGHT}px`,
      rawWidth: width,
      rawLeft: left
    };
  };

  const renderEventBar = (event: FleetEvent, laneIndex: number) => {
     const { left, width, top, height, rawWidth, rawLeft } = getEventStyle(event, laneIndex);
     const isTiny = rawWidth < 60;
     const isCroppedLeft = rawLeft < 0; 
     const isCroppedRight = rawLeft + rawWidth > totalContentWidth;
     const colorClass = getEventColor(event);
     const hasNotes = event.notes && event.notes.length > 0;
     const isLocked = !!event.isLocked;
     const isMaintenance = event.type === EventType.MAINTENANCE;

     const t = (d: string) => format(new Date(d), 'HH:mm');
     const s = new Date(event.startDate);
     const e = new Date(event.endDate);
     const diffHrs = differenceInHours(e, s);
     const diffDays = Math.ceil(diffHrs / 24);
     const durationLabel = diffHrs < 24 ? `${diffHrs}h` : `${diffDays}d`;

     const assignedVehicle = vehicles.find(v => v.id === event.vehicleId);
     const isOneWay = event.pickupLocation && event.dropoffLocation && (event.pickupLocation !== event.dropoffLocation);
     const isCrossStore = assignedVehicle && !assignedVehicle.isVirtual && event.pickupLocation && !event.pickupLocation.includes(assignedVehicle.storeId);
     const isDraggable = !isLocked && !isMaintenance;

     let tooltip = `${event.type === EventType.BOOKING_ASSIGNED ? (event.reservationId || 'Res') : event.type} | ${durationLabel}`;
     if (isLocked) tooltip += ` | Locked`;

     return (
        <div
            key={event.id}
            draggable={isDraggable}
            onDragStart={(e) => {
                if (!isDraggable) { e.preventDefault(); return; }
                e.dataTransfer.setData('eventId', event.id);
                e.dataTransfer.setData('originalVehicleId', event.vehicleId || '');
            }}
            onDragOver={(e) => e.preventDefault()} // Allow dragging over other events? Usually no, but standard DnD needs it.
            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
            className={`absolute rounded-sm pointer-events-auto cursor-pointer flex items-center px-1.5 overflow-hidden hover:brightness-95 transition-all shadow-sm ${colorClass} event-bar z-10 hover:z-20 ${!isDraggable ? 'cursor-default' : ''}`}
            style={{ left, width, top, height }}
            title={tooltip}
        >
            {isCroppedLeft && <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/20 to-transparent flex items-center justify-center z-10"><ChevronLeft size={12} className="text-white drop-shadow-md" /></div>}
            {isCroppedRight && <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-black/20 to-transparent flex items-center justify-center z-10"><ChevronRight size={12} className="text-white drop-shadow-md" /></div>}

            {isTiny ? (
                <div className="flex w-full justify-center items-center">
                    {isLocked && <Lock size={10} className="text-white/80" />}
                    {!isLocked && <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-sm"></div>}
                </div>
            ) : (
                <div className={`flex flex-row items-center gap-2 w-full h-full text-[10px] whitespace-nowrap leading-none ${isCroppedLeft ? 'pl-2' : ''} ${isCroppedRight ? 'pr-2' : ''}`}>
                    {isLocked && <div title="Locked" className="text-white/90"><Lock size={10} /></div>}
                    {isCrossStore && <div title="Cross-store" className="bg-white/90 text-pink-600 rounded-full p-0.5 shadow-sm"><Share2 size={10} /></div>}
                    {hasNotes && <NotepadText size={11} className="flex-shrink-0 opacity-90" />}
                    
                    <div className="flex items-center gap-1.5 truncate">
                         <span className="font-bold">{event.reservationId || event.maintenanceType || event.reason}</span>
                         <span className="opacity-60">|</span>
                         <span className="font-medium truncate">{event.pickupLocation || event.mechanic}</span>
                         <span className="font-mono opacity-80 bg-white/20 px-1 rounded-sm">({durationLabel})</span>
                    </div>
                </div>
            )}
        </div>
     );
  };

  const getLegendClass = (key: string) => {
     if (selectedStatusFilters.length === 0) return 'opacity-100 hover:brightness-95';
     return selectedStatusFilters.includes(key) ? 'opacity-100 ring-1 ring-offset-1 ring-blue-400 shadow-sm' : 'opacity-40 grayscale';
  };

  const viewInfo = useMemo(() => {
     const endDate = addDays(activeStartDate, daysToShow);
     return `${format(activeStartDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
  }, [activeStartDate, daysToShow]);


  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden select-none ring-1 ring-gray-950/5">
      
      {/* Top Sync Scrollbar */}
      <div 
        ref={topScrollContainerRef}
        onScroll={handleScrollTop}
        className="overflow-x-auto border-b border-gray-100 bg-gray-50/50 flex-shrink-0"
        style={{ height: '10px' }} 
      >
        <div style={{ width: totalContentWidth + SIDEBAR_WIDTH, height: '1px' }}></div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div 
          ref={scrollContainerRef}
          onScroll={handleScrollMain}
          onMouseDown={handleMouseDownScroll}
          className={`overflow-auto flex-1 timeline-scroll relative h-full flex cursor-${isDraggingScroll ? 'grabbing' : 'default'}`}
        >
          {/* COLUMN 1: SIDEBAR */}
          <div 
             className="sticky left-0 z-40 flex-shrink-0 bg-white border-r border-gray-200 pointer-events-auto shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]" 
             style={{ width: SIDEBAR_WIDTH }}
          >
             <div style={{ height: HEADER_HEIGHT }} className="sticky top-0 z-50 bg-white border-b border-gray-200 flex items-center justify-between px-3 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resource</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span className="text-[9px] text-gray-500">Avail</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span><span className="text-[9px] text-gray-500">Back</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Group</span>
             </div>
             
             <div className="bg-white">
               {groups.map(group => {
                 const groupVehicles = vehiclesByGroup[group.id] || [];
                 const realVehicles = groupVehicles.filter(v => !v.isVirtual);
                 const virtualVehicles = groupVehicles.filter(v => !!v.isVirtual);
                 const queueKeys = pendingQueuesByGroup.get(group.id) || [];
                 const isCollapsed = collapsedGroups.has(group.id);

                 return (
                   <div key={group.id}>
                     <div 
                        className="bg-slate-50 px-3 py-1.5 border-y border-gray-200 flex items-center justify-between sticky top-[54px] z-30 shadow-sm cursor-pointer hover:bg-slate-100 transition-colors" 
                        style={{ top: HEADER_HEIGHT }}
                        onClick={() => toggleGroup(group.id)}
                     >
                       <span className="font-bold text-slate-700 text-xs uppercase tracking-wide truncate">{group.name}</span>
                       <div className="text-gray-500">{isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</div>
                     </div>
                     
                     {!isCollapsed && (
                        <div className="bg-white relative z-20"> {/* Explicit background and Z to avoid holes */}
                            {queueKeys.map(key => {
                                const [model, loc] = key.split('|');
                                const layout = rowLayouts.get(`queue_${group.id}_${key}`);
                                const count = layout?.eventsWithLanes.length || 0;
                                return (
                                    <div key={key} style={{ height: layout?.height }} className="flex flex-col justify-center px-3 border-b border-gray-100 bg-amber-50/30">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-amber-800 truncate pr-2">{model}</span>
                                            {count > 0 && <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200 whitespace-nowrap"><Layers size={10} />{count}</div>}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">{loc}</div>
                                    </div>
                                );
                            })}
                            
                            {/* VIRTUAL VEHICLES (SWAP BUFFER) - Styled differently */}
                            {virtualVehicles.map(v => {
                                const layout = rowLayouts.get(v.id);
                                return (
                                    <div key={v.id} style={{ height: layout?.height }} className="flex flex-col justify-center px-3 border-b border-gray-100 bg-gray-50/40 relative">
                                        <div className="absolute inset-x-2 inset-y-2 border-2 border-dashed border-gray-200 rounded flex items-center justify-center">
                                            <div className="flex items-center gap-1.5 text-gray-400">
                                                <ArrowLeftRight size={12} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Swap Buffer</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {realVehicles.map(v => {
                                const layout = rowLayouts.get(v.id);
                                return (
                                    <div 
                                        key={v.id} 
                                        style={{ height: layout?.height }} 
                                        className="flex flex-col justify-center px-3 border-b border-gray-50 hover:bg-blue-50/20 transition-colors relative border-l-4 border-l-transparent hover:border-l-blue-500 bg-white"
                                    >
                                        <div className="flex items-baseline justify-between">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-sm font-mono font-semibold text-gray-800 group-hover:text-blue-700 transition-colors truncate">{v.plate}</span>
                                                <div className="flex items-center">
                                                    {v.features?.includes('snow_tires') && <Snowflake size={11} className="text-sky-400 ml-0.5" />}
                                                    {v.features?.includes('telematics') && <Signal size={11} className="text-indigo-500 ml-0.5" />}
                                                </div>
                                            </div>
                                            <span className={`w-2 h-2 flex-shrink-0 rounded-full ${v.status === 'available' ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5 truncate">{v.model}</div>
                                    </div>
                                );
                            })}
                        </div>
                     )}
                   </div>
                 );
               })}
             </div>
          </div>

          {/* COLUMN 2: GRID */}
          <div className="flex-grow relative" style={{ minWidth: totalContentWidth }}>
            
            {/* Header */}
            <div style={{ height: HEADER_HEIGHT }} className="sticky top-0 z-30 bg-white border-b border-gray-200 flex shadow-sm">
               {columns.map((date, i) => {
                 const isSat = isWeekend(date) && date.getDay() === 6;
                 const isSun = isWeekend(date) && date.getDay() === 0;
                 const isToday = isSameDay(date, new Date());
                 const utilization = getDailyUtilization(date);

                 return (
                   <div 
                     key={i} 
                     style={{ width: cellWidth, minWidth: cellWidth }} 
                     className={`flex flex-col justify-center items-center border-r border-gray-100 h-full cursor-pointer hover:bg-slate-50 transition-colors ${isSat || isSun ? 'bg-slate-100' : ''} ${isToday ? 'bg-blue-50/50 border-b-2 border-b-blue-500' : ''}`}
                     onClick={() => onDateClick(date)}
                   >
                     {viewScale === 'day' ? (
                        <div className="flex flex-col items-center justify-center">
                            <span className={`text-[10px] uppercase font-bold tracking-wider leading-tight ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{format(date, 'EEE')}</span>
                            <span className={`text-xl font-bold leading-none mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{format(date, 'd')}</span>
                            
                            {/* Daily Utilization Stats */}
                            {utilization !== null && (
                                <div className={`mt-1 text-[10px] font-bold ${Number(utilization) < 50 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    {utilization}%
                                </div>
                            )}
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

            {/* Body */}
            <div className="relative pointer-events-none">
              <div className="absolute inset-0 flex z-0">
                {columns.map((d, i) => (
                    <div key={i} style={{ width: cellWidth, minWidth: cellWidth }} className={`border-r border-gray-100 h-full ${viewScale === 'day' && isWeekend(d) ? 'bg-slate-100' : ''} ${isSameDay(d, new Date()) ? 'bg-blue-50/10' : ''}`} />
                ))}
              </div>

              <div className="relative z-0">
                 {groups.map(group => {
                    const groupVehicles = vehiclesByGroup[group.id] || [];
                    const realVehicles = groupVehicles.filter(v => !v.isVirtual);
                    const virtualVehicles = groupVehicles.filter(v => !!v.isVirtual);
                    const queueKeys = pendingQueuesByGroup.get(group.id) || [];
                    const isCollapsed = collapsedGroups.has(group.id);

                    return (
                      <div key={group.id}>
                        <div className="h-[29px] w-full border-y border-transparent bg-slate-50/50 sticky top-[54px] z-20" style={{ top: HEADER_HEIGHT }}></div>
                        {!isCollapsed && (
                            <>
                                {queueKeys.map(key => {
                                    const layout = rowLayouts.get(`queue_${group.id}_${key}`);
                                    return (
                                        <div key={key} style={{ height: layout?.height }} className="relative w-full border-b border-transparent pointer-events-auto">
                                           {layout?.eventsWithLanes.map(event => renderEventBar(event, event.laneIndex))}
                                        </div>
                                    );
                                })}
                                
                                {/* VIRTUAL VEHICLES (SWAP BUFFER) GRID */}
                                {virtualVehicles.map(v => {
                                    const layout = rowLayouts.get(v.id);
                                    return (
                                        <div 
                                            key={v.id} 
                                            style={{ height: layout?.height }} 
                                            className="relative w-full border-b border-gray-100 pointer-events-auto bg-stripes bg-gray-50/30" 
                                            onDragOver={(e) => {e.preventDefault(); e.dataTransfer.dropEffect = 'move'}} 
                                            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('eventId'); if(id && onEventMove) onEventMove(id, v.id); }}
                                        >
                                           {layout?.eventsWithLanes.map(event => renderEventBar(event, event.laneIndex))}
                                        </div>
                                    )
                                })}

                                {realVehicles.map(v => {
                                    const layout = rowLayouts.get(v.id);
                                    const isSelectedRow = dragSelection?.vehicleId === v.id;
                                    return (
                                        <div 
                                            key={v.id} 
                                            style={{ height: layout?.height }} 
                                            className="relative w-full border-b border-transparent pointer-events-auto cursor-crosshair hover:bg-blue-50/10"
                                            onDragOver={(e) => {e.preventDefault(); e.dataTransfer.dropEffect = 'move'}} 
                                            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('eventId'); if(id && onEventMove) onEventMove(id, v.id); }}
                                            onMouseDown={(e) => handleRowMouseDown(e, v.id)}
                                        >
                                           {layout?.eventsWithLanes.map(event => renderEventBar(event, event.laneIndex))}
                                           {isSelectedRow && dragSelection && (
                                                <div 
                                                    className="absolute bg-blue-500/30 border border-blue-500/50 rounded-sm z-50 pointer-events-none"
                                                    style={{
                                                        top: 4, bottom: 4,
                                                        left: Math.min(dragSelection.startX, dragSelection.currentX),
                                                        width: Math.abs(dragSelection.currentX - dragSelection.startX),
                                                    }} 
                                                >
                                                    <div className="text-[10px] text-blue-800 font-bold p-1">New</div>
                                                </div>
                                           )}
                                        </div>
                                    )
                                })}
                            </>
                        )}
                      </div>
                    );
                 })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend Footer */}
      <div className="border-t border-gray-200 bg-white px-4 py-2 flex flex-wrap items-center justify-between gap-y-2 text-[11px] flex-shrink-0 z-30">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Orders</span>
                <button onClick={() => toggleStatusFilter('PENDING')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('PENDING')}`}><span className="w-2.5 h-2.5 bg-amber-400 rounded-sm"></span><span className="text-gray-600 font-medium">Pending</span></button>
                <button onClick={() => toggleStatusFilter('ASSIGNED')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('ASSIGNED')}`}><span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span><span className="text-gray-600 font-medium">Assigned</span></button>
                <button onClick={() => toggleStatusFilter('PICKED_UP')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('PICKED_UP')}`}><span className="w-2.5 h-2.5 bg-indigo-600 rounded-sm"></span><span className="text-gray-600 font-medium">Picked Up</span></button>
            </div>
            <div className="w-px h-3 bg-gray-300"></div>
            <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Non-Rev</span>
                <button onClick={() => toggleStatusFilter('MAINT')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('MAINT')}`}><span className="w-2.5 h-2.5 bg-slate-600 rounded-sm"></span><span className="text-gray-600 font-medium">Maint</span></button>
                <button onClick={() => toggleStatusFilter('STOP')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('STOP')}`}><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span><span className="text-gray-600 font-medium">Stop</span></button>
                <button onClick={() => toggleStatusFilter('BLOCK')} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${getLegendClass('BLOCK')}`}><span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span><span className="text-gray-600 font-medium">Block</span></button>
            </div>
         </div>
         <div className="flex items-center gap-4 text-gray-400 text-[10px]">
           <span className="font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{viewInfo}</span>
           <span>Use <span className="font-bold text-gray-500">Shift + Drag</span> to scroll. Drag empty space to create block.</span>
         </div>
      </div>
      
      <style>{`.bg-stripes { background-image: linear-gradient(45deg,rgba(0,0,0,0.02) 25%,transparent 25%,transparent 50%,rgba(0,0,0,0.02) 50%,rgba(0,0,0,0.02) 75%,transparent 75%,transparent 100%); background-size: 8px 8px; }`}</style>
    </div>
  );
};

export default Timeline;
