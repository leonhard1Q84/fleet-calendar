import React from 'react';
import { X, User, Calendar, MapPin, Wrench, AlertTriangle, FileText, Lock } from 'lucide-react';
import { EventModalProps, EventType } from '../types';
import { EVENT_LABELS } from '../constants';

const EventDetailModal: React.FC<EventModalProps> = ({ event, onClose, getVehicle, getGroup }) => {
  if (!event) return null;

  const vehicle = getVehicle(event.vehicleId);
  const group = getGroup(event.groupId);

  // Format Date Helper
  const fmt = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Render different content based on event type
  const renderContent = () => {
    switch (event.type) {
      case EventType.BOOKING_ASSIGNED:
      case EventType.BOOKING_UNASSIGNED:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase font-bold">Res ID</label>
                <div className="font-mono text-lg font-semibold">{event.reservationId}</div>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase font-bold">Status</label>
                <div className="font-semibold text-blue-200">{event.status}</div>
              </div>
            </div>

            <div className="border-t border-gray-700 my-2 pt-2">
              <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2 mb-1">
                <User size={14} /> Customer
              </label>
              <div className="text-lg">{event.customerName}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2 mb-1">
                  <Calendar size={14} /> Pickup
                </label>
                <div>{fmt(event.startDate)}</div>
                <div className="text-sm text-gray-400">{event.pickupLocation}</div>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2 mb-1">
                  <Calendar size={14} /> Return
                </label>
                <div>{fmt(event.endDate)}</div>
                <div className="text-sm text-gray-400">{event.dropoffLocation}</div>
              </div>
            </div>
          </div>
        );

      case EventType.MAINTENANCE:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2 mb-1">
                  <Wrench size={14} /> Type
                </label>
                <div className="font-semibold text-orange-200">{event.maintenanceType}</div>
              </div>
              <div>
                 <label className="text-gray-400 text-xs uppercase font-bold">Cost Est.</label>
                 <div>${event.costEstimate}</div>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase font-bold">Mechanic/Shop</label>
              <div>{event.mechanic}</div>
            </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="text-gray-400 text-xs uppercase font-bold">Start</label>
                <div>{fmt(event.startDate)}</div>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase font-bold">Est. End</label>
                <div>{fmt(event.endDate)}</div>
              </div>
            </div>
          </div>
        );

      case EventType.STOP_SALE:
        return (
          <div className="space-y-4">
             <div>
                <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-red-400" /> Reason
                </label>
                <div className="text-red-100 font-semibold">{event.reason}</div>
            </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="text-gray-400 text-xs uppercase font-bold">From</label>
                <div>{fmt(event.startDate)}</div>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase font-bold">To</label>
                <div>{fmt(event.endDate)}</div>
              </div>
            </div>
          </div>
        );

      default: // BLOCK
         return (
          <div className="space-y-4">
             <div>
                <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2 mb-1">
                  <Lock size={14} /> Internal Hold
                </label>
                <div className="text-purple-200">{event.reason}</div>
            </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="text-gray-400 text-xs uppercase font-bold">Start</label>
                <div>{fmt(event.startDate)}</div>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase font-bold">End</label>
                <div>{fmt(event.endDate)}</div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-slate-900 text-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-700 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex justify-between items-start border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${event.type === EventType.BOOKING_UNASSIGNED ? 'bg-yellow-600' : 'bg-blue-600'}`}>
                {EVENT_LABELS[event.type]}
              </span>
              {vehicle ? (
                <span className="text-slate-300 text-sm font-mono">{vehicle.plate}</span>
              ) : (
                <span className="text-red-400 text-sm font-mono italic">Unassigned</span>
              )}
            </div>
            <h2 className="text-xl font-bold">{group?.name}</h2>
            {vehicle && <div className="text-sm text-slate-400">{vehicle.model} • {vehicle.color}</div>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {renderContent()}

          {event.notes && (
             <div className="mt-6 p-3 bg-slate-800 rounded border border-slate-700">
                <label className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2 mb-1">
                  <FileText size={14} /> Notes
                </label>
                <p className="text-sm text-slate-300">{event.notes}</p>
             </div>
          )}
        </div>

        {/* Footer Actions (Mock) */}
        <div className="bg-slate-800 px-6 py-4 flex justify-end gap-3 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded text-slate-300 hover:bg-slate-700 transition-colors text-sm">Close</button>
          <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">Edit Details</button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;