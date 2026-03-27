import { createWorker } from 'tesseract.js';

export class OCRService {
  private worker: any = null;

  async init() {
    this.worker = await createWorker('eng');
  }

  async extractTextFromImage(imagePath: string): Promise<string> {
    if (!this.worker) await this.init();
    const { data: { text } } = await this.worker.recognize(imagePath);
    return text;
  }

  async isImageBasedPDF(buffer: Buffer): Promise<boolean> {
    // Basic heuristic: check for large image blocks or lack of font descriptors
    const content = buffer.toString('utf8', 0, 1000);
    return !content.includes('/Font') && content.includes('/Image');
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const ocrService = new OCRService();
