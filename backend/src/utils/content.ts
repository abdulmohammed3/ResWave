import { CHUNK } from '../config';
import * as fs from 'fs/promises';
import { OptimizationError } from './errors';
let mammoth: any;

try {
  mammoth = require('mammoth');
  console.log('[Mammoth] Successfully loaded mammoth module');
} catch (error) {
  console.error('[Mammoth] Failed to load mammoth module:', error);
  throw new Error('Failed to initialize document processing module');
}

/**
 * Splits content into manageable chunks while preserving context
 */
export function splitContent(text: string): string[] {
  const chunks: string[] = [];
  
  // Split on paragraph breaks to maintain context
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If paragraph itself exceeds maxChunkSize, split it into smaller chunks
    if (paragraph.length > CHUNK.MAX_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // Split large paragraph on sentences to maintain context
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length <= CHUNK.MAX_SIZE) {
          sentenceChunk += sentence;
        } else {
          if (sentenceChunk) chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }
      
      if (sentenceChunk) chunks.push(sentenceChunk);
      continue;
    }
    
    // Normal paragraph handling
    if ((currentChunk + paragraph).length <= CHUNK.MAX_SIZE) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = paragraph;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

/**
 * Formats prompt with variables
 */
export function formatPrompt(template: string, variables: { [key: string]: string | undefined }): string {
  return template.replace(/\${(\w+)}/g, (_, key) => variables[key] || '');
}

/**
 * Validates file type based on mimetype and extension
 */
export function isValidFileType(mimetype: string, filename: string): boolean {
  console.log(`[FileValidation] Checking file type:`, {
    mimetype,
    filename,
    extension: filename.toLowerCase().slice(filename.lastIndexOf('.'))
  });
  
  if (mimetype === 'application/octet-stream') {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
    return ['.docx', '.txt'].includes(ext);
  }
  
  return [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ].includes(mimetype);
}

/**
 * Processes a text file
 */
async function processTextFile(filepath: string): Promise<string> {
  console.log(`[ContentExtraction] Processing text file:`, filepath);
  const content = await fs.readFile(filepath, 'utf8');
  console.log(`[ContentExtraction] Text file processed, ${content.length} characters`);
  return content;
}

/**
 * Processes a DOCX file
 */
async function processDocxFile(filepath: string): Promise<string> {
  console.log(`[ContentExtraction] Processing DOCX file:`, filepath);
  
  if (!mammoth) {
    console.error('[ContentExtraction] Mammoth module not initialized');
    throw new OptimizationError('Document processing module not available', {
      stage: 'content_extraction',
      processingStatus: 'module_unavailable',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    console.log(`[ContentExtraction] Starting mammoth extraction for:`, filepath);
    const result = await mammoth.extractRawText({ path: filepath });
    console.log(`[ContentExtraction] Raw mammoth result:`, result);
    
    if (!result || typeof result.value !== 'string') {
      console.error(`[ContentExtraction] Invalid mammoth result:`, result);
      throw new Error('Invalid document conversion result');
    }
    
    console.log(`[ContentExtraction] DOCX processed successfully, ${result.value.length} characters`);
    if (result.messages && result.messages.length > 0) {
      console.log(`[ContentExtraction] Conversion messages:`, result.messages);
    }
    
    return result.value;
  } catch (error) {
    console.error(`[ContentExtraction] DOCX processing error:`, error);
    throw new OptimizationError('Failed to process DOCX file', {
      stage: 'content_extraction',
      processingStatus: 'docx_conversion_failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Extracts text content from a file
 */
export async function extractTextContent(filepath: string): Promise<string> {
  console.log(`[ContentExtraction] Starting extraction for:`, filepath);
  
  try {
    // Verify file exists and is readable
    const stats = await fs.stat(filepath);
    console.log(`[ContentExtraction] File stats:`, {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    });

    // Process based on file type
    const isDocx = filepath.toLowerCase().endsWith('.docx');
    const content = isDocx 
      ? await processDocxFile(filepath)
      : await processTextFile(filepath);
      
    if (!content || content.length === 0) {
      throw new OptimizationError('Extracted content is empty', {
        stage: 'content_extraction',
        processingStatus: 'empty_content',
        timestamp: new Date().toISOString()
      });
    }
    
    return content;
  } catch (error) {
    console.error(`[ContentExtraction] Extraction failed:`, error);
    if (error instanceof OptimizationError) {
      throw error;
    }
    throw new OptimizationError('Failed to extract file content', {
      stage: 'content_extraction',
      processingStatus: 'extraction_failed',
      timestamp: new Date().toISOString()
    });
  }
}