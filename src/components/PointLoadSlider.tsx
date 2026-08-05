// ============================================================
// Point Load Slider — Interactive position control below diagram
// ============================================================
import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { PointLoad } from '../types';

interface Props {
  pointLoads: PointLoad[];
  spanL: number;
  onChange: (id: string, x: number) => void;
  onChangeP: (id: string, P: number) => void;
}

const COLORS = ['#dc2626', '#7c3aed', '#0891b2', '#ca8a04', '#16a34a'];

export const PointLoadSlider: React.FC<Props> = ({ pointLoads, spanL, onChange, onChangeP }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const getXFromMouse = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const ratio = Math.max(0.01, Math.min(0.99, relX / rect.width));
    return ratio * spanL;
  }, [spanL]);

  const handleMouseDown = useCallback((id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(id);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = getXFromMouse(e);
      onChange(dragging, Math.round(newX * 100) / 100);
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, getXFromMouse, onChange]);

  if (pointLoads.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <span className="w-5 h-5 bg-red-600 text-white rounded text-xs flex items-center justify-center">⬇</span>
          Point Load Position Control
        </h4>
        <span className="text-xs text-slate-400">Drag markers to adjust position</span>
      </div>
      
      {/* Slider Track */}
      <div className="relative mb-4">
        {/* Background track */}
        <div 
          ref={trackRef}
          className="h-10 bg-gradient-to-r from-blue-100 via-slate-100 to-blue-100 rounded-lg relative border border-slate-200"
        >
          {/* Tower markers */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-700 rounded-l-lg" />
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-700 rounded-r-lg" />
          
          {/* Tower labels */}
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-blue-800 ml-1">A</span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-blue-800 mr-1">B</span>
          
          {/* Scale markers */}
          {[0.25, 0.5, 0.75].map(ratio => (
            <div
              key={ratio}
              className="absolute top-0 bottom-0 w-px bg-slate-300"
              style={{ left: `${ratio * 100}%` }}
            >
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-slate-400">
                {(ratio * spanL).toFixed(0)}m
              </span>
            </div>
          ))}
          
          {/* Point load markers */}
          {pointLoads.map((pl, idx) => {
            const leftPercent = (pl.x / spanL) * 100;
            const color = COLORS[idx % COLORS.length];
            const isDragging = dragging === pl.id;
            
            return (
              <div
                key={pl.id}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab ${isDragging ? 'cursor-grabbing z-20' : 'z-10'}`}
                style={{ left: `${leftPercent}%` }}
                onMouseDown={handleMouseDown(pl.id)}
              >
                {/* Arrow indicator */}
                <div 
                  className={`flex flex-col items-center transition-transform ${isDragging ? 'scale-125' : 'hover:scale-110'}`}
                >
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg border-2 border-white"
                    style={{ backgroundColor: color }}
                  >
                    {pl.label.slice(0, 2)}
                  </div>
                  <div 
                    className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent -mt-0.5"
                    style={{ borderTopColor: color }}
                  />
                </div>
                
                {/* Tooltip on drag */}
                {isDragging && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                    x = {pl.x.toFixed(2)} m
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Span label */}
        <div className="flex justify-between mt-1 text-[9px] text-slate-400">
          <span>0 m</span>
          <span>L = {spanL} m</span>
        </div>
      </div>
      
      {/* Load magnitude controls */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {pointLoads.map((pl, idx) => {
          const color = COLORS[idx % COLORS.length];
          return (
            <div 
              key={pl.id} 
              className="flex items-center gap-2 p-2 rounded border"
              style={{ borderColor: color, backgroundColor: `${color}10` }}
            >
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {pl.label.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500">x = {pl.x.toFixed(1)} m</div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-600">P =</span>
                  <input
                    type="number"
                    value={pl.P}
                    onChange={e => onChangeP(pl.id, parseFloat(e.target.value) || 0)}
                    className="w-14 px-1 py-0.5 border border-slate-300 rounded text-[11px] text-right"
                    step={1}
                    min={0}
                  />
                  <span className="text-[10px] text-slate-500">kN</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
