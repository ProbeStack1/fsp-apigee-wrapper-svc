/**
 * One-time backfill: record a Created By / Modified By entry (apigee_config_registry)
 * for every existing API proxy that has none — proxies made directly against Apigee,
 * outside this platform's Create Proxy dialog, never got tracked.
 *
 * There is no real historical creator to recover (neither Mongo nor Apigee itself
 * knows who originally made these proxies), so every backfilled proxy is attributed
 * to the actor email you pass in — the same "whoever discovers it" convention the
 * live app now uses when someone opens a proxy's detail page for the first time
 * (see syncDirectResources in src/services/config-tracking.service.ts). This script
 * just runs that same discovery, once, up front, across every proxy instead of
 * waiting for someone to click into each one.
 *
 * Never overwrites an existing registry doc's createdBy — proxies already tracked
 * (created through the platform, or already discovered by a previous run) are left
 * untouched.
 *
 * Usage:
 *   tsx scripts/backfill-proxy-creators.ts <org1,org2,...> <actor-email>
 *   npm run backfill:proxy-creators -- gen-ai-poc-onboarding admin@forgecrux.com
 *
 * Requires the same .env as the running server (MONGODB_URI, APIGEE_SERVICE_ACCOUNT_KEY_PATH, ...).
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import type { Request } from "express";

import { apiClient } from "../src/client/api-client";
import { ensureMongoConnected } from "../src/db/mongo";
import { getApigeeBaseUrl, encodePathParam } from "../src/services/apigee-base-url.service";
import { generateGoogleAccessToken } from "../src/services/google-service-account-token.service";
import { buildResourceKey, syncDirectResources } from "../src/services/config-tracking.service";

dotenv.config();

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function extractProxyNames(listResponseData: unknown): string[] {
  const items = Array.isArray(listResponseData)
    ? listResponseData
    : asRecord(listResponseData)?.proxies ?? asRecord(listResponseData)?.apis ?? [];

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => (typeof item === "string" ? item : (asRecord(item)?.name as string | undefined)))
    .filter((name): name is string => Boolean(name && name.trim()));
}

async function main() {
  const [orgsArg, actorEmail] = process.argv.slice(2);
  const orgs = (orgsArg || "").split(",").map((o) => o.trim()).filter(Boolean);

  if (orgs.length === 0 || !actorEmail?.trim()) {
    console.error("Usage: tsx scripts/backfill-proxy-creators.ts <org1,org2,...> <actor-email>");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await ensureMongoConnected();

  console.log(`Requesting Apigee access token...`);
  const { access_token: token } = await generateGoogleAccessToken();
  const authHeader = { Authorization: `Bearer ${token}` };
  const baseUrl = getApigeeBaseUrl();

  let created = 0;
  let alreadyTracked = 0;
  let failed = 0;

  for (const org of orgs) {
    console.log(`\n=== Organization: ${org} ===`);

    let proxyNames: string[] = [];
    try {
      const listUrl = `${baseUrl}/organizations/${encodePathParam(org)}/apis`;
      const listResponse = await apiClient.get(listUrl, { headers: authHeader });
      proxyNames = extractProxyNames(listResponse.data);
    } catch (err) {
      console.error(`  ! Failed to list proxies for ${org}:`, err instanceof Error ? err.message : err);
      continue;
    }

    console.log(`  Found ${proxyNames.length} proxies`);

    for (const name of proxyNames) {
      const resourceKey = buildResourceKey({ configType: "API", org, name });
      try {
        const existing = await mongoose.connection
          .collection("apigee_config_registry")
          .findOne({ resourceKey, status: "ACTIVE" });

        if (existing) {
          alreadyTracked++;
          console.log(`  = ${name} (already tracked as "${existing.createdBy}", left untouched)`);
          continue;
        }

        const detailUrl = `${baseUrl}/organizations/${encodePathParam(org)}/apis/${encodePathParam(name)}`;
        const detailResponse = await apiClient.get(detailUrl, { headers: authHeader });

        // syncDirectResources reads onboardingId/createdBy off a Request-shaped object
        // (headers/body/query) — this is a plain object satisfying just that shape,
        // not a real Express request.
        const fakeRequest = {
          headers: { "x-onboarding-id": "legacy-backfill", "x-created-by": actorEmail },
          query: {},
          body: {},
        } as unknown as Request;

        await syncDirectResources(fakeRequest, [{
          configType: "API",
          org,
          name,
          payload: detailResponse.data,
        }]);

        created++;
        console.log(`  + ${name} (backfilled, attributed to ${actorEmail})`);
      } catch (err) {
        failed++;
        console.error(`  ! ${name} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(`\nDone. Backfilled: ${created}, already tracked: ${alreadyTracked}, failed: ${failed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
