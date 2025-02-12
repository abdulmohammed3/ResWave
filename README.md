# ResumeWave 2.0

[![TypeScript](https://badges.frapsoft.com/typescript/code/typescript.svg?v=101)](https://github.com/microsoft/TypeScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://makeapullrequest.com)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-brightgreen)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/express-%5E4.17.1-blue)](https://expressjs.com)
[![Next.js](https://img.shields.io/badge/next-%5E13.0.0-black)](https://nextjs.org)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Test Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen.svg)](https://github.com/yourusername/resumewave/actions)
[![AI: Ollama](https://img.shields.io/badge/AI-Ollama-orange.svg)](https://ollama.ai)
[![Development Status](https://img.shields.io/badge/status-active-success.svg)](https://github.com/yourusername/resumewave)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](https://github.com/yourusername/resumewave/blob/main/CONTRIBUTING.md)

ResumeWave 2.0 is an enhanced resume optimization tool that leverages AI to transform resumes into impactful, professionally crafted documents. This major update brings significant improvements in performance, reliability, and file handling capabilities.

## 🚀 New Features in 2.0

### Enhanced File Processing
- Support for larger files (up to 10MB)
- Intelligent file chunking for optimal processing
- Streaming upload support
- Automatic file cleanup
- Support for DOCX and TXT formats

### Performance Optimizations
- Adaptive timeout handling with model warmup consideration
- Dynamic chunk sizing for better context preservation
- Response compression for faster delivery
- Rate limiting protection (100 requests/15min)
- Automatic port conflict resolution

### Reliability Improvements
- Exponential backoff retry logic
- Robust error handling with specific status codes
- File cleanup in both success and error cases
- Enhanced error logging and monitoring
- Health check endpoints

### AI Processing
- Context-aware text chunking
- Improved prompt engineering
- Sequential processing for reliability
- Smart timeout calculations based on content size

## 🛠️ Technical Features

### File Processing
- Maximum file size: 10MB
- Supported formats: DOCX, TXT
- Chunk size: 1000 characters (optimized for context)
- Streaming file uploads

### Performance Settings
- Base timeout: 45 seconds (model warmup)
- Per-character timeout: 5ms
- Maximum timeout: 120 seconds
- Concurrent processing limits

### Error Handling
- Status code 400: Invalid requests
- Status code 422: Document processing errors
- Status code 504: Timeout errors
- Status code 500: Internal server errors

### Security
- File type validation
- Size restrictions
- Rate limiting
- Automatic file cleanup

## 🚦 API Endpoints

### `/api/optimize`
- POST endpoint for resume optimization
- Accepts multipart/form-data
- Returns optimized content with metadata

### `/api/generate`
- POST endpoint for direct text optimization
- Accepts JSON payload
- Returns optimized content

### `/api/health`
- GET endpoint for system health check
- Monitors system status

### `/api/metrics`
- GET endpoint for system metrics
- Tracks processing statistics

## 🏗️ Architecture

### Frontend
- Next.js for modern UI
- Tailwind CSS for styling
- Responsive design
- Real-time processing feedback

### Backend
- Express.js server
- Streaming file processing
- Intelligent chunking system
- Automatic port management
- Disk-based file handling

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/resumewave.git
```

2. Install dependencies:
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Start the development servers:
```bash
# Backend (will automatically find available port)
cd backend
npm start

# Frontend
cd frontend
npm run dev
```

## 🔧 Configuration

The system is configurable through environment variables:
- `PORT`: Server port (default: 3001)
- `MAX_FILE_SIZE`: Maximum file size (default: 10MB)
- `RATE_LIMIT_WINDOW`: Rate limiting window (default: 15 minutes)
- `RATE_LIMIT_MAX`: Maximum requests per window (default: 100)

## 📝 License

MIT License - see LICENSE for details
