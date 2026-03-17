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
import crypto from "crypto";

import Puzzle from "./models/Puzzle.js";
import Admin from "./models/Admin.js";
import Code from "./models/Code.js";
import Theme from "./models/Theme.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);


// Multer (CSV)
const upload = multer({ dest: "uploads/" });

// Multer (images -> public/uploads)
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const name = crypto.randomBytes(8).toString("hex") + ext;
    cb(null, name);
  }
});
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (
      !file.mimetype.startsWith("image/") &&
      !file.mimetype.startsWith("audio/")
    ){
      return cb(new Error("Alleen afbeeldingen of geluidsbestanden toegestaan"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// === Zorg dat uploads-map bestaat ===
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  console.log("📁 Map public/uploads bestond niet – aangemaakt.");
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 Map public/uploads bestond niet – aangemaakt.");
}

// Mongo connect
async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("❌ MONGO_URI ontbreekt"); process.exit(1); }
  const hasDbInUri = /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(uri);
  await mongoose.connect(uri, {
    dbName: hasDbInUri ? undefined : (process.env.MONGO_DBNAME || "puzzeltocht"),
    serverSelectionTimeoutMS: 15000
  });
  console.log("MongoDB connected:", mongoose.connection.name);
}
await connectMongo();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: process.env.MONGO_DBNAME || "puzzeltocht"
  }),
  cookie: { sameSite: "lax", secure: process.env.NODE_ENV === "production" }
}));

app.use((req, res, next) => { res.locals.session = req.session; next(); });

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

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.redirect("/admin-login");
}

// Upload endpoint (images)
app.post("/admin-upload-image", requireAdmin, uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Geen bestand" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

app.use(express.json());

// Routes
app.get("/", (req, res) => { res.render("index", { error: null }); });

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

app.get("/admin-login", (req, res) => res.render("admin-login", { error: null }));

app.post("/admin-login", async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin) return res.render("admin-login", { error: "Onbekende gebruiker" });
  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) return res.render("admin-login", { error: "Wachtwoord fout" });
  req.session.isAdmin = true;
  res.redirect("/admin-dashboard");
});

app.get("/admin-logout", (req, res) => { req.session.destroy(() => res.redirect("/admin-login")); });
app.get("/admin-dashboard", requireAdmin, (req, res) => res.render("admin-dashboard"));

app.post("/admin-add-code", requireAdmin, async (req, res) => {
  const { code, type } = req.body;
  if (!code) return res.redirect("/admin-dashboard");
  await Code.create({ code: code.trim(), type: type || "user" });
  res.redirect("/admin-dashboard");
});

app.post("/admin-upload-csv", requireAdmin, upload.single("csvfile"), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      const codes = results.map(r => ({ code: (r.code || "").trim(), type: r.type || "user" }));
      await Code.insertMany(codes, { ordered: false });
      fs.unlinkSync(req.file.path);
      res.redirect("/admin-dashboard");
    });
});

app.get("/admin-theme", requireAdmin, async (req, res) => {
  let theme = await Theme.findOne();
  if (!theme) {
    theme = { primaryColor: "#2563eb", backgroundColor: "#ffffff", textColor: "#111827", borderRadius: "0.75rem", fontFamily: "Inter, sans-serif" };
  }
  res.render("admin-theme", { theme, saved: false });
});

app.post("/admin-theme", requireAdmin, async (req, res) => {
  const { primaryColor, backgroundColor, textColor, borderRadius, fontFamily } = req.body;
  await Theme.findOneAndUpdate({}, { primaryColor, backgroundColor, textColor, borderRadius, fontFamily }, { upsert: true });
  res.render("admin-theme", { theme: req.body, saved: true });
});

app.get("/admin-puzzles", requireAdmin, async (req,res)=>{
  const puzzles = await Puzzle.find().sort({createdAt:-1});
  res.render("admin-puzzles",{puzzles});
});

app.get("/admin-puzzles/new", requireAdmin, (req,res)=> res.render("admin-new-puzzle"));

app.post("/admin-puzzles/new", requireAdmin, async (req,res)=>{
  const puzzle = await Puzzle.create({ name:req.body.name, pages:[{ title:"Pagina 1", showNext:true, isMap:false, modules:[] }] });
  res.redirect(`/admin-builder/${puzzle._id}`);
});

app.get("/admin-builder/:id", requireAdmin, async (req,res)=>{
  const puzzle = await Puzzle.findById(req.params.id);
  res.render("admin-builder", { puzzle, builderPage: true });
});

app.post("/admin-builder/:id/save-all", requireAdmin, express.json(), async (req, res) => {
  try {
    const puzzle = await Puzzle.findById(req.params.id);
    if (!puzzle) return res.status(404).send("Puzzle niet gevonden");

    const pages = Array.isArray(req.body.pages) ? req.body.pages : [];

    // Helper: parse getal of null
    const toNumOrNull = (v) => {
      if (v === "" || v === undefined || v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // Helper: parse radius (default 50)
    const toRadius = (v) => {
      if (v === "" || v === undefined || v === null) return 50;
      const n = Number(v);
      return Number.isFinite(n) ? n : 50;
    };

    const safePages = pages.map((p, index) => {
      const title =
        typeof p?.title === "string" && p.title.trim()
          ? p.title.trim()
          : `Pagina ${index + 1}`;

      const showNext =
        typeof p?.showNext === "boolean" ? p.showNext : true;

      const isMap =
        typeof p?.isMap === "boolean" ? p.isMap : false;

      // ⭐ Nieuw
      const showTarget =
        typeof p?.showTarget === "boolean" ? p.showTarget : true;

      const autoNext =
        typeof p?.autoNext === "boolean" ? p.autoNext : false;

    const playSound =
      typeof p?.playSound === "boolean" ? p.playSound : false;

      const soundUrl =
        typeof p?.soundUrl === "string" && p.soundUrl.trim()
          ? p.soundUrl.trim()
          : "";

      // ⭐ Nieuw — doellocatie opslaan
      const targetLat = toNumOrNull(p?.targetLat);
      const targetLng = toNumOrNull(p?.targetLng);
      const targetRadius = toRadius(p?.targetRadius);

      // Module-data normaliseren
      const modules = Array.isArray(p?.modules)
        ? p.modules
            .filter(
              (m) =>
                m &&
                typeof m.type === "string" &&
                m.type.trim().length > 0
            )
            .map((m) => ({
              type: m.type.trim(),
              data: m.data || {},
            }))
        : [];

      return {
        title,
        showNext,
        isMap,
        targetLat,
        targetLng,
        targetRadius,

        // nieuwe velden
        showTarget,
        autoNext,
        playSound,
        soundUrl,

        modules,
      };
    });

    // Opslaan in DB
    puzzle.pages = safePages;
    puzzle.markModified("pages");
    await puzzle.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan:", err);
    res.status(500).send("Server error");
  }
});

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

// app.get("/debug/puzzle/:id", async (req, res) => {
//   const p = await Puzzle.findById(req.params.id).lean();
//   res.type("json").send(JSON.stringify(p, null, 2));
// });

app.use((req, res) => res.status(404).send("Pagina niet gevonden"));

const port = process.env.PORT || 8080;
app.listen(port, () => { console.log("Server gestart op poort", port); });
