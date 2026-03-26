import express from "express"
import cors from "cors"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";
import FormData from "form-data";
import axios from "axios";
import { EventEmitter } from 'events';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");
const audiosDir = path.join(__dirname, "audios");

// Ensure directories exist
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(audiosDir)) {
    fs.mkdirSync(audiosDir);
}

const app = express();
app.use(express.static("uploads"));
app.use(express.json());
app.use(cors());
app.use(express.static("uploads"));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads");
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || ".mp4";
        const files = fs.readdirSync("uploads");
        const videoFiles = files.filter(f => f.startsWith("video-") && f.endsWith(ext));
        const nextIndex = videoFiles.length + 1;
        const filename = `video-${nextIndex}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({ storage });

// Helper function to send SSE messages
function sendSSE(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

app.get("/", (req, res) => {
    return res.send("Content Pipeline API");
});

app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    return res.json({
        message: "Upload successful",
        file: req.file
    });
});

// Return list of video URLs
app.get("/videos", (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Cannot read uploads" });
        const videoFiles = files.filter(f => /\.(mp4|mov|avi|mkv)$/i.test(f));
        const videoUrls = videoFiles.map(f => `http://localhost:3000/uploads/${f}`);
        res.json(videoUrls);
    });
});

// Streaming transcription endpoint with SSE
app.get("/transcribe-stream", async (req, res) => {
    try {
        const { videoUrl, format = 'json', task = 'transcribe', language = 'auto' } = req.query;
        
        if (!videoUrl) {
            return res.status(400).json({ error: "Video URL is required" });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        sendSSE(res, { type: 'log', message: `Starting transcription process for video...`, progress: 5, level: 'info' });
        
        // Extract filename from URL
        const videoFileName = videoUrl.split('/').pop();
        const videoPath = path.join(uploadsDir, videoFileName);
        
        // Check if video file exists
        if (!fs.existsSync(videoPath)) {
            sendSSE(res, { type: 'error', message: "Video file not found" });
            return res.end();
        }

        sendSSE(res, { type: 'log', message: `Video file found: ${videoFileName}`, progress: 10, level: 'info' });

        // Generate audio filename
        const audioBaseName = videoFileName.replace(/\.[^/.]+$/, '');
        const audioFileName = `audio-${audioBaseName}.mp3`;
        const audioPath = path.join(audiosDir, audioFileName);

        // Extract audio using ffmpeg with progress
        sendSSE(res, { type: 'progress', message: "Extracting audio from video...", stage: 'extracting', progress: 15 });
        
        await new Promise((resolve, reject) => {
            let lastProgress = 15;
            
            ffmpeg(videoPath)
                .toFormat('mp3')
                .audioBitrate(128)
                .on('start', (commandLine) => {
                    sendSSE(res, { type: 'log', message: `FFmpeg command: ${commandLine}`, level: 'debug' });
                })
                .on('progress', (progress) => {
                    const percent = Math.floor(progress.percent);
                    if (percent > lastProgress) {
                        lastProgress = percent;
                        const overallProgress = 15 + (percent * 0.35); // 15% to 50% for audio extraction
                        sendSSE(res, { 
                            type: 'progress', 
                            message: `Extracting audio: ${percent}%`, 
                            stage: 'extracting', 
                            progress: Math.min(50, overallProgress) 
                        });
                    }
                })
                .on('end', () => {
                    sendSSE(res, { type: 'log', message: 'Audio extraction completed successfully', progress: 50, level: 'success' });
                    resolve();
                })
                .on('error', (err) => {
                    sendSSE(res, { type: 'error', message: `FFmpeg error: ${err.message}` });
                    reject(err);
                })
                .save(audioPath);
        });

        sendSSE(res, { type: 'log', message: `Audio saved to: ${audioFileName}`, progress: 55, level: 'info' });
        
        // Prepare form data for ASR service
        const formData = new FormData();
        const audioStream = fs.createReadStream(audioPath);
        formData.append('audio_file', audioStream);
        
        // Build query parameters
        const queryParams = new URLSearchParams({
            output: format,
            task: task,
            ...(language !== 'auto' && { language }),
            word_timestamps: 'true',
            vad_filter: 'true'
        });

        sendSSE(res, { type: 'progress', message: "Sending to Whisper AI for transcription...", stage: 'transcribing', progress: 60 });
        sendSSE(res, { type: 'log', message: `ASR Service URL: http://localhost:9000/asr?${queryParams.toString()}`, level: 'debug' });

        // Send request to ASR service with progress tracking
        let lastProgressUpdate = 60;
        
        const asrResponse = await axios.post(
            `http://localhost:9000/asr?${queryParams.toString()}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    if (percent > lastProgressUpdate) {
                        lastProgressUpdate = percent;
                        const overallProgress = 60 + (percent * 0.3); // 60% to 90% for upload
                        sendSSE(res, { 
                            type: 'progress', 
                            message: `Uploading audio: ${percent}%`, 
                            stage: 'transcribing', 
                            progress: Math.min(90, overallProgress) 
                        });
                    }
                },
            }
        );

        sendSSE(res, { type: 'log', message: 'Transcription received from ASR service', progress: 95, level: 'success' });
        
        // Optional: Clean up audio file to save space
        // fs.unlinkSync(audioPath);
        // sendSSE(res, { type: 'log', message: 'Temporary audio file cleaned up', level: 'info' });
        
        // Return transcription result
        let responseData;
        if (format === 'json') {
            responseData = asrResponse.data;
            const segmentCount = responseData.segments?.length || 0;
            sendSSE(res, { type: 'log', message: `Processed ${segmentCount} segments`, level: 'info' });
        } else {
            responseData = asrResponse.data;
        }
        
        sendSSE(res, { type: 'result', data: responseData, progress: 100 });
        sendSSE(res, { type: 'log', message: '✨ Transcription process completed! ✨', progress: 100, level: 'success' });
        
        res.end();
        
    } catch (error) {
        console.error('Transcription error:', error.message);
        sendSSE(res, { 
            type: 'error', 
            message: error.response?.data?.error || error.message,
            details: error.response?.data
        });
        res.end();
    }
});

// Regular POST transcription endpoint (fallback)
app.post("/transcribe", async (req, res) => {
    try {
        const { videoUrl, format = 'json', task = 'transcribe', language = 'auto' } = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({ error: "Video URL is required" });
        }

        // Extract filename from URL
        const videoFileName = videoUrl.split('/').pop();
        const videoPath = path.join(uploadsDir, videoFileName);
        
        // Check if video file exists
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: "Video file not found" });
        }

        // Generate audio filename
        const audioBaseName = videoFileName.replace(/\.[^/.]+$/, '');
        const audioFileName = `audio-${audioBaseName}.mp3`;
        const audioPath = path.join(audiosDir, audioFileName);

        // Extract audio using ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .toFormat('mp3')
                .audioBitrate(128)
                .on('end', () => {
                    console.log('Audio extraction completed:', audioPath);
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .save(audioPath);
        });

        // Prepare form data for ASR service
        const formData = new FormData();
        formData.append('audio_file', fs.createReadStream(audioPath));
        
        // Build query parameters
        const queryParams = new URLSearchParams({
            output: format,
            task: task,
            ...(language !== 'auto' && { language }),
            word_timestamps: 'true',
            vad_filter: 'true'
        });

        // Send request to ASR service
        const asrResponse = await axios.post(
            `http://localhost:9000/asr?${queryParams.toString()}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            }
        );

        // Optional: Clean up audio file to save space
        // fs.unlinkSync(audioPath);
        
        // Return transcription result
        let responseData;
        if (format === 'json') {
            responseData = asrResponse.data;
        } else {
            responseData = asrResponse.data;
        }
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Transcription error:', error.message);
        if (error.response) {
            console.error('ASR Service Response:', error.response.data);
            return res.status(error.response.status).json({
                error: "ASR service error",
                details: error.response.data
            });
        }
        res.status(500).json({ 
            error: "Transcription failed",
            message: error.message 
        });
    }
});

// Language detection endpoint
app.post("/detect-language", async (req, res) => {
    try {
        const { videoUrl } = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({ error: "Video URL is required" });
        }

        const videoFileName = videoUrl.split('/').pop();
        const videoPath = path.join(uploadsDir, videoFileName);
        
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: "Video file not found" });
        }

        const audioBaseName = videoFileName.replace(/\.[^/.]+$/, '');
        const audioFileName = `temp-${audioBaseName}.mp3`;
        const audioPath = path.join(audiosDir, audioFileName);

        // Extract audio
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .toFormat('mp3')
                .duration(30) // Only first 30 seconds for language detection
                .on('end', resolve)
                .on('error', reject)
                .save(audioPath);
        });

        const formData = new FormData();
        formData.append('audio_file', fs.createReadStream(audioPath));

        const response = await axios.post(
            'http://localhost:9000/detect-language',
            formData,
            {
                headers: formData.getHeaders(),
            }
        );

        // Clean up
        fs.unlinkSync(audioPath);

        res.json(response.data);
        
    } catch (error) {
        console.error('Language detection error:', error.message);
        res.status(500).json({ 
            error: "Language detection failed",
            message: error.message 
        });
    }
});

// Serve video files for download/stream
app.use("/uploads", express.static("./uploads"));

app.listen(3000, () => {
    console.log("Server Started at http://localhost:3000");
});