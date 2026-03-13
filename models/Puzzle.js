// models/Puzzle.js
import mongoose from "mongoose";

/**
 * Module binnen een pagina.
 * data is flexibel (Mixed) zodat we:
 *  - text:   { text: "<p>HTML ...</p>" }
 *  - image:  { url: "/uploads/abc.png" | "https://..." }
 *  - question: { question, answer, goodPage, badPage }
 *  - location: { lat, lng, radius }
 * kunnen opslaan zonder schema-wijzigingen.
 */
const ModuleSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/**
 * Pagina in de puzzel.
 * - showNext: bepaalt of “Volgende pagina” zichtbaar is in de speler.
 * - isMap:    als true => render alleen een kaart met huidige locatie.
 */
const PageSchema = new mongoose.Schema(
  {
    title: { type: String, default: "Pagina", trim: true },
    showNext: { type: Boolean, default: true },
    isMap: { type: Boolean, default: false },
    modules: { type: [ModuleSchema], default: [] },
  },
  { _id: false }
);

/**
 * Puzzel-root document.
 */
const PuzzleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    pages: { type: [PageSchema], default: [] },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        // Convert _id -> id voor nette JSON (optioneel)
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

// (optioneel) handig indexje als je vaak sorteert/ophaalt op update volgorde
PuzzleSchema.index({ updatedAt: -1, createdAt: -1 });

export default mongoose.model("Puzzle", PuzzleSchema);
