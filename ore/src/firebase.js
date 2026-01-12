import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDri_xS7lXe-oIu5KKGYa8u_93a2Z6w3uA",
  authDomain: "ore-miner-dfede.firebaseapp.com",
  projectId: "ore-miner-dfede",
  storageBucket: "ore-miner-dfede.firebasestorage.app",
  messagingSenderId: "352569750424",
  appId: "1:352569750424:web:0c8de035ecc10b4aa0b1ed",
  measurementId: "G-8MLPFNB9M8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics (optional, only in browser environment)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;
