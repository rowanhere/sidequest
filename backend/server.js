import fetch from 'node-fetch';


import admin from 'firebase-admin';
import { getCurrentBearerToken } from './tokenHelper.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  if (!serviceAccount.project_id) {
    console.error('❌ Missing Firebase service account credentials.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }

  db = admin.firestore();
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  process.exit(1);
}

// Fetch wallet snapshots for graphing
app.get('/api/snapshots', async (req, res) => {
  try {
    const snapshots = [];

    const querySnapshot = await db
      .collection('wallet-snapshots')
      .orderBy('timestamp', 'desc')
      .get();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      snapshots.push({
        totalValue: data.totalValue,
        timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null,
      });
    });

    // Reverse to get chronological order (oldest to newest)
    snapshots.reverse();

    res.json({
      success: true,
      count: snapshots.length,
      data: snapshots
    });
  } catch (error) {
    console.error('Error fetching snapshots:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server


// Miner info endpoint
// Usage: GET /api/miner?address=ADDRESS
app.get('/api/miner', async (req, res) => {
  const { address } = req.query;
  if (!address) {
    return res.status(400).json({ success: false, error: 'Missing address parameter' });
  }
  try {
    const token = await getCurrentBearerToken();
    if (!token) {
      return res.status(500).json({ success: false, error: 'Could not retrieve bearer token' });
    }
    const url = `https://minemoreserver-production.up.railway.app/api/game/public-settings/${address}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'referer': 'https://minemore.app/',
        'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'privy-app-id': 'cmhxwcpa5002di80cn6diyqsw'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching miner public settings:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`📊 GET /api/snapshots - Fetch all snapshots for graphing\n`);
  console.log(`⛏️  GET /api/miner?address=ADDRESS - Fetch miner info by address\n`);
});
