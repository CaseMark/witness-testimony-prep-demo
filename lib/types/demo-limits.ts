// Types for demo limits tracking and enforcement

export interface SessionStats {
  documentsUploaded: number;
  totalStorageUsed: number;
  sessionPrice: number; // Total cost in USD for this session
  sessionStartAt: string; // ISO string
  sessionResetAt: string; // ISO string
}

export interface DemoLimits {
  pricing: {
    sessionHours: number;
    sessionPriceLimit: number; // USD
    pricePerThousandChars: number; // USD per 1000 characters
  };
  documents: {
    maxDocumentsPerSession: number;
    maxFileSize: number; // bytes
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  remainingUsage?: number;
  suggestedAction?: string;
}

export interface UsageStats {
  pricing: {
    sessionUsed: number; // USD
    sessionLimit: number; // USD
    percentUsed: number;
  };
  documents: {
    documentsUsed: number;
    documentsLimit: number;
    percentUsed: number;
  };
}
