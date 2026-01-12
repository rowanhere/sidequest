# Wallet Tracker Backend

Backend service that collects wallet balances and stores historical data in Firestore for graphing.

## Setup

### 1. Install Dependencies

```powershell
cd backend
npm install
```

### 2. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `ore-miner-dfede`
3. Go to **Project Settings** (gear icon) > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file

### 3. Configure Environment

**Option A: Using .env file (Recommended)**

```powershell
# Copy the example file
Copy-Item .env.example .env

# Edit .env and paste your service account JSON as a single-line string
notepad .env
```

Example `.env` content:
```
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"ore-miner-dfede","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@ore-miner-dfede.iam.gserviceaccount.com",...}'
```

**Option B: Using environment variable directly**

```powershell
$env:FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
node index.js
```

### 4. Run the Data Collector

```powershell
npm start
```

Or:

```powershell
node index.js
```

## What It Does

1. Fetches SOL balances from Solana RPC (Helius with fallback)
2. Fetches ORE balances from ore-stats.com API
3. Gets SOL and ORE prices from CoinGecko
4. Calculates total portfolio value
5. Saves snapshot to Firestore collection: `wallet-snapshots`

## Firestore Data Structure

```javascript
{
  timestamp: Timestamp,          // ISO timestamp of collection
  totalValue: 709.75,            // Total USD value
  totalSol: 2.2192,              // Total SOL across wallets
  totalOre: 2.2749,              // Total ORE across wallets
  walletCount: 7,                // Number of wallets
  prices: {
    sol: 200.50,                 // SOL price in USD
    ore: 0.025                   // ORE price in USD
  },
  wallets: {
    ore1: {
      address: '9S5u...',
      sol: 0.5,
      ore: 0.3,
      price: 100.25
    },
    // ... more wallets
  },
  createdAt: ServerTimestamp     // Firestore server timestamp
}
```

## Automation

### Windows Task Scheduler

Run every hour:

```powershell
# Create a scheduled task
$action = New-ScheduledTaskAction -Execute "node" -Argument "D:\Games\backend\index.js" -WorkingDirectory "D:\Games\backend"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "WalletDataCollector" -Description "Collects wallet data every hour"
```

### Node.js Cron (Alternative)

Install node-cron:
```powershell
npm install node-cron
```

Create `scheduler.js`:
```javascript
import cron from 'node-cron';
import { exec } from 'child_process';

// Run every hour
cron.schedule('0 * * * *', () => {
  console.log('Running wallet data collection...');
  exec('node index.js', (error, stdout, stderr) => {
    if (error) console.error(`Error: ${error.message}`);
    if (stderr) console.error(`stderr: ${stderr}`);
    console.log(stdout);
  });
});

console.log('Scheduler started. Will run every hour.');
```

Then run: `node scheduler.js`

## Security

- **Never commit** `.env` or `firebaseServiceAccount.json` to git
- Add to `.gitignore`:
  ```
  .env
  firebaseServiceAccount.json
  ```

## Troubleshooting

### "Missing Firebase service account credentials"

Make sure you've set the `FIREBASE_SERVICE_ACCOUNT` environment variable or created a `.env` file.

### "All RPCs failed"

Check your internet connection and verify the Helius API key is valid.

### Firestore permission denied

Ensure your Firebase project has Firestore enabled and the service account has write permissions.

## Next Steps

Use this data in your React app to display historical graphs of portfolio value over time!
