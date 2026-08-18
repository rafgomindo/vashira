import fs from 'node:fs';
import { addFullText, updateItem } from './database';
import { ocrService } from './ocr-service';

/**
 * Sovereign Indexer 4.0
 * Extracts text content from research papers to enable Deep Search.
 */
export async function indexItemTask(item: any) {
  if (!item.filePath || !fs.existsSync(item.filePath)) return;

  try {
    const data = fs.readFileSync(item.filePath);
    
    // Mastery Technique: Efficiently extract human-readable text from PDF stream
    // This looks for string blocks in the PDF binary without heavy dependencies.
    const text = extractSovereignText(data);
    
    if (text.trim().length < 200 && (await ocrService.isSilentPdf(data))) {
      console.warn(`[OCR] Silent PDF Detected: ${item.title}. Flagging for Mastery Scan.`);
      if (item.id) {
        updateItem(item.id, { masteryStatus: 'unreadable' });
      }
    } else if (text.length > 0 && item.id) {
      addFullText(item.id, text);
      updateItem(item.id, { masteryStatus: 'indexed' });
      console.log(`[Deep Search] Indexed Mastery: ${item.title} (${text.length} chars)`);
    }
  } catch (error) {
    console.error('Deep Search Indexing failed:', error);
  }
}

function extractSovereignText(buffer: Buffer): string {
  // Extract ASCII/UTF-8 strings longer than 4 chars
  // This is a basic "strings" utility that works remarkably well for PDFs
  // where text isn't encrypted/compressed.
  const str = buffer.toString('binary');
  const matches = str.match(/[a-zA-Z0-9\s,.!?;:()\[\]-]{6,}/g);
  
  if (!matches) return "";
  
  // Filter for meaningful content (avoid garbage)
  const filtered = matches.filter(m => {
    const spaceCount = (m.match(/\s/g) || []).length;
    return spaceCount > m.length * 0.1; // Must have some spaces to be "text"
  });

  return filtered.join(' ').substring(0, 100000); // Limit to 100k chars for performance
}
