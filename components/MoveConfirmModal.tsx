
import React from 'react';
import { ArrowRight, AlertCircle, Check, X, ArrowLeftRight } from 'lucide-react';
import { FleetEvent, Vehicle } from '../types';

interface MoveConfirmModalProps {
  isOpen: boolean;
  event: FleetEvent | null;
  targetVehicle: Vehicle | null;
  sourceVehicle: Vehicle | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

const MoveConfirmModal: React.FC<MoveConfirmModalProps> = ({ 
  isOpen, 
  event, 
  targetVehicle, 
  sourceVehicle,
  onConfirm, 
  onCancel 
}) => {
  if (!isOpen || !event || !targetVehicle) return null;

  const isToBuffer = targetVehicle.isVirtual;
  const isFromBuffer = sourceVehicle?.isVirtual;
  const isOneWay = event.pickupLocation && event.dropoffLocation && (event.pickupLocation !== event.dropoffLocation);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-100 scale-100 transition-transform"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600">
             <ArrowLeftRight size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Confirm Move</h3>
            <p className="text-xs text-gray-500">Are you sure you want to reassign this event?</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
           {/* Event Summary */}
           <div className={`p-3 rounded-lg border flex items-center gap-3 ${isOneWay ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex-1">
                 <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Booking</div>
                 <div className="font-bold text-gray-800 text-sm">{event.reservationId || 'Event'}</div>
                 <div className="text-xs text-gray-600 mt-0.5">{event.customerName}</div>
              </div>
              {isOneWay && (
                  <div className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded border border-purple-200">
                    One-Way
                  </div>
              )}
           </div>

           {/* Visualization of Move */}
           <div className="flex items-center justify-between px-2">
              {/* From */}
              <div className="flex flex-col items-center w-1/3 text-center">
                 <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">From</div>
                 <div className={`p-2 w-full rounded border text-sm font-semibold truncate ${isFromBuffer ? 'bg-gray-100 border-dashed border-gray-300 text-gray-500' : 'bg-white border-gray-200 text-gray-700'}`}>
                    {sourceVehicle ? (sourceVehicle.isVirtual ? 'Swap Buffer' : sourceVehicle.plate) : 'Unassigned'}
                 </div>
                 {sourceVehicle && !sourceVehicle.isVirtual && <div className="text-[10px] text-gray-400 mt-1">{sourceVehicle.model}</div>}
              </div>

              <div className="text-gray-400">
                <ArrowRight size={20} />
              </div>

              {/* To */}
              <div className="flex flex-col items-center w-1/3 text-center">
                 <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">To</div>
                 <div className={`p-2 w-full rounded border text-sm font-semibold truncate ${isToBuffer ? 'bg-amber-50 border-dashed border-amber-300 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                    {isToBuffer ? 'Swap Buffer' : targetVehicle.plate}
                 </div>
                 {!isToBuffer && <div className="text-[10px] text-gray-400 mt-1">{targetVehicle.model}</div>}
              </div>
           </div>

           {isToBuffer && (
             <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-3 rounded text-xs">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>Moving to <strong>Swap Buffer</strong> indicates this vehicle assignment is temporary or pending a physical swap. The capacity is infinite.</p>
             </div>
           )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-800 hover:shadow-sm transition-all flex items-center gap-1.5"
          >
            <X size={16} /> Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all flex items-center gap-1.5"
          >
            <Check size={16} /> Confirm Move
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveConfirmModal;
