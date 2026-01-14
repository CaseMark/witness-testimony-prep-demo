// Feature Gate Service for Demo Mode
// Controls access to premium/disabled features

import { DEMO_LIMITS, UPGRADE_MESSAGES } from './config';
import type { LimitCheckResult } from '@/lib/types/demo-limits';

export type FeatureKey = keyof typeof DEMO_LIMITS.features;

export class FeatureGateService {
  private static instance: FeatureGateService;

  private constructor() {}

  public static getInstance(): FeatureGateService {
    if (!FeatureGateService.instance) {
      FeatureGateService.instance = new FeatureGateService();
    }
    return FeatureGateService.instance;
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: FeatureKey): boolean {
    return DEMO_LIMITS.features[feature];
  }

  /**
   * Check feature access with detailed result
   */
  public checkFeatureAccess(feature: FeatureKey): LimitCheckResult {
    if (this.isFeatureEnabled(feature)) {
      return { allowed: true };
    }

    const featureNames: Record<FeatureKey, string> = {
      bulkUpload: 'Bulk Upload',
      advancedExport: 'Advanced Export',
      premiumFeatures: 'Premium Features',
    };

    return {
      allowed: false,
      reason: `${featureNames[feature]} is a premium feature not available in the demo`,
      suggestedAction: UPGRADE_MESSAGES.featureDisabled.cta,
    };
  }

  /**
   * Get list of disabled features
   */
  public getDisabledFeatures(): FeatureKey[] {
    return (Object.keys(DEMO_LIMITS.features) as FeatureKey[])
      .filter(key => !DEMO_LIMITS.features[key]);
  }

  /**
   * Get list of enabled features
   */
  public getEnabledFeatures(): FeatureKey[] {
    return (Object.keys(DEMO_LIMITS.features) as FeatureKey[])
      .filter(key => DEMO_LIMITS.features[key]);
  }
}

// Export singleton instance
export const featureGateService = FeatureGateService.getInstance();

// Convenience functions
export function isFeatureEnabled(feature: FeatureKey): boolean {
  return featureGateService.isFeatureEnabled(feature);
}

export function checkFeatureAccess(feature: FeatureKey): LimitCheckResult {
  return featureGateService.checkFeatureAccess(feature);
}
