// index.js
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import expressLayouts from "express-ejs-layouts";

// Modellen
import Admin from "./models/Admin.js";
import Code from "./models/Code.js";
import Theme from "./models/Theme.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1); // cookies secure=true op Railway

// =============================
// MongoDB Connect
// =============================
async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI ontbreekt. Zet deze in Railway → Variables.");
    process.exit(1);
  }
  // bevat de URI al een db-naam? (…/dbname?)
  const hasDbInUri = /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(uri);

  await mongoose.connect(uri, {
    dbName: hasDbInUri ? undefined : (process.env.MONGO_DBNAME || "puzzeltocht"),
    serverSelectionTimeoutMS: 15000
  });
  console.log("MongoDB connected op DB:", mongoose.connection.name);

  mongoose.connection.on("error", (err) => console.error("Mongo error:", err));
  mongoose.connection.on("disconnected", () => console.warn("Mongo disconnected"));
}
await connectMongo();

// =============================
// App Config
// =============================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Sessies in MongoDB
const sessionSecret = process.env.SESSION_SECRET || "change-me-in-env";
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: process.env.MONGO_DBNAME || "puzzeltocht",
    collectionName: "sessions",
    ttl: 60 * 60 * 24 * 7 // 7 dagen
  }),
  cookie: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 6 // 6 uur
  }
}));

// Sessies beschikbaar in views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Theme (altijd defaults zetten als niets in DB staat)
app.use(async (req, res, next) => {
  try {
    const t = await Theme.findOne();
    res.locals.theme = t || {
      primaryColor: "#2563eb",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderRadius: "0.75rem",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji"
    };
  } catch (e) {
    console.warn("Kon theme niet laden, defaults gebruikt:", e?.message);
    res.locals.theme = {
      primaryColor: "#2563eb",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderRadius: "0.75rem",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji"
    };
  }
  next();
});

// =============================
// Helpers
// =============================
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.redirect("/admin-login");
}

// =============================
// Routes
// =============================

// Start (code invoer)
app.get("/", (req, res) => {
  res.render("index", { error: null });
});

app.post("/check-code", async (req, res) => {
  const code = (req.body.code || "").trim();
  if (!code) return res.render("index", { error: "Voer een code in" });

  const found = await Code.findOne({ code });
  if (!found) return res.render("index", { error: "Code niet gevonden" });

  if (found.type === "admin") return res.redirect("/admin-login");
  return res.redirect("/next");
});

// Volgende pagina (voorbeeld)
app.get("/next", (req, res) => {
  res.render("next");
});

// Admin login
app.get("/admin-login", (req, res) => {
  res.render("admin-login", { error: null });
});

app.post("/admin-login", async (req, res) => {
  let { username, password } = req.body;
  username = (username || "").trim();

  const admin = await Admin.findOne({ username });
  if (!admin) return res.render("admin-login", { error: "Onbekende gebruiker" });

  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) return res.render("admin-login", { error: "Wachtwoord klopt niet" });

  req.session.isAdmin = true;
  req.session.username = admin.username;
  res.redirect("/admin-dashboard");
});

// Admin logout
app.get("/admin-logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin-login"));
});

// Admin dashboard
app.get("/admin-dashboard", requireAdmin, (req, res) => {
  res.render("admin-dashboard");
});

// Admin theme editor
app.get("/admin-theme", requireAdmin, async (req, res, next) => {
  try {
    const theme = await Theme.findOne();
    res.render("admin-theme", { theme, saved: Boolean(req.query.saved) });
  } catch (e) {
    console.error("Renderfout /admin-theme:", e);
    next(e);
  }
});

app.post("/admin-theme", requireAdmin, async (req, res, next) => {
  try {
    const { primaryColor, backgroundColor, textColor, borderRadius, fontFamily } = req.body;
    await Theme.findOneAndUpdate(
      {},
      { primaryColor, backgroundColor, textColor, borderRadius, fontFamily },
      { upsert: true }
    );
    res.redirect("/admin-theme?saved=1");
  } catch (e) {
    console.error("Opslagfout theme:", e);
    next(e);
  }
});

// 404
app.use((req, res) => res.status(404).send("Pagina niet gevonden"));

// Foutafhandeling
app.use((err, req, res, next) => {
  console.error("Onverwachte fout:", err);
  res.status(500).send("Er ging iets mis.");
});

// Start
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
