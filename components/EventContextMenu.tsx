
import React, { useEffect, useRef } from 'react';
import { Lock, Unlock, Eye, FilePenLine, ArrowRightLeft, Car } from 'lucide-react';
import { FleetEvent } from '../types';

interface EventContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  event: FleetEvent | null;
  onClose: () => void;
  onAction: (action: 'LOCK' | 'DETAILS' | 'NOTES' | 'ASSIGN', event: FleetEvent) => void;
}

const EventContextMenu: React.FC<EventContextMenuProps> = ({ 
  isOpen, 
  position, 
  event, 
  onClose, 
  onAction 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  // Calculate position
  const style: React.CSSProperties = {
    top: position.y + 5,
    left: position.x,
  };

  const isLocked = !!event.isLocked;

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-[70] bg-white rounded shadow-xl border border-gray-100 w-48 py-1 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-sm"
    >
      <div className="flex flex-col">
        <button 
          onClick={() => onAction('DETAILS', event)}
          className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-3 transition-colors"
        >
          <span>查看详情</span>
        </button>

        <button 
          onClick={() => onAction('ASSIGN', event)}
          className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-3 transition-colors"
        >
          <span>分配车辆</span>
        </button>

        <button 
          onClick={() => onAction('NOTES', event)}
          className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-3 transition-colors"
        >
          <span>订单备注</span>
        </button>

        <div className="h-px bg-gray-100 mx-2 my-1"></div>

        <button 
          onClick={() => onAction('LOCK', event)}
          className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-3 transition-colors"
        >
          <span>{isLocked ? '解锁订单' : '锁定订单'}</span>
        </button>
      </div>
    </div>
  );
};

export default EventContextMenu;
