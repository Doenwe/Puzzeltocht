// models/Team.js
import mongoose from "mongoose";

export default mongoose.model("Team", new mongoose.Schema({
  name: String,
  puzzle: { type: mongoose.Schema.Types.ObjectId, ref: "Puzzle" },
  profilePhoto: String, // ✅ HIER
  createdAt: { type: Date, default: Date.now }
}));
