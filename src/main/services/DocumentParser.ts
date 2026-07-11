import * as fs from 'fs';
import * as path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_TYPES = ['pdf', 'txt', 'md', 'docx'];

export interface ParsedDocument {
  content: string;
  tokenCount: number;
  fileType: string;
  fileSize: number;
}

export async function parseFile(filePath: string): Promise<ParsedDocument> {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`Plik za duży: ${(stats.size / 1024 / 1024).toFixed(1)}MB. Maksymalnie 10MB.`);
  }
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  if (!SUPPORTED_TYPES.includes(ext)) {
    throw new Error(`Nieobsługiwany format: .${ext}. Wspierane: PDF, TXT, MD, DOCX`);
  }
  let content: string;
  try {
    if (ext === 'pdf') {
      try { const pdfParse = require('pdf-parse'); const dataBuffer = fs.readFileSync(filePath); const data = await pdfParse(dataBuffer); content = data.text; }
      catch { throw new Error('PDF parsing failed: pdf-parse library is not available. Install pdf-parse or provide a PDF parser.'); }
    } else if (ext === 'docx') {
      try { const mammoth = require('mammoth'); const result = await mammoth.extractRawText({ path: filePath }); content = result.value; }
      catch { content = fs.readFileSync(filePath, 'utf-8'); console.warn('[DocumentParser] DOCX parsing failed, used plain text fallback'); }
    } else {
      content = fs.readFileSync(filePath, 'utf-8');
    }
  } catch (parseError) {
    try { content = fs.readFileSync(filePath, 'utf-8'); console.warn(`[DocumentParser] Parsing ${ext} failed, used plain text fallback`); }
    catch { throw new Error(`Nie można odczytać pliku: ${(parseError as Error).message}`); }
  }
  if (!content || content.trim().length === 0) throw new Error('Plik jest pusty lub zawiera tylko białe znaki.');
  const tokenCount = Math.ceil(content.length / 4);
  const MAX_TOKENS = 100_000;
  if (tokenCount > MAX_TOKENS) { content = content.slice(0, MAX_TOKENS * 4); console.warn(`[DocumentParser] Plik przycięty do ${MAX_TOKENS} tokenów`); }
  return { content, tokenCount: Math.min(tokenCount, MAX_TOKENS), fileType: ext, fileSize: stats.size };
}