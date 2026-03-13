import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import expressLayouts from "express-ejs-layouts";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import crypto from "crypto"; // <== voor unieke bestandsnamen bij image upload

import Puzzle from "./models/Puzzle.js";
import Admin from "./models/Admin.js";
import Code from "./models/Code.js";
import Theme from "./models/Theme.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  console.log("📁 Map public/uploads bestond niet – aangemaakt.");
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
app.set("trust proxy", 1);

// ===== Multer (bestaand) voor CSV =====
const upload = multer({ dest: "uploads/" });

// ===== Mongo connect =====
async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI ontbreekt");
    process.exit(1);
  }
  const hasDbInUri = /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(uri);
  await mongoose.connect(uri, {
    dbName: hasDbInUri ? undefined : (process.env.MONGO_DBNAME || "puzzeltocht"),
    serverSelectionTimeoutMS: 15000
  });
  console.log("MongoDB connected:", mongoose.connection.name);
}
await connectMongo();

// ===== View engine + layouts =====
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

// ===== Static + body parsing =====
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ===== Sessions =====
app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: process.env.MONGO_DBNAME || "puzzeltocht"
  }),
  cookie: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
}));

// ===== Locals =====
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.use(async (req, res, next) => {
  try {
    const theme = await Theme.findOne();
    res.locals.theme = theme || {
      primaryColor: "#2563eb",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderRadius: "0.75rem",
      fontFamily: "Inter, sans-serif"
    };
  } catch {
    res.locals.theme = {
      primaryColor: "#2563eb",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderRadius: "0.75rem",
      fontFamily: "Inter, sans-serif"
    };
  }
  next();
});

// ===== Auth guard =====
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.redirect("/admin-login");
}

// =====================================================
//  IMAGE UPLOAD: naar /public/uploads  (voor builder)
// =====================================================
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Zorg dat deze map bestaat: public/uploads
    cb(null, path.join(__dirname, "public", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const name = crypto.randomBytes(8).toString("hex") + ext;
    cb(null, name);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Alleen afbeeldingen toegestaan"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Endpoint voor uploads vanuit de builder
app.post("/admin-upload-image", requireAdmin, uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Geen bestand" });
  const url = `/uploads/${req.file.filename}`; // publiek pad
  res.json({ url });
});

// =====================================================
//  Routes
// =====================================================
app.get("/", (req, res) => {
  res.render("index", { error: null });
});

app.post("/check-code", async (req, res) => {
  const code = (req.body.code || "").trim();
  const found = await Code.findOne({ code });

  if (!found) return res.render("index", { error: "Code niet gevonden" });
  if (found.type === "admin") return res.redirect("/admin-login");

  res.redirect("/next");
});

app.get("/next", async (req, res) => {
  const puzzles = await Puzzle.find().sort({ createdAt: -1 });
  res.render("next", { puzzles });
});

app.get("/admin-login", (req, res) => {
  res.render("admin-login", { error: null });
});

app.post("/admin-login", async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });

  if (!admin) return res.render("admin-login", { error: "Onbekende gebruiker" });

  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) return res.render("admin-login", { error: "Wachtwoord fout" });

  req.session.isAdmin = true;
  res.redirect("/admin-dashboard");
});

app.get("/admin-logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin-login"));
});

app.get("/admin-dashboard", requireAdmin, (req, res) => {
  res.render("admin-dashboard");
});

// ===== Codes beheren =====
app.post("/admin-add-code", requireAdmin, async (req, res) => {
  const { code, type } = req.body;
  if (!code) return res.redirect("/admin-dashboard");

  await Code.create({
    code: code.trim(),
    type: type || "user"
  });

  res.redirect("/admin-dashboard");
});

app.post("/admin-upload-csv", requireAdmin, upload.single("csvfile"), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      const codes = results.map(r => ({
        code: (r.code || "").trim(),
        type: r.type || "user"
      }));
      await Code.insertMany(codes, { ordered: false });
      fs.unlinkSync(req.file.path);
      res.redirect("/admin-dashboard");
    });
});

// ===== Thema =====
app.get("/admin-theme", requireAdmin, async (req, res) => {
  let theme = await Theme.findOne();
  if (!theme) {
    theme = {
      primaryColor: "#2563eb",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderRadius: "0.75rem",
      fontFamily: "Inter, sans-serif"
    };
  }
  res.render("admin-theme", { theme, saved: false });
});

app.post("/admin-theme", requireAdmin, async (req, res) => {
  const { primaryColor, backgroundColor, textColor, borderRadius, fontFamily } = req.body;
  await Theme.findOneAndUpdate(
    {},
    { primaryColor, backgroundColor, textColor, borderRadius, fontFamily },
    { upsert: true }
  );
  res.render("admin-theme", { theme: req.body, saved: true });
});

// ===== Puzzels =====
app.get("/admin-puzzles", requireAdmin, async (req, res) => {
  const puzzles = await Puzzle.find().sort({ createdAt: -1 });
  res.render("admin-puzzles", { puzzles });
});

app.get("/admin-puzzles/new", requireAdmin, (req, res) => {
  res.render("admin-new-puzzle");
});

app.post("/admin-puzzles/new", requireAdmin, async (req, res) => {
  const puzzle = await Puzzle.create({
    name: req.body.name,
    pages: [
      {
        title: "Pagina 1",
        modules: []
      }
    ]
  });
  res.redirect(`/admin-builder/${puzzle._id}`);
});

// ===== Builder =====
app.get("/admin-builder/:id", requireAdmin, async (req, res) => {
  const puzzle = await Puzzle.findById(req.params.id);
  res.render("admin-builder", {
    puzzle,
    builderPage: true
  });
});

// Alle pagina’s tegelijk opslaan
app.post("/admin-builder/:id/save-all", requireAdmin, express.json(), async (req, res) => {
  try {
    const puzzle = await Puzzle.findById(req.params.id);
    if (!puzzle) return res.status(404).send("Puzzle niet gevonden");

    const pages = Array.isArray(req.body.pages) ? req.body.pages : [];

    const safePages = pages.map(p => ({
      title: (p?.title ?? "Pagina"),
      showNext: (typeof p?.showNext === "boolean" ? p.showNext : true),
      isMap: (typeof p?.isMap === "boolean" ? p.isMap : false),
      modules: Array.isArray(p?.modules)
        ? p.modules.map(m => ({
            type: String(m?.type || ""),
            data: m?.data || {}
          }))
        : []
    }));

    puzzle.pages = safePages;
    puzzle.markModified("pages");
    await puzzle.save();

    res.send("OK");
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error");
  }
});

// ===== Speler (direct naar pagina 1) =====
app.get("/puzzle/:id", async (req, res) => {
  const puzzle = await Puzzle.findById(req.params.id);
  if (!puzzle) return res.status(404).send("Puzzel niet gevonden");
  res.redirect(`/puzzle/${puzzle._id}/0`);
});

app.get("/puzzle/:id/:page", async (req, res) => {
  const puzzle = await Puzzle.findById(req.params.id);
  if (!puzzle) return res.status(404).send("Puzzel niet gevonden");

  const pageIndex = Number(req.params.page);
  const page = puzzle.pages[pageIndex];
  if (!page) return res.status(404).send("Pagina niet gevonden");

  res.render("puzzle-page", { puzzle, page, pageIndex });
});

// ===== (optioneel) debug endpoint om opgeslagen data te bekijken =====
// app.get("/debug/puzzle/:id", async (req, res) => {
//   const p = await Puzzle.findById(req.params.id).lean();
//   res.type("json").send(JSON.stringify(p, null, 2));
// });

// ===== 404 =====
app.use((req, res) => res.status(404).send("Pagina niet gevonden"));

// ===== Start =====
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("Server gestart op poort", port);
});
