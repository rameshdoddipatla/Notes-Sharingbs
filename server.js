const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Notes = require("./models/Note");
const {
  JWT_SECRET,
  MONGO_URI,
  ADMIN_EMAIL,
  ADMIN_PASSWORD
} = require("./config");

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));


// ✅ MONGODB CONNECTION
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));


// ✅ MULTER SETUP
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });


// ✅ USER REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exist = await User.findOne({ email });
    if (exist)
      return res.json({ success: false, message: "User already exists!" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed });

    res.json({ success: true, message: "Registered Successfully" });
  } catch (err) {
    res.json({ success: false, message: "Registration failed" });
  }
});


// ✅ USER LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user)
    return res.json({ success: false, message: "User not found!" });

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.json({ success: false, message: "Invalid password!" });

  const token = jwt.sign({ email }, JWT_SECRET);

  res.json({ success: true, message: "Login Successful", token });
});


// ✅ ADMIN LOGIN
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "1d" });

    return res.json({
      success: true,
      message: "Admin Login Successful",
      token
    });
  }

  return res.json({
    success: false,
    message: "Invalid Admin Credentials"
  });
});


// ✅ ✅ ✅ POINT 2 — UPLOAD NOTE (STATUS = "pending")
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const { title, uploadedBy } = req.body;

    if (!req.file) {
      return res.json({
        success: false,
        message: "No file selected"
      });
    }

    await Notes.create({
      title,
      filename: req.file.filename,
      filepath: "/uploads/" + req.file.filename,
      uploadedBy,
      status: "pending"   // ✅ REQUIRED
    });

    res.json({
      success: true,
      message: "File Uploaded! Waiting for Admin Approval."
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.json({
      success: false,
      message: "Upload Failed"
    });
  }
});


// ✅ ✅ ✅ POINT 3 — ADMIN: GET ALL PENDING NOTES
app.get("/api/admin/pending", async (req, res) => {
  try {
    const notes = await Notes.find({ status: "pending" });
    res.json(notes);
  } catch (error) {
    console.error("ADMIN PENDING ERROR:", error);
    res.json([]);
  }
});


// ✅ ADMIN APPROVE NOTE
app.put("/api/admin/approve/:id", async (req, res) => {
  try {
    await Notes.findByIdAndUpdate(req.params.id, { status: "approved" });
    res.json({ success: true, message: "Note Approved" });
  } catch (err) {
    res.json({ success: false, message: "Approve Failed" });
  }
});


// ✅ ADMIN REJECT NOTE
app.put("/api/admin/reject/:id", async (req, res) => {
  try {
    await Notes.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.json({ success: true, message: "Note Rejected" });
  } catch (err) {
    res.json({ success: false, message: "Reject Failed" });
  }
});


// ✅ GET ONLY APPROVED NOTES (FOR STUDENTS)
app.get("/api/notes", async (req, res) => {
  const notes = await Notes.find({ status: "approved" }).sort({ date: -1 });
  res.json(notes);
});


// ✅ START SERVER
app.listen(5000, () => {
  console.log("✅ Server running at http://localhost:5000");
});

