import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

import Admin from "./models/Admin.js";
import Code from "./models/Code.js";
import Theme from "./models/Theme.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---------- DB CONNECT ----------
const connectMongo = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI ontbreekt. Zet deze in Railway → Variables.");
    process.exit(1);
  }
  const hasDbInUri = /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(uri);
  await mongoose.connect(uri, {
    dbName: hasDbInUri ? undefined : (process.env.MONGO_DBNAME || "puzzeltocht"),
    serverSelectionTimeoutMS: 15000
  });
  console.log("MongoDB connected op DB:", mongoose.connection.name);
};

await connectMongo();

// ---------- APP CONFIG ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "change-me-in-env",
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
}));

// voeg session beschikbaar aan views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// laad theme voor alle pagina's
app.use(async (req, res, next) => {
  try {
    const theme = await Theme.findOne();
    res.locals.theme = theme || {
      primaryColor: "#2563eb",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderRadius: "0.75rem",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji"
    };
  } catch {
    res.locals.theme = {
      primaryColor: "#2563eb",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderRadius: "0.75rem",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji"
    };
  }
  next();
});

// ---------- HELPERS ----------
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.redirect("/admin-login");
}

// ---------- ROUTES ----------

// Home: code invoer
app.get("/", (req, res) => {
  res.render("index", { error: null });
});

app.post("/check-code", async (req, res) => {
  const code = (req.body.code || "").trim();
  if (!code) return res.render("index", { error: "Voer een code in" });

  const found = await Code.findOne({ code });
  if (!found) return res.render("index", { error: "Code niet gevonden" });

  if (found.type === "admin") {
    return res.redirect("/admin-login");
  }
  return res.redirect("/next");
});

// Volgende pagina (dummy)
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
  if (!admin) {
    return res.render("admin-login", { error: "Onbekende gebruiker" });
  }
  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) {
    return res.render("admin-login", { error: "Wachtwoord klopt niet" });
  }

  req.session.isAdmin = true;
  req.session.username = admin.username;
  res.redirect("/admin-dashboard");
});

app.get("/admin-logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login");
  });
});

// Admin dashboard
app.get("/admin-dashboard", requireAdmin, (req, res) => {
  res.render("admin-dashboard");
});

// Admin theme editor
app.get("/admin-theme", requireAdmin, async (req, res) => {
  const theme = await Theme.findOne();
  res.render("admin-theme", { theme, saved: Boolean(req.query.saved) });
});

app.post("/admin-theme", requireAdmin, async (req, res) => {
  const { primaryColor, backgroundColor, textColor, borderRadius, fontFamily } = req.body;

  await Theme.findOneAndUpdate(
    {},
    { primaryColor, backgroundColor, textColor, borderRadius, fontFamily },
    { upsert: true }
  );

  res.redirect("/admin-theme?saved=1");
});

// Debug (optioneel): lijst admins
// app.get("/debug-admins", async (req, res) => {
//   const list = await Admin.find({}, { username: 1, _id: 0 });
//   res.type("text").send(`DB: ${mongoose.connection.name}\nAdmins: ${list.map(d => d.username).join(", ")}`);
// });

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
