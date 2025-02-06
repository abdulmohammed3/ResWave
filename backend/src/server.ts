import express, { Request, Response } from 'express';
import cors from 'cors';
import { Ollama } from 'ollama';
import mammoth from 'mammoth';
import multer from 'multer';

const app = express();
const ollama = new Ollama();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

interface OptimizeResponse {
  optimizedContent: string;
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

app.post('/api/optimize', upload.single('resume'), async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Convert DOCX to text
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    const text = result.value;

    // Generate optimized content using Ollama
    const response = await ollama.generate({
      model: 'deepseek-coder:latest',
      prompt: `Please optimize the following resume to be more professional and impactful:
      
      ${text}`,
    });

    const optimizedResponse: OptimizeResponse = {
      optimizedContent: response.response,
    };

    res.json(optimizedResponse);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
