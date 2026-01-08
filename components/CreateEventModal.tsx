
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, Wrench, ShieldCheck, Lock } from 'lucide-react';
import { Vehicle, EventType, FleetEvent } from '../types';
import { differenceInDays, differenceInHours, format } from 'date-fns';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (eventData: Partial<FleetEvent>) => void;
  initialData: {
    vehicle: Vehicle;
    startDate: Date;
    endDate: Date;
  } | null;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onConfirm, initialData }) => {
  const [type, setType] = useState<'INTERNAL' | 'MAINTENANCE' | 'OPERATIONS'>('MAINTENANCE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // Initialize form when data changes
  useEffect(() => {
    if (isOpen && initialData) {
      // Format for datetime-local input: YYYY-MM-DDThh:mm
      setStartDate(format(initialData.startDate, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(initialData.endDate, "yyyy-MM-dd'T'HH:mm"));
      setType('MAINTENANCE');
      setNotes('');
    }
  }, [isOpen, initialData]);

  if (!isOpen || !initialData) return null;

  const { vehicle } = initialData;

  // Calculate Duration Display
  const getDurationString = () => {
    if (!startDate || !endDate) return '-';
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
    if (end <= start) return 'Invalid Range';

    const diffDays = differenceInDays(end, start);
    const diffHours = differenceInHours(end, start) % 24;
    
    if (diffDays === 0) return `${diffHours} hours`;
    return `${diffDays} days ${diffHours > 0 ? `${diffHours} hours` : ''}`;
  };

  const handleConfirm = () => {
    if (!startDate || !endDate) return;

    // Map local type to EventType
    let eventType = EventType.BLOCK;
    let reason = 'Internal Use';
    let maintType = undefined;

    switch (type) {
      case 'INTERNAL':
        eventType = EventType.BLOCK;
        reason = 'Internal Use'; // 内部使用
        break;
      case 'MAINTENANCE':
        eventType = EventType.MAINTENANCE;
        maintType = 'Repair/Maintenance'; // 维修/保养
        break;
      case 'OPERATIONS':
        eventType = EventType.BLOCK;
        reason = 'Operation Lock'; // 运营锁定
        break;
    }

    const newEvent: Partial<FleetEvent> = {
      type: eventType,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      reason: eventType === EventType.BLOCK ? reason : undefined,
      maintenanceType: maintType,
      status: 'Active',
      notes: notes,
      vehicleId: vehicle.id,
      groupId: vehicle.groupId,
      isLocked: type === 'OPERATIONS' // Auto-lock for operational holds
    };

    onConfirm(newEvent);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div 
        className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800">新建预占 (Create Block)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Vehicle Info */}
          <div className="flex justify-between items-start bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">预占车辆 (Vehicle)</label>
              <div className="font-semibold text-gray-800 text-sm mt-0.5">{vehicle.model} <span className="text-gray-400 font-normal">({vehicle.plate})</span></div>
            </div>
            <div className="text-right">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">所属门店 (Store)</label>
              <div className="font-medium text-gray-700 text-sm mt-0.5">{vehicle.storeId}</div>
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-3 block">预占类型 (Type)</label>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setType('MAINTENANCE')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === 'MAINTENANCE' ? 'bg-orange-50 border-orange-500 text-orange-700 ring-1 ring-orange-500' : 'bg-white border-gray-200 hover:border-orange-300 text-gray-600'}`}
              >
                <Wrench size={20} className="mb-2" />
                <span className="text-xs font-medium">Repair/Maint</span>
                <span className="text-[10px] text-gray-400 scale-90">维修/保养</span>
              </button>

              <button 
                onClick={() => setType('INTERNAL')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === 'INTERNAL' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300 text-gray-600'}`}
              >
                <AlertCircle size={20} className="mb-2" />
                <span className="text-xs font-medium">Internal Use</span>
                <span className="text-[10px] text-gray-400 scale-90">内部使用</span>
              </button>
              
              <button 
                onClick={() => setType('OPERATIONS')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === 'OPERATIONS' ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500' : 'bg-white border-gray-200 hover:border-purple-300 text-gray-600'}`}
              >
                <Lock size={20} className="mb-2" />
                <span className="text-xs font-medium">Ops Lock</span>
                <span className="text-[10px] text-gray-400 scale-90">运营锁定</span>
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                 <Calendar size={12} /> 占用起始日期 (Start)
               </label>
               <input 
                 type="datetime-local" 
                 value={startDate}
                 onChange={e => setStartDate(e.target.value)}
                 className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-gray-50 focus:bg-white"
               />
            </div>
            <div className="space-y-1.5">
               <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                 <Clock size={12} /> 占用结束时间 (End)
               </label>
               <input 
                 type="datetime-local" 
                 value={endDate}
                 onChange={e => setEndDate(e.target.value)}
                 className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-gray-50 focus:bg-white"
               />
            </div>
          </div>

          {/* Duration Display */}
          <div className="bg-slate-50 p-2.5 rounded-md flex items-center justify-between border border-gray-200">
             <span className="text-xs font-bold text-gray-500">占用时长 (Duration)</span>
             <span className="text-sm font-mono font-semibold text-slate-700">{getDurationString()}</span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">备注 (Notes)</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="请输入备注 / Enter notes..."
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-gray-50 focus:bg-white"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:border-gray-300 border border-transparent transition-all"
          >
            取消 (Cancel)
          </button>
          <button 
            onClick={handleConfirm}
            className="px-6 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all flex items-center gap-2"
          >
            <ShieldCheck size={16} />
            确认 (Confirm)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEventModal;
