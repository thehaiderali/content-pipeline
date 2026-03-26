import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) =>{ cb(null, uploadsDir); },
  filename: (req, file, cb)=> { cb(null, file.originalname); } // keep original name
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());

// Upload endpoint
app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ message: "Upload successful", filename: req.file.filename });
});

// Return list of video URLs
app.get("/videos", (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Cannot read uploads" });
    const videoFiles = files.filter(f => /\.(mp4|mov|avi|mkv)$/i.test(f));
    // prepend full URL
    const videoUrls = videoFiles.map(f => `http://localhost:3000/uploads/${f}`);
    res.json(videoUrls);
  });
});

// Serve video files for download/stream
app.use("/uploads", express.static(uploadsDir));

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));