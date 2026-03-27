import express from "express"
import cors from "cors"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";
import FormData from "form-data";
import axios from "axios";
import { jsonToAss } from "./utils/utils.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");
const audiosDir = path.join(__dirname, "audios");
const transcriptionsDir = path.join(__dirname, "transcriptions");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(audiosDir)) fs.mkdirSync(audiosDir);
if (!fs.existsSync(transcriptionsDir)) fs.mkdirSync(transcriptionsDir);

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || ".mp4";
        const files = fs.readdirSync(uploadsDir);
        const videoFiles = files.filter(f => f.startsWith("video-") && f.endsWith(ext));
        cb(null, `video-${videoFiles.length + 1}${ext}`);
    }
});

const upload = multer({ storage });

function sendSSE(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

app.get("/", (req, res) => res.send("Content Pipeline API"));

app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    return res.json({ message: "Upload successful", file: req.file });
});

app.get("/videos", (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Cannot read uploads" });
        const videoFiles = files.filter(f => /\.(mp4|mov|avi|mkv)$/i.test(f));
        const base = `${req.protocol}://${req.headers.host}`;
        res.json(videoFiles.map(f => `${base}/uploads/${f}`));
    });
});

app.post("/save-transcription", (req, res) => {
    try {
        const { videoName, transcription } = req.body;
        if (!videoName || !transcription) return res.status(400).json({ error: "videoName and transcription are required" });
        const fileName = videoName.replace(/\.[^/.]+$/, "") + ".json";
        fs.writeFileSync(path.join(transcriptionsDir, fileName), JSON.stringify(transcription, null, 2));
        res.json({ message: "Saved", fileName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/transcribe-stream", async (req, res) => {
    try {
        const { videoUrl, format = 'json', task = 'transcribe', language = 'auto' } = req.query;
        if (!videoUrl) return res.status(400).json({ error: "Video URL is required" });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        sendSSE(res, { type: 'log', message: 'Starting transcription process...', progress: 5, level: 'info' });

        const videoFileName = videoUrl.split('/').pop();
        const videoPath = path.join(uploadsDir, videoFileName);

        if (!fs.existsSync(videoPath)) {
            sendSSE(res, { type: 'error', message: "Video file not found" });
            return res.end();
        }

        sendSSE(res, { type: 'log', message: `Video file found: ${videoFileName}`, progress: 10, level: 'info' });

        const audioBaseName = videoFileName.replace(/\.[^/.]+$/, '');
        const audioPath = path.join(audiosDir, `audio-${audioBaseName}.mp3`);

        sendSSE(res, { type: 'progress', message: "Extracting audio from video...", stage: 'extracting', progress: 15 });

        await new Promise((resolve, reject) => {
            let lastProgress = 15;
            ffmpeg(videoPath)
                .toFormat('mp3')
                .audioBitrate(128)
                .on('start', cmd => sendSSE(res, { type: 'log', message: `FFmpeg: ${cmd}`, level: 'debug' }))
                .on('progress', p => {
                    const pct = Math.floor(p.percent || 0);
                    if (pct > lastProgress) {
                        lastProgress = pct;
                        sendSSE(res, { type: 'progress', message: `Extracting audio: ${pct}%`, stage: 'extracting', progress: Math.min(50, 15 + pct * 0.35) });
                    }
                })
                .on('end', () => { sendSSE(res, { type: 'log', message: 'Audio extraction done', progress: 50, level: 'success' }); resolve(); })
                .on('error', err => { sendSSE(res, { type: 'error', message: `FFmpeg error: ${err.message}` }); reject(err); })
                .save(audioPath);
        });

        const formData = new FormData();
        formData.append('audio_file', fs.createReadStream(audioPath));

        const queryParams = new URLSearchParams({
            output: format, task,
            ...(language !== 'auto' && { language }),
            word_timestamps: 'true', vad_filter: 'true'
        });

        sendSSE(res, { type: 'progress', message: "Sending to Whisper AI...", stage: 'transcribing', progress: 60 });

        const asrResponse = await axios.post(
            `http://localhost:9000/asr?${queryParams}`,
            formData,
            { headers: formData.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity }
        );

        sendSSE(res, { type: 'log', message: 'Transcription received', progress: 95, level: 'success' });

        const responseData = asrResponse.data;
        sendSSE(res, { type: 'log', message: `Processed ${responseData.segments?.length || 0} segments`, level: 'info' });
        sendSSE(res, { type: 'result', data: responseData, videoFileName, progress: 100 });
        sendSSE(res, { type: 'log', message: '✨ Transcription complete!', progress: 100, level: 'success' });
        res.end();

    } catch (error) {
        sendSSE(res, { type: 'error', message: error.response?.data?.error || error.message });
        res.end();
    }
});

app.post("/transcribe", async (req, res) => {
    try {
        const { videoUrl, format = 'json', task = 'transcribe', language = 'auto' } = req.body;
        if (!videoUrl) return res.status(400).json({ error: "Video URL is required" });

        const videoFileName = videoUrl.split('/').pop();
        const videoPath = path.join(uploadsDir, videoFileName);
        if (!fs.existsSync(videoPath)) return res.status(404).json({ error: "Video file not found" });

        const audioBaseName = videoFileName.replace(/\.[^/.]+$/, '');
        const audioPath = path.join(audiosDir, `audio-${audioBaseName}.mp3`);

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath).toFormat('mp3').audioBitrate(128).on('end', resolve).on('error', reject).save(audioPath);
        });

        const formData = new FormData();
        formData.append('audio_file', fs.createReadStream(audioPath));

        const queryParams = new URLSearchParams({
            output: format, task,
            ...(language !== 'auto' && { language }),
            word_timestamps: 'true', vad_filter: 'true'
        });

        const asrResponse = await axios.post(`http://localhost:9000/asr?${queryParams}`, formData, {
            headers: formData.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity
        });

        res.json({ ...asrResponse.data, videoFileName });
    } catch (error) {
        if (error.response) return res.status(error.response.status).json({ error: "ASR service error", details: error.response.data });
        res.status(500).json({ error: "Transcription failed", message: error.message });
    }
});

app.post("/detect-language", async (req, res) => {
    try {
        const { videoUrl } = req.body;
        if (!videoUrl) return res.status(400).json({ error: "Video URL is required" });

        const videoFileName = videoUrl.split('/').pop();
        const videoPath = path.join(uploadsDir, videoFileName);
        if (!fs.existsSync(videoPath)) return res.status(404).json({ error: "Video file not found" });

        const audioPath = path.join(audiosDir, `temp-${videoFileName.replace(/\.[^/.]+$/, '')}.mp3`);
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath).toFormat('mp3').duration(30).on('end', resolve).on('error', reject).save(audioPath);
        });

        const formData = new FormData();
        formData.append('audio_file', fs.createReadStream(audioPath));
        const response = await axios.post('http://localhost:9000/detect-language', formData, { headers: formData.getHeaders() });

        fs.unlinkSync(audioPath);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Language detection failed", message: error.message });
    }
});

// FIX: now accepts styleId from request body and passes it to jsonToAss
app.post("/overlay-subs", async (req, res) => {
    try {
        const { videoName, subtitleName, format, styleId = "netflix" } = req.body;

        if (!videoName || !subtitleName) return res.status(400).json({ error: "videoName and subtitleName are required" });

        const videoPath = path.join(uploadsDir, videoName);
        const subsPath = path.join(transcriptionsDir, subtitleName);

        if (!fs.existsSync(videoPath)) return res.status(404).json({ error: "Video not found" });
        if (!fs.existsSync(subsPath)) return res.status(404).json({ error: "Subtitle file not found" });

        let finalSubsPath = subsPath;
        let tempAssCreated = false;

        if (format === "json") {
            const jsonData = JSON.parse(fs.readFileSync(subsPath, "utf-8"));
            const assOutput = subsPath.replace(".json", ".ass");
            // Pass styleId so the chosen style is burned into the video
            fs.writeFileSync(assOutput, jsonToAss(jsonData, styleId));
            finalSubsPath = assOutput;
            tempAssCreated = true;
        }

        const escapedSubsPath = finalSubsPath
            .replace(/\\/g, "/")
            .replace(/^([A-Za-z]):/, "$1\\:");

        const outputFile = videoName.replace(/\.[^/.]+$/, "") + `-with-subs-${styleId}.mp4`;
        const outputPath = path.join(uploadsDir, outputFile);

        ffmpeg(videoPath)
            .videoFilters(`subtitles='${escapedSubsPath}'`)
            .on("end", () => {
                if (tempAssCreated && fs.existsSync(finalSubsPath)) fs.unlinkSync(finalSubsPath);
                const base = `${req.protocol}://${req.headers.host}`;
                return res.json({ message: "Subtitle overlay complete", url: `${base}/uploads/${outputFile}` });
            })
            .on("error", (err) => {
                if (tempAssCreated && fs.existsSync(finalSubsPath)) fs.unlinkSync(finalSubsPath);
                return res.status(500).json({ error: err.message });
            })
            .save(outputPath);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("Server Started at http://localhost:3000"));