import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI);

const AdminSchema = new mongoose.Schema({
  username: String,
  password: String
});

const Admin = mongoose.model("Admin", AdminSchema);

const run = async () => {
  const hash = await bcrypt.hash("jouwWachtwoord", 10);

  await Admin.create({
    username: "admin",
    password: hash
  });

  console.log("Admin aangemaakt");
  mongoose.disconnect();
};

run();
