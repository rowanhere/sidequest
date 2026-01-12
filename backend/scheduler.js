import admin from 'firebase-admin';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  if (!serviceAccount.project_id) {
    console.error('❌ Missing Firebase service account credentials.');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });

  db = admin.firestore();
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  process.exit(1);
}

// Wallet addresses
const addresses = [
  { address: '9S5uzKP3HEcP69Hz978X5j4jx2f8oT1gQgq636g921mg', index: 'ore1' },
  { address: '4d7zxRVL35ciYRvxPtSfkExbN4UfmVhbwSmj7rnQbE6W', index: 'ore2' },
  { address: 'DJ4bqPXiMwTqgUPyYt3WYqqSWv7Qdn1U9pzm2XgZtfmP', index: 'ore3' },
  { address: '2MsL3mh7zmcCi7Ynq7cFu3Tkhgv8TAz7JX3Uo1XARTn5', index: 'ore4' },
  { address: '55Bb6GcaL6bagZvmQrXy81efMNGUoEzpZchfYh2z4uoq', index: 'ore5' },
  { address: 'DYZU4dLQ6CoUpPfjptjQyzJraA5kx8qBT9hbRVo44han', index: 'ore6' },
  { address: '2zZcbKPCJ7jV68RPN8jt1LeuVgyTKUQj2L3tf3enskTa', index: 'edge1' },
];

const rpcEndpoints = [
  'https://mainnet.helius-rpc.com/?api-key=c17d7381-856c-4e14-9f72-ba31e6e0957d',
  'https://rpc.ankr.com/solana',
  'https://solana-rpc.publicnode.com',
];

let rpcIndex = 0;

// Fetch cryptocurrency prices
async function fetchPrices() {
  try {
    const proxy = 'https://corsproxy.io/?';
    const solUrl = encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=solana&x_cg_demo_api_key=CG-15UFGRkXhyq9yGWGpxksHWr5');
    const oreUrl = encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=ore&x_cg_demo_api_key=CG-15UFGRkXhyq9yGWGpxksHWr5');
    
    const [solRes, oreRes] = await Promise.all([
      fetch(proxy + solUrl),
      fetch(proxy + oreUrl)
    ]);
    
    const [solData, oreData] = await Promise.all([
      solRes.json(),
      oreRes.json()
    ]);
    
    return {
      sol: solData.solana?.usd || 0,
      ore: oreData.ore?.usd || 0
    };
  } catch (error) {
    console.error('Price fetch error:', error.message);
    return { sol: 0, ore: 0 };
  }
}

// Fetch SOL balance via JSON-RPC
async function fetchSolBalance(address, endpoint) {
  const payload = {
    jsonrpc: '2.0',
    id: '1',
    method: 'getBalance',
    params: [address, { commitment: 'confirmed' }]
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  
  const lamports = json?.result?.value ?? 0;
  return parseFloat(((lamports || 0) / 1e9).toFixed(4));
}

// Fetch SOL balance with RPC fallback
async function getSolBalance(address) {
  for (let i = 0; i < rpcEndpoints.length; i++) {
    try {
      const endpoint = rpcEndpoints[(rpcIndex + i) % rpcEndpoints.length];
      const balance = await fetchSolBalance(address, endpoint);
      if (i > 0) rpcIndex = (rpcIndex + i) % rpcEndpoints.length;
      return balance;
    } catch (error) {
      if (i === rpcEndpoints.length - 1) {
        console.error(`All RPCs failed for ${address}`);
        return 0;
      }
    }
  }
  return 0;
}

// Fetch ORE balance
async function fetchOreBalance(address) {
  try {
    const response = await fetch(`https://api.ore-stats.com/miner/${address}`);
    const data = await response.json();
    const ore = data.rewards_ore / 1e11;
    return isNaN(ore) ? 0 : parseFloat(ore.toFixed(4));
  } catch (error) {
    console.error(`ORE balance error for ${address}:`, error.message);
    return 0;
  }
}

// Collect all wallet data
async function collectWalletData() {
  const prices = await fetchPrices();
  let totalPrice = 0;

  for (const wallet of addresses) {
    const sol = await getSolBalance(wallet.address);
    const ore = await fetchOreBalance(wallet.address);
    const price = parseFloat(((sol * prices.sol) + (ore * prices.ore)).toFixed(2));
    totalPrice += price;
  }

  return totalPrice;
}

// Save data to Firestore
async function saveToFirestore(totalValue) {
  try {
    const docRef = await db.collection('wallet-snapshots').add({
      totalValue: totalValue,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to save to Firestore:', error.message);
    throw error;
  }
}

// Main execution
async function collectAndSave() {
  const now = new Date().toLocaleString();
  console.log(`\n[${now}] 🔄 Collecting wallet data...`);
  
  try {
    const totalValue = await collectWalletData();
    await saveToFirestore(totalValue);
    console.log(`[${now}] ✅ Saved: $${totalValue.toFixed(2)}`);
  } catch (error) {
    console.error(`[${now}] ❌ Failed:`, error.message);
  }
}

// Run function once (Render cron will trigger this)
collectAndSave();
