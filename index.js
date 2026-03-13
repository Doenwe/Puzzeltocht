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

import Puzzle from "./models/Puzzle.js";
import Admin from "./models/Admin.js";
import Code from "./models/Code.js";
import Theme from "./models/Theme.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

const upload = multer({ dest: "uploads/" });

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
  cookie: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
}));

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

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.redirect("/admin-login");
}

app.get("/", (req, res) => {
  res.render("index", { error: null });
});

app.post("/check-code", async (req, res) => {

  const code = (req.body.code || "").trim();

  const found = await Code.findOne({ code });

  if (!found) {
    return res.render("index", { error: "Code niet gevonden" });
  }

  if (found.type === "admin") {
    return res.redirect("/admin-login");
  }

  res.redirect("/next");

});

app.get("/next", (req, res) => {
  res.render("next");
});

app.get("/admin-login", (req, res) => {
  res.render("admin-login", { error: null });
});

app.post("/admin-login", async (req, res) => {

  const { username, password } = req.body;

  const admin = await Admin.findOne({ username });

  if (!admin) {
    return res.render("admin-login", { error: "Onbekende gebruiker" });
  }

  const ok = await bcrypt.compare(password, admin.password);

  if (!ok) {
    return res.render("admin-login", { error: "Wachtwoord fout" });
  }

  req.session.isAdmin = true;

  res.redirect("/admin-dashboard");

});

app.get("/admin-logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin-login"));
});

app.get("/admin-dashboard", requireAdmin, (req, res) => {
  res.render("admin-dashboard");
});

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
        code: r.code.trim(),
        type: r.type || "user"
      }));

      await Code.insertMany(codes, { ordered: false });

      fs.unlinkSync(req.file.path);

      res.redirect("/admin-dashboard");

    });

});

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

app.use((req, res) => res.status(404).send("Pagina niet gevonden"));

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log("Server gestart op poort", port);
});
