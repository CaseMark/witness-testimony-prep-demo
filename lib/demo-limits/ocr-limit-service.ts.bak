// OCR Limit Service for Demo Mode
// Enforces file size, page count, and document limits

import type { LimitCheckResult } from '@/lib/types/demo-limits';
import { DEMO_LIMITS, UPGRADE_MESSAGES } from './config';
import { getOCRUsage, recordOCRUsage } from '@/lib/storage/usage-storage';

export class OCRLimitService {
  private static instance: OCRLimitService;

  private constructor() {}

  public static getInstance(): OCRLimitService {
    if (!OCRLimitService.instance) {
      OCRLimitService.instance = new OCRLimitService();
    }
    return OCRLimitService.instance;
  }

  /**
   * Check if a file upload is allowed based on size
   */
  public checkFileSizeAllowed(fileSize: number): LimitCheckResult {
    const limits = DEMO_LIMITS.ocr;

    if (fileSize > limits.maxFileSize) {
      const maxSizeMB = (limits.maxFileSize / (1024 * 1024)).toFixed(0);
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      return {
        allowed: false,
        reason: `File size (${fileSizeMB}MB) exceeds maximum of ${maxSizeMB}MB`,
        currentUsage: fileSize,
        limit: limits.maxFileSize,
        suggestedAction: UPGRADE_MESSAGES.ocrLimit.cta,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if document upload is allowed based on session limits
   */
  public checkDocumentUploadAllowed(): LimitCheckResult {
    const usage = getOCRUsage();
    const limits = DEMO_LIMITS.ocr;

    if (usage.sessionDocuments >= limits.maxDocumentsPerSession) {
      return {
        allowed: false,
        reason: `Session document limit of ${limits.maxDocumentsPerSession} documents reached`,
        currentUsage: usage.sessionDocuments,
        limit: limits.maxDocumentsPerSession,
        suggestedAction: UPGRADE_MESSAGES.ocrLimit.cta,
      };
    }

    return {
      allowed: true,
      currentUsage: usage.sessionDocuments,
      limit: limits.maxDocumentsPerSession,
      remainingUsage: limits.maxDocumentsPerSession - usage.sessionDocuments,
    };
  }

  /**
   * Check if page processing is allowed
   */
  public checkPagesAllowed(pageCount: number): LimitCheckResult {
    const usage = getOCRUsage();
    const limits = DEMO_LIMITS.ocr;

    // Check per-document page limit
    if (pageCount > limits.maxPagesPerDocument) {
      return {
        allowed: false,
        reason: `Document exceeds maximum of ${limits.maxPagesPerDocument} pages per document`,
        currentUsage: pageCount,
        limit: limits.maxPagesPerDocument,
        suggestedAction: UPGRADE_MESSAGES.ocrLimit.cta,
      };
    }

    // Check daily page limit
    const projectedDailyPages = usage.dailyPages + pageCount;
    if (projectedDailyPages > limits.maxPagesPerDay) {
      return {
        allowed: false,
        reason: `Daily page limit of ${limits.maxPagesPerDay} pages would be exceeded`,
        currentUsage: usage.dailyPages,
        limit: limits.maxPagesPerDay,
        remainingUsage: limits.maxPagesPerDay - usage.dailyPages,
        suggestedAction: UPGRADE_MESSAGES.ocrLimit.cta,
      };
    }

    return {
      allowed: true,
      currentUsage: usage.dailyPages,
      limit: limits.maxPagesPerDay,
      remainingUsage: limits.maxPagesPerDay - usage.dailyPages,
    };
  }

  /**
   * Combined check for file upload (size, documents, pages)
   */
  public checkUploadAllowed(fileSize: number, estimatedPages: number): LimitCheckResult {
    // Check file size
    const sizeCheck = this.checkFileSizeAllowed(fileSize);
    if (!sizeCheck.allowed) return sizeCheck;

    // Check document count
    const docCheck = this.checkDocumentUploadAllowed();
    if (!docCheck.allowed) return docCheck;

    // Check page count
    const pageCheck = this.checkPagesAllowed(estimatedPages);
    if (!pageCheck.allowed) return pageCheck;

    return { allowed: true };
  }

  /**
   * Record OCR usage after successful processing
   */
  public recordUsage(documents: number, pages: number): void {
    recordOCRUsage(documents, pages);
  }

  /**
   * Get current usage statistics
   */
  public getUsageStats(): {
    documentsUsed: number;
    documentsLimit: number;
    documentsRemaining: number;
    pagesUsedToday: number;
    pagesLimitDaily: number;
    pagesRemainingToday: number;
    percentDocumentsUsed: number;
    percentPagesUsed: number;
  } {
    const usage = getOCRUsage();
    const limits = DEMO_LIMITS.ocr;

    return {
      documentsUsed: usage.sessionDocuments,
      documentsLimit: limits.maxDocumentsPerSession,
      documentsRemaining: Math.max(0, limits.maxDocumentsPerSession - usage.sessionDocuments),
      pagesUsedToday: usage.dailyPages,
      pagesLimitDaily: limits.maxPagesPerDay,
      pagesRemainingToday: Math.max(0, limits.maxPagesPerDay - usage.dailyPages),
      percentDocumentsUsed: Math.min(100, (usage.sessionDocuments / limits.maxDocumentsPerSession) * 100),
      percentPagesUsed: Math.min(100, (usage.dailyPages / limits.maxPagesPerDay) * 100),
    };
  }

  /**
   * Check if user is approaching limits (for warning UI)
   */
  public getWarningLevel(): 'none' | 'approaching' | 'critical' | 'exceeded' {
    const stats = this.getUsageStats();
    const maxPercent = Math.max(stats.percentDocumentsUsed, stats.percentPagesUsed);

    if (maxPercent >= 100) return 'exceeded';
    if (maxPercent >= 90) return 'critical';
    if (maxPercent >= 75) return 'approaching';
    return 'none';
  }

  /**
   * Estimate page count from file size (rough estimation)
   * Assumes ~100KB per page for typical documents
   */
  public estimatePageCount(fileSize: number): number {
    const bytesPerPage = 100 * 1024; // 100KB
    return Math.max(1, Math.ceil(fileSize / bytesPerPage));
  }

  /**
   * Get maximum allowed pages for current state
   */
  public getMaxAllowedPages(): number {
    const usage = getOCRUsage();
    const limits = DEMO_LIMITS.ocr;

    const remainingDaily = limits.maxPagesPerDay - usage.dailyPages;
    return Math.min(limits.maxPagesPerDocument, remainingDaily);
  }
}

// Export singleton instance
export const ocrLimitService = OCRLimitService.getInstance();
