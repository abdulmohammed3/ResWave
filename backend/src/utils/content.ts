import { CHUNK } from '../config';

/**
 * Splits content into manageable chunks while preserving context
 * @param text Content to split into chunks
 * @returns Array of content chunks
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
 * @param template Prompt template string with ${var} placeholders
 * @param variables Object containing variable values
 */
export function formatPrompt(template: string, variables: { [key: string]: string | undefined }): string {
  return template.replace(/\${(\w+)}/g, (_, key) => variables[key] || '');
}

/**
 * Validates file type based on mimetype and extension
 * @param mimetype MIME type of the file
 * @param filename Filename to check extension
 * @returns boolean indicating if file type is allowed
 */
export function isValidFileType(mimetype: string, filename: string): boolean {
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
 * Extracts text content from a file
 * @param filepath Path to the file
 * @param mimetype MIME type of the file
 */
export async function extractTextContent(filepath: string): Promise<string> {
  const fs = require('fs').promises;
  const mammoth = require('mammoth');
  // Read file content 
  const result = await mammoth.extractRawText({ path: filepath });
  return result.value;
}