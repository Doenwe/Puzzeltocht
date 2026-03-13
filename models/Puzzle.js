// models/Puzzle.js
import mongoose from "mongoose";

const ModuleSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const PageSchema = new mongoose.Schema(
  {
    title: { type: String, default: "Pagina", trim: true },
    showNext: { type: Boolean, default: true }, // toggle “Volgende pagina”
    isMap: { type: Boolean, default: false },   // kaartpagina
    modules: { type: [ModuleSchema], default: [] },
  },
  { _id: false }
);

const PuzzleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    pages: { type: [PageSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

PuzzleSchema.index({ updatedAt: -1, createdAt: -1 });

export default mongoose.model("Puzzle", PuzzleSchema);
