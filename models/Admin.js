import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
  },
  { collection: "admins", timestamps: true }
);

AdminSchema.index({ username: 1 }, { unique: true });

export default mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
