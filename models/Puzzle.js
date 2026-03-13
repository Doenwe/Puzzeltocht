import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema({
  type: String,
  content: mongoose.Schema.Types.Mixed
});

const pageSchema = new mongoose.Schema({
  title: String,
  modules: [moduleSchema]
});

const puzzleSchema = new mongoose.Schema({
  name: String,
  pages: [pageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Puzzle", puzzleSchema);
