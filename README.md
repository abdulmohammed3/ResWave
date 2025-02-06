# ResWave - AI Resume Optimizer

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

ResWave is a modern web application that uses AI to help users optimize their resumes for better job application success.

## Features

- AI-powered resume optimization using local LLM (deepseek-coder)
- Drag-and-drop file upload for DOCX files
- Real-time preview with Monaco Editor
- Dark mode support
- Responsive design
- User profile management

## Tech Stack

### Frontend
- React with Next.js
- TypeScript
- TailwindCSS
- Monaco Editor
- React Dropzone

### Backend
- Node.js with Express
- TypeScript
- Ollama.js for local LLM integration
- Mammoth.js for DOCX processing

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Ollama with deepseek-coder model installed

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/reswave.git
cd reswave
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd ../backend
npm install
```

4. Start the backend server:
```bash
npm start
```

5. Start the frontend development server:
```bash
cd ../frontend
npm run dev
```

The application will be available at `http://localhost:3000`.

## Development

### Backend Development
The backend server runs on `http://localhost:3001` and provides API endpoints for resume optimization.

### Frontend Development
The frontend is built with Next.js and uses the App Router for navigation.

## License
MIT
