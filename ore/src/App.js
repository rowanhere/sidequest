import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import './App.css';

const rpcEndpoints = [
  'https://mainnet.helius-rpc.com/?api-key=c17d7381-856c-4e14-9f72-ba31e6e0957d',
  'https://rpc.ankr.com/solana',
  'https://solana-rpc.publicnode.com',
];

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const addresses = [
  { address: '9S5uzKP3HEcP69Hz978X5j4jx2f8oT1gQgq636g921mg', index: 'ore1' },
  { address: '4d7zxRVL35ciYRvxPtSfkExbN4UfmVhbwSmj7rnQbE6W', index: 'ore2' },
  { address: 'DJ4bqPXiMwTqgUPyYt3WYqqSWv7Qdn1U9pzm2XgZtfmP', index: 'ore3' },
  { address: '2MsL3mh7zmcCi7Ynq7cFu3Tkhgv8TAz7JX3Uo1XARTn5', index: 'ore4' },
  { address: '55Bb6GcaL6bagZvmQrXy81efMNGUoEzpZchfYh2z4uoq', index: 'ore5' },
  { address: 'DYZU4dLQ6CoUpPfjptjQyzJraA5kx8qBT9hbRVo44han', index: 'ore6' },
  { address: '2zZcbKPCJ7jV68RPN8jt1LeuVgyTKUQj2L3tf3enskTa', index: 'edge1' },
];

const REFRESH_SECONDS = 60;

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

function formatAddr(addr) {
  return addr.substring(0, 12) + '...' + addr.substring(addr.length - 8);
}

function App() {
  const [active, setActive] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [results, setResults] = useState(null); // { [key]: {address, sol, ore, price}, total }
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [previousSnapshot, setPreviousSnapshot] = useState(null); // { generatedAt, wallets }
  const [editing, setEditing] = useState({}); // { key: boolean }
  const [customDataMap, setCustomDataMap] = useLocalStorageObject('wallet_custom_map', {});
  const [historyData, setHistoryData] = useState([]); // Graph data from API
  const [historyLoading, setHistoryLoading] = useState(false);
  const [zoomDomain, setZoomDomain] = useState({ start: 0, end: 100 }); // Zoom range percentage
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', '1d', '3d', '1w'

  const rpcIndexRef = useRef(0);
  const chartRef = useRef(null);

  // Add wheel event listener with passive: false to prevent browser zoom
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
    
    return () => {
      chartElement.removeEventListener('wheel', wheelHandler);
    };
  }, [historyData.length]);

  // Mouse drag handlers for panning
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
      
      // Keep within bounds
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

  // Filtered data based on zoom
  const visibleData = useMemo(() => {
    if (!historyData.length) return [];
    
    // Apply time filter first
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
        if (!item.rawDate) return true; // Include items without date
        return item.rawDate >= cutoffTime;
      });
    }
    
    // Then apply zoom
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
  }, []);

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
      return await attempt(rpcEndpoints[rpcIndexRef.current]);
    } catch (error) {
      console.error('SOL balance error:', error?.message || error);
      while (rpcIndexRef.current < rpcEndpoints.length - 1) {
        rpcIndexRef.current += 1;
        try {
          return await attempt(rpcEndpoints[rpcIndexRef.current]);
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

    for (const item of addresses) {
      const sol = await fetchSolBalance(item.address);
      const ore = await fetchOreBalance(item.address);
      const price = parseFloat(((sol * prices.sol) + (ore * prices.ore)).toFixed(2));
      totalPrice += price;
      totalSol += sol;
      totalOre += ore;
      out[item.index] = { address: item.address, sol, ore, price };
    }

    out.total = { address: '--- TOTAL ---', sol: totalSol, ore: totalOre, price: totalPrice };
    return { timestamp: new Date().toLocaleString(), results: out };
  }, [fetchOreBalance, fetchPrices, fetchSolBalance]);

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

  const copyAddress = useCallback(async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggleEdit = useCallback((key) => {
    setEditing((e) => ({ ...e, [key]: !e[key] }));
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

          {stats && (
            <div id="stats-container">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">📊 Total Value</div>
                  <div className="stat-value">${stats.totalValue?.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">🌐 Total SOL</div>
                  <div className="stat-value">{stats.totalSol?.toFixed(4)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">💎 Total ORE</div>
                  <div className="stat-value">{stats.totalOre?.toFixed(4)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">👛 Wallets</div>
                  <div className="stat-value">{stats.walletCount}</div>
                </div>
              </div>
            </div>
          )}

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
                const isEditing = !!editing[key];
                const c = loadCustomData(key);
                const addrShort = formatAddr(item.address);
                return (
                  <div className="card" data-card-key={key} key={key}>
                    <div className="card-label">{key.toUpperCase()}</div>
                    <div
                      className="card-address"
                      style={{ cursor: 'pointer' }}
                      onClick={async (e) => {
                        const ok = await copyAddress(item.address);
                        if (ok) {
                          const el = e.currentTarget;
                          const orig = el.innerHTML;
                          el.innerHTML = '✓ Copied!';
                          el.style.color = '#10b981';
                          setTimeout(() => { el.innerHTML = orig; el.style.color = ''; }, 1500);
                        }
                      }}
                      title="Click to copy"
                    >
                      {addrShort}
                    </div>
                    <div className="card-row">
                      <div className="card-column">
                        <div className="card-data-label">SOL</div>
                        <div className="card-data-value">{item.sol === '-' ? '-' : item.sol.toFixed(4)}</div>
                      </div>
                      <div className="card-column">
                        <div className="card-data-label">ORE</div>
                        <div className="card-data-value">{item.ore === '-' ? '-' : item.ore.toFixed(4)}</div>
                      </div>
                      <div className="card-column">
                        <div className="card-data-label">PRICE ($)</div>
                        <div className="card-data-value price-value">${item.price.toFixed(2)}</div>
                      </div>
                    </div>

                    {!isEditing && (
                      <div className={`tags-container`}>
                        {c.deploymentType || c.evPercent || c.totalSol || c.noOfTiles ? (
                          <>
                            {c.deploymentType && (<div className="tag"><span className="tag-label">Type:</span><span className="tag-value">{c.deploymentType}</span></div>)}
                            {c.evPercent && (<div className="tag"><span className="tag-label">EV:</span><span className="tag-value">{c.evPercent}</span></div>)}
                            {c.totalSol && (<div className="tag"><span className="tag-label">Total SOL:</span><span className="tag-value">{c.totalSol}</span></div>)}
                            {c.noOfTiles && (<div className="tag"><span className="tag-label">Tiles:</span><span className="tag-value">{c.noOfTiles}</span></div>)}
                          </>
                        ) : (
                          <div className="tag"><span className="tag-value" style={{ color: '#64748b' }}>No data - click Edit to add</span></div>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="editable-fields">
                        <div className="editable-field">
                          <div className="editable-label">Deployment Type</div>
                          <input className="editable-input" value={c.deploymentType} placeholder="e.g., Cloud" onChange={(e) => setField(key, 'deploymentType', e.target.value)} />
                        </div>
                        <div className="editable-field">
                          <div className="editable-label">EV %</div>
                          <input className="editable-input" value={c.evPercent} placeholder="e.g., 15%" onChange={(e) => setField(key, 'evPercent', e.target.value)} />
                        </div>
                        <div className="editable-field">
                          <div className="editable-label">Total SOL</div>
                          <input className="editable-input" value={c.totalSol} placeholder="e.g., 5.5" onChange={(e) => setField(key, 'totalSol', e.target.value)} />
                        </div>
                        <div className="editable-field">
                          <div className="editable-label">No of Tiles</div>
                          <input className="editable-input" value={c.noOfTiles} placeholder="e.g., 10" onChange={(e) => setField(key, 'noOfTiles', e.target.value)} />
                        </div>
                      </div>
                    )}

                    <button
                      className="edit-button"
                      onClick={() => toggleEdit(key)}
                      title="Edit card details"
                      style={isEditing ? { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' } : undefined}
                    >
                      {isEditing ? '✓' : '✏️'}
                    </button>
                  </div>
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
          <div className="history-card">
            {historyLoading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p className="loading-text">Loading balance history...</p>
              </div>
            ) : historyData.length === 0 ? (
              <div className="history-empty">No historical data available yet. Check back after some time.</div>
            ) : (
              <>
                {/* Stock Price Header */}
                <div className="stock-header">
                  <div className="stock-title">💰 Portfolio Balance</div>
                  <div className="stock-price">
                    ${historyData[historyData.length - 1]?.value || '0.00'}
                  </div>
                  <div className="stock-stats">
                    {(() => {
                      const first = parseFloat(historyData[0]?.value || 0);
                      const last = parseFloat(historyData[historyData.length - 1]?.value || 0);
                      const change = last - first;
                      const changePercent = first === 0 ? 0 : (change / first) * 100;
                      const isUp = change >= 0;
                      return (
                        <>
                          <div className={`stock-change ${isUp ? 'up' : 'down'}`}>
                            {isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)} ({changePercent.toFixed(2)}%)
                          </div>
                          <div className="stock-range">
                            <span>Low: ${Math.min(...historyData.map(d => parseFloat(d.value))).toFixed(2)}</span>
                            <span>High: ${Math.max(...historyData.map(d => parseFloat(d.value))).toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Time Filter Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setTimeFilter('1d')} 
                    style={{
                      padding: '8px 16px',
                      backgroundColor: timeFilter === '1d' ? '#3b82f6' : '#1f2937',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: timeFilter === '1d' ? 'bold' : 'normal'
                    }}
                  >
                    1D
                  </button>
                  <button 
                    onClick={() => setTimeFilter('3d')} 
                    style={{
                      padding: '8px 16px',
                      backgroundColor: timeFilter === '3d' ? '#3b82f6' : '#1f2937',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: timeFilter === '3d' ? 'bold' : 'normal'
                    }}
                  >
                    3D
                  </button>
                  <button 
                    onClick={() => setTimeFilter('1w')} 
                    style={{
                      padding: '8px 16px',
                      backgroundColor: timeFilter === '1w' ? '#3b82f6' : '#1f2937',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: timeFilter === '1w' ? 'bold' : 'normal'
                    }}
                  >
                    1W
                  </button>
                  <button 
                    onClick={() => setTimeFilter('all')} 
                    style={{
                      padding: '8px 16px',
                      backgroundColor: timeFilter === 'all' ? '#3b82f6' : '#1f2937',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: timeFilter === 'all' ? 'bold' : 'normal'
                    }}
                  >
                    All
                  </button>
                </div>

                {/* Chart */}
                <div 
                  ref={chartRef}
                  onMouseDown={handleMouseDown}
                  style={{ 
                    cursor: isDragging ? 'grabbing' : 'grab', 
                    touchAction: 'none',
                    userSelect: 'none'
                  }}
                >
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={visibleData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={false}
                      />
                      <YAxis 
                        domain={['dataMin - 10', 'dataMax + 10']}
                        label={{ value: 'Value ($)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        formatter={(value) => `$${value}`}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0] && payload[0].payload.fullDate) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        dot={{ fill: '#3b82f6', r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Brush dataKey="timestamp" height={30} stroke="#3b82f6" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
