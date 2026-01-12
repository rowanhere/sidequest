import admin from 'firebase-admin';
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
app.listen(PORT, () => {
  
  console.log(`📊 GET /api/snapshots - Fetch all snapshots for graphing\n`);
});
