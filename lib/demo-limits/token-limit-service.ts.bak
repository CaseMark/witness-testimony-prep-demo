// Token Limit Service for Demo Mode
// Enforces per-request, per-session, and per-day token limits

import type { LimitCheckResult } from '@/lib/types/demo-limits';
import { DEMO_LIMITS, UPGRADE_MESSAGES } from './config';
import { getTokenUsage, recordTokenUsage } from '@/lib/storage/usage-storage';

export class TokenLimitService {
  private static instance: TokenLimitService;

  private constructor() {}

  public static getInstance(): TokenLimitService {
    if (!TokenLimitService.instance) {
      TokenLimitService.instance = new TokenLimitService();
    }
    return TokenLimitService.instance;
  }

  /**
   * Check if a request with the given token count is allowed
   */
  public checkRequestAllowed(requestTokens: number): LimitCheckResult {
    const usage = getTokenUsage();
    const limits = DEMO_LIMITS.tokens;

    // Check per-request limit
    if (requestTokens > limits.perRequest) {
      return {
        allowed: false,
        reason: `Request exceeds maximum token limit of ${limits.perRequest.toLocaleString()} tokens`,
        currentUsage: requestTokens,
        limit: limits.perRequest,
        suggestedAction: UPGRADE_MESSAGES.tokenLimit.cta,
      };
    }

    // Check per-session limit
    const projectedSessionTokens = usage.sessionTokens + requestTokens;
    if (projectedSessionTokens > limits.perSession) {
      return {
        allowed: false,
        reason: `Session token limit of ${limits.perSession.toLocaleString()} tokens would be exceeded`,
        currentUsage: usage.sessionTokens,
        limit: limits.perSession,
        remainingUsage: limits.perSession - usage.sessionTokens,
        suggestedAction: UPGRADE_MESSAGES.tokenLimit.cta,
      };
    }

    // Check per-day limit
    const projectedDailyTokens = usage.dailyTokens + requestTokens;
    if (projectedDailyTokens > limits.perDayPerUser) {
      return {
        allowed: false,
        reason: `Daily token limit of ${limits.perDayPerUser.toLocaleString()} tokens would be exceeded`,
        currentUsage: usage.dailyTokens,
        limit: limits.perDayPerUser,
        remainingUsage: limits.perDayPerUser - usage.dailyTokens,
        suggestedAction: UPGRADE_MESSAGES.tokenLimit.cta,
      };
    }

    return {
      allowed: true,
      currentUsage: usage.sessionTokens,
      limit: limits.perSession,
      remainingUsage: limits.perSession - usage.sessionTokens,
    };
  }

  /**
   * Record token usage after a successful request
   */
  public recordUsage(tokens: number): void {
    recordTokenUsage(tokens);
  }

  /**
   * Get current usage statistics
   */
  public getUsageStats(): {
    sessionUsed: number;
    sessionLimit: number;
    sessionRemaining: number;
    dailyUsed: number;
    dailyLimit: number;
    dailyRemaining: number;
    percentSessionUsed: number;
    percentDailyUsed: number;
  } {
    const usage = getTokenUsage();
    const limits = DEMO_LIMITS.tokens;

    return {
      sessionUsed: usage.sessionTokens,
      sessionLimit: limits.perSession,
      sessionRemaining: Math.max(0, limits.perSession - usage.sessionTokens),
      dailyUsed: usage.dailyTokens,
      dailyLimit: limits.perDayPerUser,
      dailyRemaining: Math.max(0, limits.perDayPerUser - usage.dailyTokens),
      percentSessionUsed: Math.min(100, (usage.sessionTokens / limits.perSession) * 100),
      percentDailyUsed: Math.min(100, (usage.dailyTokens / limits.perDayPerUser) * 100),
    };
  }

  /**
   * Check if user is approaching limits (for warning UI)
   */
  public getWarningLevel(): 'none' | 'approaching' | 'critical' | 'exceeded' {
    const stats = this.getUsageStats();
    const maxPercent = Math.max(stats.percentSessionUsed, stats.percentDailyUsed);

    if (maxPercent >= 100) return 'exceeded';
    if (maxPercent >= 90) return 'critical';
    if (maxPercent >= 75) return 'approaching';
    return 'none';
  }

  /**
   * Estimate tokens for a given text (rough estimation)
   * Uses ~4 characters per token as a rough average
   */
  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate text to fit within token limit
   */
  public truncateToLimit(text: string, maxTokens: number = DEMO_LIMITS.tokens.perRequest): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    // Truncate to approximately maxTokens worth of characters
    const maxChars = maxTokens * 4;
    return text.slice(0, maxChars) + '... [truncated due to demo limits]';
  }
}

// Export singleton instance
export const tokenLimitService = TokenLimitService.getInstance();
