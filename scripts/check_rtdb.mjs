import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, child } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDSHECu0Qzc6oJQ4jtpcj3bqTssq79dLzI",
  authDomain: "ai-powered-smart-livestock.firebaseapp.com",
  databaseURL: "https://ai-powered-smart-livestock-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-powered-smart-livestock",
  storageBucket: "ai-powered-smart-livestock.firebasestorage.app",
  messagingSenderId: "640179266510",
  appId: "1:640179266510:web:6904f7523597770c09419f",
  measurementId: "G-HZDS6HTWT8"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

async function run() {
  const dbRef = ref(rtdb);
  console.log("Fetching /livestock keys from RTDB...");
  const snap = await get(child(dbRef, 'livestock'));
  if (snap.exists()) {
    const val = snap.val();
    console.log("Keys found under /livestock:", Object.keys(val));
    for (const key of Object.keys(val)) {
      console.log(`\nKey: ${key}`);
      console.log(JSON.stringify(val[key], null, 2));
    }
  } else {
    console.log("No data found under /livestock");
  }
  process.exit(0);
}

run().catch(console.error);
