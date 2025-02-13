// Configuration constants for the server

export const SERVER = {
  DEFAULT_PORT: 3001,
  MAX_PORT_ATTEMPTS: 10,
};

export const FILE = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // For .docx files sometimes sent with this mime type
    'text/plain'
  ],
  ALLOWED_EXTENSIONS: ['.docx', '.txt'],
};

export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  MESSAGE: 'Too many requests from this IP, please try again later.',
};

export const OLLAMA = {
  HOST: 'http://localhost:11434',
  DEFAULT_MODEL: 'mistral:latest',
};

export const TIMEOUTS = {
  UPLOAD: 30000, // 30 seconds
  HEALTH_CHECK: 2000, // 2 seconds
  BASE_MODEL: 45000, // 45 seconds base for model warmup
  MAX_MODEL: 120000, // 120 seconds maximum
  CHAR_TIME: 5, // 5ms per character
};

export const CHUNK = {
  MAX_SIZE: 1000,
  RETRY_ATTEMPTS: 5,
  RETRY_BASE_DELAY: 1000,
  CONCURRENT_LIMIT: 1,
};

export const PROMPT_TEMPLATES = {
  RESUME_OPTIMIZATION: `Optimize this resume section to be more impactful and professional:
    \${content}`,
  DETAILED_OPTIMIZATION: `Analyze and optimize this resume section to maximize professional impact. Focus on:
    - Achievement-oriented bullet points
    - Quantifiable results
    - Industry-specific keywords
    - Clear hierarchy and readability
    
    Original content:
    \${content}`
};