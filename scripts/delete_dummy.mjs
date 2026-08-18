import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDSHECu0Qzc6oJQ4jtpcj3bqTssq79dLzI",
  authDomain: "ai-powered-smart-livestock.firebaseapp.com",
  projectId: "ai-powered-smart-livestock",
  storageBucket: "ai-powered-smart-livestock.firebasestorage.app",
  messagingSenderId: "640179266510",
  appId: "1:640179266510:web:6904f7523597770c09419f",
  measurementId: "G-HZDS6HTWT8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dummyAnimalIds = ['animal-002', 'animal-003', 'animal-004', 'animal-005'];
const subcollections = ['gps_locations', 'sensor_readings', 'health_records', 'vaccinations', 'ai_predictions'];

async function deleteSubcollection(animalId, subName) {
  const colRef = collection(db, 'animals', animalId, subName);
  const snap = await getDocs(colRef);
  for (const docSnap of snap.docs) {
    await deleteDoc(doc(db, 'animals', animalId, subName, docSnap.id));
  }
}

async function run() {
  console.log("Starting deletion of dummy animals...");
  for (const id of dummyAnimalIds) {
    console.log(`Deleting subcollections for animal ${id}...`);
    for (const sub of subcollections) {
      await deleteSubcollection(id, sub);
    }
    console.log(`Deleting parent document animals/${id}...`);
    await deleteDoc(doc(db, 'animals', id));
  }
  console.log("Successfully deleted dummy animals (Daisy, Molly, Wooly, Billy) from Firestore!");
  process.exit(0);
}

run().catch(console.error);
