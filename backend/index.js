import express from "express"
import cors from "cors"
import multer from "multer"
import fs from "fs"
import path from "path"

const app = express()

// ensure uploads directory exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads")
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads")
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || ".mp4"

        // count existing video files
        const files = fs.readdirSync("uploads")
        const videoFiles = files.filter(f => f.startsWith("video-") && f.endsWith(ext))

        const nextIndex = videoFiles.length + 1
        const filename = `video-${nextIndex}${ext}`

        cb(null, filename)
    }
})

const upload = multer({ storage })

app.use(express.json())
app.use(cors())
app.use(express.static("uploads"))

app.get("/", (req, res) => {
    return res.send("Content Pipeline API")
})

app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" })
    }

    return res.json({
        message: "Upload successful",
        file: req.file
    })
})

app.listen(3000, () => {
    console.log("Server Started at http://localhost:3000")
})