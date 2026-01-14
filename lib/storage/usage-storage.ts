// localStorage-based usage tracking for demo limits
// Tracks pricing and document usage per session

import { v4 as uuidv4 } from 'uuid';
import type { SessionStats, UsageStats } from '@/lib/types/demo-limits';
import { DEMO_LIMITS } from '@/lib/demo-limits/config';

const STATS_KEY = 'wtp_session_stats_v2';
const USER_ID_KEY = 'wtp_user_id_v1';
const SESSION_ID_KEY = 'wtp_session_id_v1';

// SSR safety check
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// Get or create anonymous user ID (persists across sessions)
export function getUserId(): string {
  if (!isBrowser()) return 'server';

  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${uuidv4()}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

// Get or create session ID (new per browser session)
export function getSessionId(): string {
  if (!isBrowser()) return 'server';

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `session_${uuidv4()}`;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

// Helper function to get session reset time
function getSessionResetTime(sessionHours: number = 24): string {
  const resetTime = new Date();
  resetTime.setHours(resetTime.getHours() + sessionHours);
  return resetTime.toISOString();
}

// Session statistics
export function getSessionStats(): SessionStats {
  const defaultStats: SessionStats = {
    documentsUploaded: 0,
    totalStorageUsed: 0,
    sessionPrice: 0,
    sessionStartAt: new Date().toISOString(),
    sessionResetAt: getSessionResetTime(DEMO_LIMITS.pricing.sessionHours),
  };

  if (typeof window === 'undefined') {
    return defaultStats;
  }

  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (!stored) {
      localStorage.setItem(STATS_KEY, JSON.stringify(defaultStats));
      return defaultStats;
    }

    const stats = JSON.parse(stored) as SessionStats;

    // Check if session reset needed
    const now = new Date();
    if (now >= new Date(stats.sessionResetAt)) {
      const resetStats: SessionStats = {
        documentsUploaded: 0,
        totalStorageUsed: 0,
        sessionPrice: 0,
        sessionStartAt: now.toISOString(),
        sessionResetAt: getSessionResetTime(DEMO_LIMITS.pricing.sessionHours),
      };
      localStorage.setItem(STATS_KEY, JSON.stringify(resetStats));
      return resetStats;
    }

    return stats;
  } catch {
    return defaultStats;
  }
}

export function updateSessionStats(updates: Partial<SessionStats>): void {
  if (typeof window === 'undefined') return;

  const current = getSessionStats();
  const updated = { ...current, ...updates };
  localStorage.setItem(STATS_KEY, JSON.stringify(updated));
}

export function incrementDocumentsUploaded(): void {
  const stats = getSessionStats();
  updateSessionStats({ documentsUploaded: stats.documentsUploaded + 1 });
}

export function incrementSessionPrice(price: number): void {
  const stats = getSessionStats();
  updateSessionStats({ sessionPrice: stats.sessionPrice + price });
}

export function updateTotalStorageUsed(bytes: number): void {
  updateSessionStats({ totalStorageUsed: bytes });
}

// Get usage stats for display
export function getUsageStats(): UsageStats {
  const stats = getSessionStats();
  const limits = DEMO_LIMITS;

  const pricePercent = (stats.sessionPrice / limits.pricing.sessionPriceLimit) * 100;
  const documentsPercent = (stats.documentsUploaded / limits.documents.maxDocumentsPerSession) * 100;

  return {
    pricing: {
      sessionUsed: stats.sessionPrice,
      sessionLimit: limits.pricing.sessionPriceLimit,
      percentUsed: Math.min(100, pricePercent),
    },
    documents: {
      documentsUsed: stats.documentsUploaded,
      documentsLimit: limits.documents.maxDocumentsPerSession,
      percentUsed: Math.min(100, documentsPercent),
    },
  };
}

// Calculate time remaining until session reset
export function calculateTimeRemaining(resetAt: string): string {
  const now = new Date();
  const reset = new Date(resetAt);
  const diff = reset.getTime() - now.getTime();

  if (diff <= 0) return '0h 0m';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

// Clear all usage data
export function clearAllUsage(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STATS_KEY);
}

// Format price for display
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

// Calculate cost based on character count
export function calculateCost(charCount: number): number {
  const costPerThousandChars = DEMO_LIMITS.pricing.pricePerThousandChars;
  return (charCount / 1000) * costPerThousandChars;
}
