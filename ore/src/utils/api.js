import { API_BASE, RPC_ENDPOINTS, WALLET_ADDRESSES } from './constants';

let rpcIndex = 0;

export async function fetchPrices() {
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
}

export async function fetchSolBalance(addr) {
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
    return await attempt(RPC_ENDPOINTS[rpcIndex]);
  } catch (error) {
    console.error('SOL balance error:', error?.message || error);
    while (rpcIndex < RPC_ENDPOINTS.length - 1) {
      rpcIndex += 1;
      try {
        return await attempt(RPC_ENDPOINTS[rpcIndex]);
      } catch (e) {
        console.warn('RPC fallback failed:', e?.message || e);
      }
    }
    return 0;
  }
}

export async function fetchOreBalance(addr) {
  try {
    const res = await fetch(`https://api.ore-stats.com/miner/${addr}`);
    const data = await res.json();
    const ore = data.rewards_ore / 1e11;
    return isNaN(ore) ? 0 : parseFloat(ore.toFixed(4));
  } catch (e) {
    console.error('ORE balance error:', e);
    return 0;
  }
}

export async function fetchAllWalletData() {
  const prices = await fetchPrices();
  const out = {};
  let totalPrice = 0;
  let totalSol = 0;
  let totalOre = 0;

  for (const item of WALLET_ADDRESSES) {
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
}

export async function fetchMinerSettings(addr) {
  try {
    const res = await fetch(`${API_BASE}/api/miner?address=${addr}`);
    const data = await res.json();
    if (data.settings) {
      return {
        deploymentType: data.settings.deployment_mode,
        evPercent: `${data.settings.min_ev_percent}%`,
        totalSol: data.settings.deployment_amount_sol,
        noOfTiles: data.settings.tiles_per_round,
        timeframe: data.settings.mining_cost_timeframe
      };
    }
    return {};
  } catch (e) {
    console.error('Miner settings fetch error:', e);
    return {};
  }
}

export async function fetchBalanceHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/snapshots`);
    const json = await res.json();
    if (json.success && json.data) {
      return json.data.map((item) => {
        const date = item.timestamp ? new Date(item.timestamp) : null;
        const fullDate = date ? `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString()}` : '';
        return {
          timestamp: date ? date.toLocaleTimeString() : '',
          fullDate,
          value: parseFloat(item.totalValue).toFixed(2),
          raw: item.totalValue,
          rawDate: date,
        };
      });
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch balance history:', err);
    return [];
  }
}

