// models/Puzzle.js
import mongoose from "mongoose";

const ModuleSchema = new mongoose.Schema({
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const PageSchema = new mongoose.Schema({
  title: { type: String, default: "Pagina" },
  showNext: { type: Boolean, default: true },         // 👈 NIEUW
  modules: { type: [ModuleSchema], default: [] }
}, { _id: false });

const PuzzleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  pages: { type: [PageSchema], default: [] }
}, { timestamps: true });

export default mongoose.model("Puzzle", PuzzleSchema);
