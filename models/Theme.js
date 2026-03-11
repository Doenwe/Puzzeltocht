import mongoose from "mongoose";

const ThemeSchema = new mongoose.Schema(
  {
    primaryColor: { type: String, default: "#2563eb" },
    backgroundColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#111827" },
    borderRadius: { type: String, default: "0.75rem" },
    fontFamily: {
      type: String,
      default:
        "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji"
    }
  },
  { collection: "theme", timestamps: true }
);

export default mongoose.models.Theme || mongoose.model("Theme", ThemeSchema);
