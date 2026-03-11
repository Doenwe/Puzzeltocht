import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB..."))
  .catch(err => console.error("MongoDB connection error:", err));

const AdminSchema = new mongoose.Schema({
  username: String,
  password: String
});

const Admin = mongoose.model("Admin", AdminSchema);

const run = async () => {
  try {
    const hashedPassword = await bcrypt.hash("Mudrun2026", 10);

    await Admin.create({
      username: "doenwe",
      password: hashedPassword
    });

    console.log("✅ Admin gebruiker succesvol aangemaakt:");
    console.log("   Username: doenwe");
    console.log("   Password: Mudrun2026");

  } catch (err) {
    console.error("Fout bij aanmaken admin:", err);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB afgesloten.");
  }
};

run();
