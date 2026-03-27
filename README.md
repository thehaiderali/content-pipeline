# Content Pipeline 

A complete video processing platform with transcription and subtitle overlay capabilities.

## Features

- 📤 **Video Upload** - Auto-named file storage
- 🎵 **Audio Extraction** - FFmpeg-based audio processing
- 🎙️ **AI Transcription** - Real-time streaming with progress updates using Whisper ASR
- 🌍 **Language Detection** - Auto-detect video language
- 🎨 **Subtitle Styles** - 8 customizable subtitle styles (Netflix, YouTube, etc.)
- 🔥 **Subtitle Burn-in** - Permanently embed subtitles into videos

## Quick Start

### Prerequisites
- Node.js (v14+)
- FFmpeg installed on your system
- Docker (for Whisper ASR service)

### Installation

```bash
# Clone and install backend
git clone <repository-url>
cd backend
npm install

# Install frontend
cd ../frontend
npm install

# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm run dev
```

### Start Whisper ASR Service with Docker

The transcription service requires a Whisper ASR webservice. Run it using Docker:

#### CPU Version
```bash
docker pull onerahmet/openai-whisper-asr-webservice:latest
docker run -d -p 9000:9000 \
  -e ASR_MODEL=base \
  -e ASR_ENGINE=openai_whisper \
  onerahmet/openai-whisper-asr-webservice:latest
```

#### GPU Version (if available)
```bash
docker run -d --gpus all -p 9000:9000 \
  -e ASR_MODEL=base \
  -e ASR_ENGINE=faster_whisper \
  onerahmet/openai-whisper-asr-webservice:latest-gpu
```

#### Whisper ASR Configuration
Environment variables for the ASR service:

| Variable | Description | Options | Default |
|----------|-------------|---------|---------|
| `ASR_MODEL` | Whisper model size | tiny, base, small, medium, large | base |
| `ASR_ENGINE` | ASR engine | openai_whisper, faster_whisper | openai_whisper |
| `ASR_MODEL_PATH` | Custom model path | path string | optional |

The Whisper ASR service will be available at `http://localhost:9000` with Swagger documentation at `http://localhost:9000/docs`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload video file |
| `GET` | `/videos` | List all videos |
| `POST` | `/save-transcription` | Save transcription as JSON |
| `GET` | `/transcribe-stream` | Real-time transcription (SSE) |
| `POST` | `/transcribe` | Standard transcription |
| `POST` | `/detect-language` | Detect video language |
| `POST` | `/overlay-subs` | Burn subtitles into video |

## Subtitle Styles

| Style | Description |
|-------|-------------|
| `netflix` | White text, bold black outline |
| `youtube` | White text, semi-transparent black box |
| `bold-yellow` | Yellow bold text, black outline |
| `top-caption` | White text positioned at top |
| `cinematic` | Italic white text with shadow |
| `neon-green` | Bright green text, black outline |
| `dark-box` | White text on solid black box |
| `retro` | Yellow monospace on black box |

## Usage Examples

### Upload Video
```bash
curl -X POST http://localhost:3000/upload \
  -F "video=@/path/to/video.mp4"
```

### Transcribe with Streaming
```bash
curl -N "http://localhost:3000/transcribe-stream?videoUrl=http://localhost:3000/uploads/video-1.mp4"
```

### Burn Subtitles
```bash
curl -X POST http://localhost:3000/overlay-subs \
  -H "Content-Type: application/json" \
  -d '{
    "videoName": "video-1.mp4",
    "subtitleName": "video-1.json",
    "format": "json",
    "styleId": "netflix"
  }'
```

## Frontend

The frontend is a React application with:
- Video upload interface
- Video gallery view
- Real-time transcription with progress logs
- Editable transcripts
- Subtitle style picker with live preview
- Video preview with burned-in subtitles

## Tech Stack

### Backend
- Express.js - Web framework
- Multer - File upload
- FFmpeg - Video/audio processing
- Axios - HTTP client
- Server-Sent Events (SSE) - Real-time updates
- Whisper ASR - AI transcription service

### Frontend
- React 19
- Vite - Build tool
- Tailwind CSS - Styling
- Radix UI - Accessible components
- Lucide React - Icons

## Project Structure

```
content-pipeline/
├── backend/
│   ├── index.js          # Main server
│   ├── utils/
│   │   └── utils.js      # Subtitle styles & converter
│   ├── uploads/          # Video storage
│   ├── audios/           # Extracted audio
│   └── transcriptions/   # JSON transcripts
└── frontend/
    ├── src/
    │   ├── pages/        # Home, Videos, Transcribe
    │   ├── components/   # UI components
    │   └── lib/          # Utilities
    └── components/ui/    # shadcn/ui components
```

## System Requirements

- **Node.js**: 14 or higher
- **FFmpeg**: Required for audio extraction and video processing
- **Docker**: Required for Whisper ASR service
- **RAM**: Minimum 4GB (8GB recommended for larger models)
- **GPU** (optional): For faster transcription with GPU-accelerated models

## License

MIT
