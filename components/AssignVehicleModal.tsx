
import React, { useState } from 'react';
import { X, Check, Car } from 'lucide-react';
import { Vehicle, CarGroup, FleetEvent } from '../types';

interface AssignVehicleModalProps {
  isOpen: boolean;
  event: FleetEvent | null;
  vehicles: Vehicle[];
  groups: CarGroup[];
  onClose: () => void;
  onConfirm: (vehicleId: string) => void;
}

const AssignVehicleModal: React.FC<AssignVehicleModalProps> = ({ 
  isOpen, 
  event, 
  vehicles, 
  groups, 
  onClose, 
  onConfirm 
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  if (!isOpen || !event) return null;

  const handleConfirm = () => {
    if (selectedVehicleId) {
      onConfirm(selectedVehicleId);
      setSelectedVehicleId('');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-sm rounded-lg shadow-xl overflow-hidden border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-gray-700 font-bold text-base">分配车辆 (Assign Vehicle)</h3>
          <p className="text-xs text-gray-400 mt-1">Order: {event.reservationId}</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">请选择车辆:</label>
            <div className="relative">
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-700 appearance-none"
              >
                <option value="">-- 请选择 (Select) --</option>
                {groups.map(group => {
                  const groupVehicles = vehicles.filter(v => v.groupId === group.id && !v.isVirtual);
                  if (groupVehicles.length === 0) return null;
                  return (
                    <optgroup key={group.id} label={group.name}>
                      {groupVehicles.map(v => (
                        <option key={v.id} value={v.id}>
                           {v.plate} - {v.model} ({v.status})
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <Car size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedVehicleId}
            className={`px-4 py-2 rounded text-sm font-medium text-white flex items-center gap-2 transition-colors ${!selectedVehicleId ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignVehicleModal;
