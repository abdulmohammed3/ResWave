export const SERVER = {
  DEFAULT_PORT: 3001,
  MAX_PORT_ATTEMPTS: 10
} as const;

export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  MESSAGE: 'Too many requests from this IP, please try again later'
} as const;

export const OLLAMA = {
  HOST: 'http://localhost:11434',
  DEFAULT_MODEL: 'mistral',
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // Increased to 2 seconds
  REQUEST_TIMEOUT: 60000, // Increased to 60 seconds
  INITIAL_PROMPT_TIMEOUT: 90000, // 90 seconds for first interaction
  MAX_TOKENS_PER_REQUEST: 4096
} as const;

export const CHUNK = {
  MAX_SIZE: 2000,
  CONCURRENCY_LIMIT: 1 // Reduced to process one chunk at a time
} as const;

export const PROMPT_TEMPLATES = {
  RESUME_OPTIMIZATION: `
You are an expert ATS optimization assistant. Please optimize the following resume content 
to be more effective for ATS systems while maintaining readability and professionalism:

\${content}

Focus on:
1. Using clear, industry-standard section headings
2. Maintaining consistent formatting
3. Using relevant keywords naturally
4. Highlighting quantifiable achievements
5. Removing any special characters that might cause parsing issues

Format the response as plain text without any markdown or special formatting.
`,

  DETAILED_OPTIMIZATION: `
Please provide a detailed optimization of the following text, focusing on professional impact:

\${content}

Focus on:
1. Clarity and conciseness
2. Professional tone
3. Active voice
4. Specific, quantifiable achievements
5. Industry-relevant keywords
6. Proper formatting

Format the response as plain text without any markdown or special formatting.
`
} as const;