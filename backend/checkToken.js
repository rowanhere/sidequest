import admin from "firebase-admin";
import dotenv from "dotenv";
import fetch from "node-fetch"; // npm install node-fetch@2
dotenv.config();

// Initialize Firebase only if not already initialized
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}
const db = admin.firestore();
const collectionName = "keys";
const docId = "osbepXsOVSUj6k6AQuDa";

// Fetch tokens from Firestore
export async function fetchPrivyTokens() {
  try {
    const docRef = db.collection(collectionName).doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log("No such document in Firestore!");
      return null;
    }

    const data = doc.data();
    return data;

  } catch (error) {
    console.error("Error fetching document:", error);
    return null;
  }
}

// Check if token is expired based on lastUpdated
function isTokenExpiredWithBuffer(tokenData, bufferSeconds = 60) {
  if (!tokenData || !tokenData.privy_token || !tokenData.lastUpdated) return true;

  try {
    const payloadBase64 = tokenData.privy_token.split('.')[1]; // JWT payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    const tokenExp = payload.exp; // in seconds
    const lastUpdated = tokenData.lastUpdated.toMillis ? tokenData.lastUpdated.toMillis() / 1000 : tokenData.lastUpdated; // Firestore timestamp in seconds
    const now = Math.floor(Date.now() / 1000);

    // Check if token is expired or close to expiration (buffer)
    return now >= (tokenExp - bufferSeconds);

  } catch (err) {
    console.error("Error decoding token:", err);
    return true;
  }
}

// Refresh privy_token using privy_refresh_token
async function refreshPrivyToken(refreshToken, currentToken, appId) {
  try {
    const response = await fetch("https://auth.privy.io/api/v1/sessions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "privy-app-id": appId,
        "Authorization": `Bearer ${currentToken}`,
        "origin": "https://minemore.app",
        "referer": "https://minemore.app/"
      },
      body: JSON.stringify({ 
        refresh_token: refreshToken 
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Token refreshed successfully:", data);
    return data;

  } catch (err) {
    console.error("Error refreshing token:", err);
    return null;
  }
}

// Update Firestore with new tokens and lastUpdated
async function updateTokensInFirestore(newTokens) {
  try {
    const docRef = db.collection(collectionName).doc(docId);
    await docRef.update({
      ...newTokens,
      lastUpdated: admin.firestore.Timestamp.now() // store timestamp
    });
    console.log("Firestore updated with new tokens and lastUpdated");
  } catch (err) {
    console.error("Error updating Firestore:", err);
  }
}

// Main function
export async function handlePrivyToken() {
  const tokens = await fetchPrivyTokens();
  if (!tokens) return;

  if (isTokenExpiredWithBuffer(tokens)) {
    console.log("Bearer token expired or near expiry! Refreshing...");
    
    // Extract app ID from the privy_token
    const appId = process.env.PRIVY_APP_ID || "cmhxwcpa5002di80cn6diyqsw"; // Default from token
    const newTokens = await refreshPrivyToken(tokens.privy_refresh_token, tokens.privy_token, appId);

    if (newTokens && newTokens.token && newTokens.refresh_token) {
      await updateTokensInFirestore({
        privy_token: newTokens.token,
        privy_refresh_token: newTokens.refresh_token
      });
    } else {
      console.error("Failed to refresh tokens properly.");
    }
  } else {
    // Token is still valid, no action needed
  }
}
