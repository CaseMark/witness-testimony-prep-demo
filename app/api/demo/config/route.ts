import { NextResponse } from "next/server";
import { DEMO_LIMITS, LIMIT_DESCRIPTIONS } from "@/lib/demo-limits/config";

/**
 * GET /api/demo/config
 * Returns demo mode configuration and limits for the UI
 */
export async function GET() {
  // Read configuration from environment variables
  const isDemoMode = process.env.DEMO_MODE !== "false"; // Default to true for demo
  const appName = process.env.DEMO_APP_NAME || "Deposition Prep Tools";
  const upgradeUrl = process.env.DEMO_UPGRADE_URL || "https://case.dev";
  const contactEmail = process.env.DEMO_CONTACT_EMAIL || "sales@case.dev";
  const demoExpiryDays = parseInt(process.env.DEMO_EXPIRY_DAYS || "0", 10);

  // Feature flags
  const features = {
    enableExport: process.env.DEMO_FEATURE_EXPORT === "true",
    enableBulkUpload: process.env.DEMO_FEATURE_BULK_UPLOAD === "true",
    enableAdvancedSearch: process.env.DEMO_FEATURE_ADVANCED_SEARCH === "true",
    enableCustomization: process.env.DEMO_FEATURE_CUSTOMIZATION === "true",
    enableApiAccess: process.env.DEMO_FEATURE_API_ACCESS === "true",
  };

  // Build disabled features list
  const disabledFeatures: string[] = [];
  if (!features.enableExport) disabledFeatures.push("Session Export");
  if (!features.enableBulkUpload) disabledFeatures.push("Bulk Upload");
  if (!features.enableAdvancedSearch) disabledFeatures.push("Advanced Search");
  if (!features.enableCustomization) disabledFeatures.push("Custom Question Sets");
  if (!features.enableApiAccess) disabledFeatures.push("API Access");

  return NextResponse.json({
    config: {
      isDemoMode,
      appName,
      upgradeUrl,
      contactEmail,
      demoExpiryDays,
      features,
    },
    limits: {
      pricing: DEMO_LIMITS.pricing,
      documents: DEMO_LIMITS.documents,
    },
    limitDescriptions: LIMIT_DESCRIPTIONS,
    disabledFeatures,
  });
}
