import mongoose from "mongoose";

const AirtableMapSchema = new mongoose.Schema({
  airtableString: { type: String, required: true, unique: true },
  internalPuzzleId: { type: mongoose.Schema.Types.ObjectId, ref: "Puzzle", required: true }
});

export default mongoose.models.AirtableMap || mongoose.model("AirtableMap", AirtableMapSchema);
