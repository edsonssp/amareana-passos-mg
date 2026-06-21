import { MongoClient } from "mongodb";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(firebaseConfigPath)) {
  console.error("Firebase config not found! Please run the Firebase setup from AI Studio.");
  process.exit(1);
}
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "amarena_db";

async function runImport() {
  if (!MONGO_URL) {
    console.error("MONGO_URL not found in environment variables (.env).");
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    const db = client.db(DB_NAME);
    
    const collections = ["products", "orders", "pushTokens", "daily_closings", "daily_visits"];
    let totalImported = 0;

    for (const col of collections) {
      console.log(`\nImporting ${col}...`);
      const docs = await db.collection(col).find().toArray();
      let imported = 0;
      for (const document of docs) {
        const docId = document._id.toString();
        delete document._id;
        // Check if doc already exists
        const docRef = doc(firestore, col, docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
           await setDoc(docRef, document);
           imported++;
        }
      }
      console.log(`-> Imported ${imported} new documents into ${col}.`);
      totalImported += imported;
    }

    console.log("\nImporting settings...");
    const settings = await db.collection("settings").findOne();
    if (settings) {
      delete settings._id;
      await setDoc(doc(firestore, "settings", "main"), settings);
      console.log("-> Settings imported.");
      totalImported++;
    }

    console.log(`\nMigration completed successfully! Total imported items: ${totalImported}`);

  } catch (err) {
    console.error("Error during migration:", err);
  } finally {
    await client.close();
  }
}

runImport();
