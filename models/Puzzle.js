import mongoose from "mongoose";

const ModuleSchema = new mongoose.Schema({
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }   // <-- data i.p.v. content
}, { _id: false });

const PageSchema = new mongoose.Schema({
  title: { type: String, default: "Pagina" },
  modules: { type: [ModuleSchema], default: [] }
}, { _id: false });

const PuzzleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  pages: { type: [PageSchema], default: [] }
}, { timestamps: true });  // createdAt/updatedAt automatisch

export default mongoose.model("Puzzle", PuzzleSchema);
