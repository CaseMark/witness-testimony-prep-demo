/**
 * Client-side document processor for extracting text from PDFs and text files.
 * Uses pdfjs-dist for PDF text extraction (fast, no OCR needed for text-based PDFs).
 */

export interface ExtractionResult {
  text: string;
  pageCount: number;
  method: 'pdf-text' | 'plain-text';
}

// Dynamically load PDF.js
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing must be done on client side');
  }

  if (pdfjsLib) return pdfjsLib;

  pdfjsLib = await import('pdfjs-dist');
  // Use CDN worker for reliability
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  return pdfjsLib;
}

/**
 * Extract text from a PDF file using pdfjs-dist (client-side)
 */
async function extractTextFromPDF(file: File): Promise<ExtractionResult> {
  try {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;

    const textParts: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Reconstruct text with original layout using position information
      const items = textContent.items;
      let pageText = '';
      let lastY = -1;
      let lastX = -1;

      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        if (!('str' in item)) continue;

        const textItem = item as any;
        const str = textItem.str;
        if (!str) continue;

        const transform = textItem.transform;
        const x = transform[4]; // X position
        const y = transform[5]; // Y position

        // Detect line breaks based on Y position change
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          // Significant Y change = new line
          pageText += '\n';
          lastX = -1;
        } else if (lastX !== -1 && x - lastX > 50) {
          // Large horizontal gap = likely a tab or column break
          pageText += ' ';
        } else if (lastX !== -1 && str.trim() && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          // Add space between words if needed
          pageText += ' ';
        }

        pageText += str;
        lastY = y;
        lastX = x + (textItem.width || 0);
      }

      if (pageText.trim()) {
        textParts.push(pageText.trim());
      }
    }

    const fullText = textParts.join('\n\n');

    // If we got very little text, the PDF might be scanned/image-based
    if (fullText.trim().length < 50 && pageCount > 0) {
      console.log('[DocProcessor] PDF appears to be scanned or image-based');
      throw new Error('This PDF appears to be a scanned document or image-based. Please upload a PDF with selectable text, or use a text file (.txt, .docx).');
    }

    console.log(`[DocProcessor] Extracted ${fullText.length} chars from ${pageCount} pages`);

    return {
      text: fullText,
      pageCount,
      method: 'pdf-text',
    };
  } catch (error) {
    console.error('[DocProcessor] PDF extraction error:', error);
    if (error instanceof Error && error.message.includes('scanned document')) {
      throw error;
    }
    throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF with selectable text, or upload a text file instead.');
  }
}

/**
 * Extract text from a plain text file
 */
async function extractTextFromPlainText(file: File): Promise<ExtractionResult> {
  const text = await file.text();
  return {
    text,
    pageCount: 1,
    method: 'plain-text',
  };
}

/**
 * Main function to process a document.
 * Returns extracted text for PDF and text files.
 */
export async function processDocument(file: File): Promise<ExtractionResult> {
  const mimeType = file.type;
  const fileName = file.name.toLowerCase();

  console.log(`[DocProcessor] Processing ${file.name} (${mimeType})`);

  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    return extractTextFromPlainText(file);
  }

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  }

  throw new Error(`Unsupported file type: ${mimeType}. Only PDF and text files are supported.`);
}
