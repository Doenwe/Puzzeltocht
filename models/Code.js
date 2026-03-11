import mongoose from "mongoose";

const CodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ["user", "admin"], default: "user" }
  },
  { collection: "codes", timestamps: true }
);

CodeSchema.index({ code: 1 }, { unique: true });

export default mongoose.models.Code || mongoose.model("Code", CodeSchema);
