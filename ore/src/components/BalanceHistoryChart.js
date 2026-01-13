import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { getVisibleData } from '../utils/helpers';

export default function BalanceHistoryChart({ historyData }) {
  const [zoomDomain, setZoomDomain] = useState({ start: 0, end: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [timeFilter, setTimeFilter] = useState('all');
  const chartRef = useRef(null);

  const visibleData = useMemo(() => 
    getVisibleData(historyData, zoomDomain, timeFilter),
    [historyData, zoomDomain, timeFilter]
  );

  // Wheel zoom handler
  useEffect(() => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!historyData.length) return;
      
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      setZoomDomain((prevZoom) => {
        const { start, end } = prevZoom;
        const range = end - start;
        const newRange = Math.min(100, Math.max(10, range * delta));
        const center = (start + end) / 2;
        
        let newStart = center - newRange / 2;
        let newEnd = center + newRange / 2;
        
        if (newStart < 0) {
          newStart = 0;
          newEnd = newRange;
        } else if (newEnd > 100) {
          newEnd = 100;
          newStart = 100 - newRange;
        }
        
        return { start: newStart, end: newEnd };
      });
    };

    chartElement.addEventListener('wheel', wheelHandler, { passive: false });
    return () => chartElement.removeEventListener('wheel', wheelHandler);
  }, [historyData.length]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !historyData.length) return;
    
    const deltaX = dragStart - e.clientX;
    const chartWidth = chartRef.current?.offsetWidth || 1;
    const range = zoomDomain.end - zoomDomain.start;
    const shift = (deltaX / chartWidth) * range;
    
    setZoomDomain((prev) => {
      let newStart = prev.start + shift;
      let newEnd = prev.end + shift;
      
      if (newStart < 0) {
        newStart = 0;
        newEnd = range;
      } else if (newEnd > 100) {
        newEnd = 100;
        newStart = 100 - range;
      }
      
      return { start: newStart, end: newEnd };
    });
    
    setDragStart(e.clientX);
  }, [isDragging, dragStart, historyData.length, zoomDomain.end, zoomDomain.start]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!historyData.length) {
    return <div className="history-empty">No historical data available yet. Check back after some time.</div>;
  }

  const first = parseFloat(historyData[0]?.value || 0);
  const last = parseFloat(historyData[historyData.length - 1]?.value || 0);
  const change = last - first;
  const changePercent = first === 0 ? 0 : (change / first) * 100;
  const isUp = change >= 0;

  const visibleFirst = parseFloat(visibleData[0]?.value || 0);
  const visibleLast = parseFloat(visibleData[visibleData.length - 1]?.value || 0);
  const visibleIsUp = visibleLast >= visibleFirst;
  const mainColor = visibleIsUp ? '#00ff00' : '#ff0000';
  const secondColor = visibleIsUp ? '#00dd00' : '#dd0000';
  const borderColor = visibleIsUp ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';

  return (
    <>
      {/* Stock Price Header */}
      <div className="stock-header">
        <div className="stock-title">💰 Portfolio Balance</div>
        <div className="stock-price">
          ${last.toFixed(2)}
        </div>
        <div className="stock-stats">
          <div className={`stock-change ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)} ({changePercent.toFixed(2)}%)
          </div>
          <div className="stock-range">
            <span>Low: ${Math.min(...historyData.map(d => parseFloat(d.value))).toFixed(2)}</span>
            <span>High: ${Math.max(...historyData.map(d => parseFloat(d.value))).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Time Filter Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' }}>
        {['1d', '3d', '1w', 'all'].map((filter) => (
          <button 
            key={filter}
            onClick={() => setTimeFilter(filter)} 
            style={{
              padding: '8px 16px',
              backgroundColor: timeFilter === filter ? '#3b82f6' : '#1f2937',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: timeFilter === filter ? 'bold' : 'normal'
            }}
          >
            {filter.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div 
        ref={chartRef}
        onMouseDown={(e) => {
          const target = e.target;
          const isBrush = target.closest('.recharts-brush');
          if (!isBrush) {
            handleMouseDown(e);
          }
        }}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab', 
          touchAction: 'none',
          userSelect: 'none',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a2e 100%)',
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${borderColor}`,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)'
        }}
      >
        <ResponsiveContainer width="100%" height={450}>
          <AreaChart data={visibleData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={mainColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={mainColor} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={mainColor} />
                <stop offset="50%" stopColor={secondColor} />
                <stop offset="100%" stopColor={mainColor} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(0, 212, 255, 0.1)" 
              vertical={true}
              horizontal={true}
            />
            <XAxis 
              dataKey="timestamp" 
              tick={false}
              stroke="rgba(0, 212, 255, 0.2)"
              tickLine={false}
            />
            <YAxis 
              domain={['dataMin - 10', 'dataMax + 10']}
              tick={false}
              stroke="rgba(0, 212, 255, 0.2)"
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(10, 14, 39, 0.95)',
                border: `1px solid ${visibleIsUp ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'}`,
                borderRadius: '8px',
                color: '#fff',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
              }}
              formatter={(value) => [
                `$${parseFloat(value).toFixed(2)}`,
                'Balance'
              ]}
              labelFormatter={(label, payload) => {
                if (payload && payload[0] && payload[0].payload.fullDate) {
                  return payload[0].payload.fullDate;
                }
                return label;
              }}
              labelStyle={{ color: mainColor, fontWeight: 'bold' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#lineGradient)"
              strokeWidth={2}
              fill="url(#colorValue)"
              dot={false}
              activeDot={{ 
                r: 6, 
                fill: mainColor,
                stroke: '#fff',
                strokeWidth: 2 
              }}
            />
            <Brush 
              dataKey="timestamp" 
              height={35} 
              stroke={mainColor}
              fill={visibleIsUp ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)'}
              travellerWidth={10}
              y={410}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
