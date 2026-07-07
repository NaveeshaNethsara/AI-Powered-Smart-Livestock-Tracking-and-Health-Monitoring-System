import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; // Import Realtime Database

export const firebaseConfig = {
  apiKey: "AIzaSyDSHECu0Qzc6oJQ4jtpcj3bqTssq79dLzI",
  authDomain: "ai-powered-smart-livestock.firebaseapp.com",
  databaseURL: "https://ai-powered-smart-livestock-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-powered-smart-livestock",
  storageBucket: "ai-powered-smart-livestock.firebasestorage.app",
  messagingSenderId: "640179266510",
  appId: "1:640179266510:web:6904f7523597770c09419f",
  measurementId: "G-HZDS6HTWT8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Realtime Database
export const rtdb = getDatabase(app);

export default app;
