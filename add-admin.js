import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

// ---- Config ----
// Als je in je MONGO_URI geen db-naam hebt (…mongodb.net/), zet dan hier je db-naam:
const FALLBACK_DB_NAME = process.env.MONGO_DBNAME || "puzzeltocht";

// Credentials voor de admin die je wilt seeden:
const ADMIN_USERNAME = "doenwe";
const ADMIN_PASSWORD = "Mudrun2026";

// ---- Connect ----
const connectMongo = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI ontbreekt. Zet MONGO_URI in je .env of Railway Variables.");
  }

  // Als er geen db-naam in de URI staat, forceer dan dbName via opties
  const hasDbInUri = /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(uri);
  await mongoose.connect(uri, {
    dbName: hasDbInUri ? undefined : FALLBACK_DB_NAME,
    serverSelectionTimeoutMS: 15000
  });

  const dbName = mongoose.connection.client?.options?.dbName || mongoose.connection.name;
  console.log(`✅ Verbonden met MongoDB. Database: ${dbName}`);
};

// ---- Schema & Model ----
const AdminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
  },
  { collection: "admins", timestamps: true }
);

// Zorg voor unique index op username
AdminSchema.index({ username: 1 }, { unique: true });

const Admin = mongoose.model("Admin", AdminSchema);

// ---- Seed logic ----
const upsertAdmin = async () => {
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // upsert = aanmaken als niet bestaat, anders bijwerken
  const res = await Admin.updateOne(
    { username: ADMIN_USERNAME },
    { $set: { password: hashed } },
    { upsert: true }
  );

  if (res.upsertedCount === 1) {
    console.log(`🆕 Admin aangemaakt: ${ADMIN_USERNAME}`);
  } else if (res.matchedCount === 1 && res.modifiedCount === 1) {
    console.log(`♻️  Admin wachtwoord geüpdatet voor: ${ADMIN_USERNAME}`);
  } else {
    console.log(`ℹ️  Admin bestond al en had hetzelfde wachtwoord (geen wijziging): ${ADMIN_USERNAME}`);
  }
};

const run = async () => {
  try {
    await connectMongo();
    await Admin.init(); // zorgt dat indexes bestaan voordat we upserten
    await upsertAdmin();
  } catch (err) {
    console.error("❌ Fout tijdens seeden:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Verbinding gesloten.");
  }
};

run();
