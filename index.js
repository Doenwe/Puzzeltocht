import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

const CodeSchema = new mongoose.Schema({
  code: String,
  type: String  // "user" or "admin"
});

const AdminSchema = new mongoose.Schema({
  username: String,
  password: String
});

const Code = mongoose.model("Code", CodeSchema);
const Admin = mongoose.model("Admin", AdminSchema);

// ---------- ROUTES ----------

// Startpagina
app.get("/", (req, res) => {
  res.render("index");
});

// Code afhandeling
app.post("/check-code", async (req, res) => {
  const { code } = req.body;

  const found = await Code.findOne({ code });

  if (!found) return res.send("Code niet gevonden!");

  if (found.type === "admin") {
    return res.redirect("/admin-login?code=" + code);
  }

  return res.redirect("/next");
});

// Gebruikerspagina
app.get("/next", (req, res) => {
  res.render("next");
});

// Admin login scherm
app.get("/admin-login", (req, res) => {
  res.render("admin-login", { error: null });
});

// Admin wachtwoord check
app.post("/admin-login", async (req, res) => {
  const { username, password } = req.body;

  const admin = await Admin.findOne({ username });

  if (!admin) {
    return res.render("admin-login", { error: "Onbekende gebruiker" });
  }

  const match = await bcrypt.compare(password, admin.password);

  if (!match) {
    return res.render("admin-login", { error: "Wachtwoord klopt niet" });
  }

  res.redirect("/admin-dashboard");
});

// Admin dashboard
app.get("/admin-dashboard", (req, res) => {
  res.render("admin-dashboard");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port " + port));
