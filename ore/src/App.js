import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import './App.css';
import WalletManager from './components/WalletManager';
import StatsCard from './components/StatsCard';
import WalletCard from './components/WalletCard';
import { RPC_ENDPOINTS, API_BASE as API_BASE_CONST, WALLET_ADDRESSES, REFRESH_SECONDS } from './utils/constants';
import { fetchMinerSettings } from './utils/api';

function useLocalStorageObject(key, defaultValue) {
  const load = useCallback(() => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (_) {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const [value, setValue] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }, [key, value]);

  return [value, setValue];
}

function App() {
  const [active, setActive] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [results, setResults] = useState(null); // { [key]: {address, sol, ore, price}, total }
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [previousSnapshot, setPreviousSnapshot] = useState(null); // { generatedAt, wallets }
  const [customDataMap, setCustomDataMap] = useLocalStorageObject('wallet_custom_map', {});
  const [enabledMap, setEnabledMap] = useLocalStorageObject('wallet_enabled_map', {});
  const [walletAddresses, setWalletAddresses] = useLocalStorageObject('wallet_addresses', WALLET_ADDRESSES);
  const [showWalletManager, setShowWalletManager] = useState(false);
  const [historyData, setHistoryData] = useState([]); // Graph data from API
  const [historyLoading, setHistoryLoading] = useState(false);
  const [zoomDomain, setZoomDomain] = useState({ start: 0, end: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [timeFilter, setTimeFilter] = useState('all');

  const rpcIndexRef = useRef(0);
  const API_BASE = API_BASE_CONST;
  const chartRef = useRef(null);

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

  const visibleData = useMemo(() => {
    if (!historyData.length) return [];
    
    let filteredData = historyData;
    if (timeFilter !== 'all') {
      const now = new Date();
      const cutoffTime = new Date();
      
      switch (timeFilter) {
        case '1d':
          cutoffTime.setDate(now.getDate() - 1);
          break;
        case '3d':
          cutoffTime.setDate(now.getDate() - 3);
          break;
        case '1w':
          cutoffTime.setDate(now.getDate() - 7);
          break;
        default:
          break;
      }
      
      filteredData = historyData.filter(item => {
        if (!item.rawDate) return true;
        return item.rawDate >= cutoffTime;
      });
    }
    
    const startIdx = Math.floor((zoomDomain.start / 100) * filteredData.length);
    const endIdx = Math.ceil((zoomDomain.end / 100) * filteredData.length);
    return filteredData.slice(startIdx, endIdx);
  }, [historyData, zoomDomain, timeFilter]);

  const loadCustomData = useCallback((key) => {
    return customDataMap[key] || { deploymentType: '', evPercent: '', totalSol: '', noOfTiles: '' };
  }, [customDataMap]);

  const saveCustomData = useCallback((key, field, value) => {
    setCustomDataMap((m) => ({ ...m, [key]: { ...loadCustomData(key), [field]: value } }));
  }, [loadCustomData, setCustomDataMap]);

  const setEnabled = useCallback((key, value) => {
    setEnabledMap((m) => ({ ...m, [key]: value }));
  }, [setEnabledMap]);

  const fetchBalanceHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/snapshots`);
      const json = await res.json();
      if (json.success && json.data) {
        const formatted = json.data.map((item) => {
          const date = item.timestamp ? new Date(item.timestamp) : null;
          const fullDate = date ? `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString()}` : '';
          return {
            timestamp: date ? date.toLocaleTimeString() : '',
            fullDate, // e.g., "Jan 11 2:30:45 PM"
            value: parseFloat(item.totalValue).toFixed(2),
            raw: item.totalValue,
            rawDate: date,
          };
        });
        setHistoryData(formatted);
      }
    } catch (err) {
      console.error('Failed to fetch balance history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [API_BASE]);

  const fetchPrices = useCallback(async () => {
    try {
      const proxy = 'https://corsproxy.io/?';
      const solUrl = encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=solana&x_cg_demo_api_key=CG-15UFGRkXhyq9yGWGpxksHWr5');
      const oreUrl = encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=ore&x_cg_demo_api_key=CG-15UFGRkXhyq9yGWGpxksHWr5');
      const [solRes, oreRes] = await Promise.all([fetch(proxy + solUrl), fetch(proxy + oreUrl)]);
      const [solData, oreData] = await Promise.all([solRes.json(), oreRes.json()]);
      return { sol: solData.solana?.usd || 0, ore: oreData.ore?.usd || 0 };
    } catch (e) {
      console.error('Price fetch error:', e);
      return { sol: 0, ore: 0 };
    }
  }, []);

  const fetchSolBalance = useCallback(async (addr) => {
    const attempt = async (endpoint) => {
      const payload = {
        jsonrpc: '2.0',
        id: '1',
        method: 'getBalance',
        params: [addr, { commitment: 'confirmed' }],
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'RPC error');
      const lamports = json?.result?.value ?? 0;
      return parseFloat(((lamports || 0) / 1e9).toFixed(4));
    };

    try {
      return await attempt(RPC_ENDPOINTS[rpcIndexRef.current]);
    } catch (error) {
      console.error('SOL balance error:', error?.message || error);
      while (rpcIndexRef.current < RPC_ENDPOINTS.length - 1) {
        rpcIndexRef.current += 1;
        try {
          return await attempt(RPC_ENDPOINTS[rpcIndexRef.current]);
        } catch (e) {
          console.warn('RPC fallback failed:', e?.message || e);
        }
      }
      return 0;
    }
  }, []);

  const fetchOreBalance = useCallback(async (addr) => {
    try {
      const res = await fetch(`https://api.ore-stats.com/miner/${addr}`);
      const data = await res.json();
      const ore = data.rewards_ore / 1e11;
      return isNaN(ore) ? 0 : parseFloat(ore.toFixed(4));
    } catch (e) {
      console.error('ORE balance error:', e);
      return 0;
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    const prices = await fetchPrices();
    const out = {};
    let totalPrice = 0;
    let totalSol = 0;
    let totalOre = 0;
    const newCustomData = { ...customDataMap };

    for (const item of walletAddresses) {
      const sol = await fetchSolBalance(item.address);
      const ore = await fetchOreBalance(item.address);
      const price = parseFloat(((sol * prices.sol) + (ore * prices.ore)).toFixed(2));
      totalPrice += price;
      totalSol += sol;
      totalOre += ore;
      out[item.index] = { address: item.address, sol, ore, price };

      // Fetch miner settings and update custom data
      const minerSettings = await fetchMinerSettings(item.address);
      if (Object.keys(minerSettings).length > 0) {
        newCustomData[item.index] = { ...newCustomData[item.index], ...minerSettings };
      }
    }

    out.total = { address: '--- TOTAL ---', sol: totalSol, ore: totalOre, price: totalPrice };
    
    // Update custom data map
    setCustomDataMap(newCustomData);
    
    return { timestamp: new Date().toLocaleString(), results: out };
  }, [fetchOreBalance, fetchPrices, fetchSolBalance, walletAddresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllData();
      setTimestamp(data.timestamp);
      setResults(data.results);
    } catch (e) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setSecondsElapsed(0);
    }
  }, [fetchAllData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsElapsed((s) => {
        if (s + 1 >= REFRESH_SECONDS) {
          loadData();
          return 0;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    if (active !== 'history') return undefined;
    fetchBalanceHistory();
    const t = setInterval(fetchBalanceHistory, 60000);
    return () => clearInterval(t);
  }, [active, fetchBalanceHistory]);

  const onDownloadJson = useCallback(() => {
    if (!results) return;
    const payload = { generatedAt: timestamp, wallets: results };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solana-wallets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, timestamp]);

  const onSnapshotUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        const wallets = json.wallets || json.results || json;
        if (!wallets || typeof wallets !== 'object') throw new Error('Invalid snapshot');
        setPreviousSnapshot({ generatedAt: json.generatedAt || json.timestamp || 'Unknown time', wallets });
        setActive('compare');
      } catch (err) {
        alert('Could not read snapshot: ' + (err?.message || err));
        setPreviousSnapshot(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const setField = useCallback((key, field, value) => {
    saveCustomData(key, field, value);
  }, [saveCustomData]);

  const stats = useMemo(() => {
    if (!results) return null;
    const total = results.total || { price: 0, sol: 0, ore: 0 };
    const walletCount = Math.max(0, Object.keys(results).length - 1);
    return { totalValue: total.price, totalSol: total.sol, totalOre: total.ore, walletCount };
  }, [results]);

  const progress = (secondsElapsed / REFRESH_SECONDS) * 100;

  return (
    <div className="container">
      <div className="header">
        <h1>💰 Solana Wallets</h1>
        <p id="timestamp">{timestamp || 'Loading...'}</p>
        <div className="top-nav">
          <button className={`nav-btn ${active === 'overview' ? 'active' : ''}`} onClick={() => setActive('overview')}>Overview</button>
          <button className={`nav-btn ${active === 'compare' ? 'active' : ''}`} onClick={() => setActive('compare')}>Compare</button>
                    <button className={`nav-btn ${active === 'history' ? 'active' : ''}`} onClick={() => { setActive('history'); fetchBalanceHistory(); }}>Balance History</button>
          <button className="nav-btn ghost" onClick={() => setShowWalletManager(true)}>🔑 Manage Wallets</button>
          <button className="nav-btn ghost" onClick={onDownloadJson} disabled={!results}>Download JSON</button>
          <label className="nav-btn ghost" htmlFor="snapshotInput" style={{ cursor: 'pointer' }}>Load Previous JSON</label>
          <input type="file" id="snapshotInput" accept="application/json" style={{ display: 'none' }} onChange={onSnapshotUpload} />
        </div>
      </div>

      <div className="content">
        <div id="overview-section" className={`section ${active === 'overview' ? 'active' : ''}`}>
          <div className="button-container">
            <div className="next-refresh" id="nextRefresh">Next auto-refresh in {REFRESH_SECONDS - secondsElapsed}s</div>
            <div className="progress-container" style={{ width: '300px', maxWidth: '100%' }}>
              <div className="progress-bar" id="progressBar" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          {stats && <StatsCard stats={stats} />}

          {error && <div id="error-container"><div className="error">⚠️ Error: {error}</div></div>}

          {loading && (
            <div id="loading" className="loading">
              <div className="spinner"></div>
              <p className="loading-text">Fetching wallet data...</p>
            </div>
          )}

          <div id="data-container">
            {results && Object.entries(results)
              .filter(([k]) => k !== 'total')
              .map(([key, item]) => {
                const enabled = enabledMap[key] !== undefined ? enabledMap[key] : false;
                return { key, item, enabled };
              })
              .sort((a, b) => Number(b.enabled) - Number(a.enabled))
              .map(({ key, item, enabled }) => {
                const c = loadCustomData(key);
                return (
                  <WalletCard
                    key={key}
                    walletKey={key}
                    item={item}
                    customData={c}
                    onUpdateCustomData={setField}
                    enabled={enabled}
                    onToggleEnabled={setEnabled}
                  />
                );
              })}
          </div>
        </div>

        <div id="compare-section" className={`section ${active === 'compare' ? 'active' : ''}`}>
          <div className="snapshot-card" id="snapshotCard">
            <div className="snapshot-header">
              <div className="snapshot-title">Snapshot Delta (Previous JSON vs Latest)</div>
              <div className="snapshot-meta" id="snapshotMeta">{previousSnapshot ? `Comparing snapshot from ${previousSnapshot.generatedAt} to latest (${timestamp || '...'})` : 'No snapshot loaded'}</div>
            </div>
            <div className="snapshot-grid" id="snapshotGrid">
              {!previousSnapshot && (
                <div className="snapshot-empty">Load a previous JSON to see per-wallet changes.</div>
              )}
              {previousSnapshot && (!results ? (
                <div className="snapshot-empty">Waiting for latest data to finish loading.</div>
              ) : (
                Object.entries(results).map(([key, curr]) => {
                  const prev = previousSnapshot.wallets[key];
                  if (!prev) {
                    return (
                      <div className="snapshot-row" key={key}>
                        <div className="snapshot-name">{key.toUpperCase()}</div>
                        <div className="snapshot-empty">No previous data for this wallet.</div>
                      </div>
                    );
                  }
                  const prevPriceNum = typeof prev.price === 'number' ? prev.price : Number(prev.price || 0);
                  const diff = curr.price - prevPriceNum;
                  const percent = prevPriceNum === 0 ? 0 : ((diff / prevPriceNum) * 100);
                  const up = diff >= 0;
                  const chipClass = up ? 'up' : 'down';
                  const arrow = up ? '▲' : '▼';
                  const isTotal = key === 'total';
                  return (
                    <div className={`snapshot-row ${isTotal ? 'total' : ''}`} key={key}>
                      <div className="snapshot-row-header">
                        <div className="snapshot-name">{key.toUpperCase()}</div>
                        <div className={`snapshot-chip ${chipClass}`}>
                          <span>{arrow}</span>
                          <span>{percent.toFixed(2)}%</span>
                          <span className="amount">(${diff.toFixed(2)})</span>
                        </div>
                      </div>
                      <div className="snapshot-metrics">
                        <div className="metric"><span className="label">Prev</span><span className="value">${prevPriceNum.toFixed(2)}</span></div>
                        <div className="metric"><span className="label">Now</span><span className="value">${curr.price.toFixed(2)}</span></div>
                      </div>
                    </div>
                  );
                })
              ))}
            </div>
          </div>
        </div>

        <div id="history-section" className={`section ${active === 'history' ? 'active' : ''}`}>
          <div className="history-container">
            {historyLoading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p className="loading-text">Loading balance history...</p>
              </div>
            ) : historyData.length === 0 ? (
              <div className="history-empty">No historical data available yet. Check back after some time.</div>
            ) : (
              <>
                {/* Clean Header */}
                <div className="chart-header">
                  <div className="balance-section">
                    <div className="balance-label">Total Balance</div>
                    {(() => {
                      const first = parseFloat(historyData[0]?.value || 0);
                      const last = parseFloat(historyData[historyData.length - 1]?.value || 0);
                      const isUp = last >= first;
                      
                      return (
                        <div className="balance-value" style={{ color: isUp ? '#10b981' : '#ef4444' }}>
                          ${last.toFixed(2)}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="stats-section">
                    {(() => {
                      const first = parseFloat(visibleData[0]?.value || 0);
                      const last = parseFloat(visibleData[visibleData.length - 1]?.value || 0);
                      const change = last - first;
                      const changePercent = first === 0 ? 0 : (change / first) * 100;
                      const isUp = change >= 0;
                      const min = Math.min(...visibleData.map(d => parseFloat(d.value)));
                      const max = Math.max(...visibleData.map(d => parseFloat(d.value)));
                      
                      return (
                        <>
                          <div className="stat-item">
                            <span className="stat-label">Change</span>
                            <span className={`stat-value ${isUp ? 'up' : 'down'}`}>
                              {isUp ? '+' : '-'}${Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(1)}%)
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Low</span>
                            <span className="stat-value">${min.toFixed(2)}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">High</span>
                            <span className="stat-value">${max.toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Time Range Buttons */}
                <div className="time-filters">
                  {['1d', '3d', '1w', 'all'].map((filter) => (
                    <button 
                      key={filter}
                      onClick={() => setTimeFilter(filter)}
                      className={`time-btn ${timeFilter === filter ? 'active' : ''}`}
                    >
                      {filter.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                {(() => {
                  const first = parseFloat(historyData[0]?.value || 0);
                  const last = parseFloat(historyData[historyData.length - 1]?.value || 0);
                  const isUp = last >= first;
                  const mainColor = isUp ? '#10b981' : '#ef4444';
                  
                  return (
                    <div 
                      ref={chartRef}
                      onMouseDown={(e) => {
                        const target = e.target;
                        const isBrush = target.closest('.recharts-brush');
                        if (!isBrush) {
                          handleMouseDown(e);
                        }
                      }}
                      className="chart-container"
                      style={{ 
                        cursor: isDragging ? 'grabbing' : 'grab', 
                        touchAction: 'none',
                        userSelect: 'none'
                      }}
                    >
                      <ResponsiveContainer width="100%" height={450}>
                        <AreaChart data={visibleData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }} isAnimationActive={true}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={mainColor} stopOpacity={0.3}/>
                              <stop offset="100%" stopColor={mainColor} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid 
                            strokeDasharray="0" 
                            stroke="rgba(255, 255, 255, 0.05)" 
                            vertical={false}
                            horizontal={true}
                          />
                          <XAxis 
                            dataKey="timestamp" 
                            tick={false}
                            stroke="transparent"
                            tickLine={false}
                          />
                          <YAxis 
                            domain={['dataMin - 10', 'dataMax + 10']}
                            tick={false}
                            stroke="transparent"
                            tickLine={false}
                            width={0}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              border: `1px solid ${mainColor}33`,
                              borderRadius: '12px',
                              color: '#fff',
                              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
                              padding: '12px'
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
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={mainColor}
                            strokeWidth={2.5}
                            fill="url(#colorValue)"
                            dot={false}
                            isAnimationActive={true}
                          />
                          <Brush 
                            dataKey="timestamp" 
                            height={25} 
                            stroke={mainColor}
                            fill="transparent"
                            travellerWidth={6}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {showWalletManager && (
        <WalletManager
          addresses={walletAddresses}
          onAddressesChange={setWalletAddresses}
          onClose={() => setShowWalletManager(false)}
        />
      )}
    </div>
  );
}

export default App;
