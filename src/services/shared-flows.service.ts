import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { ensureMongoConnected } from "../db/mongo";
import { CodegenResultModel } from "../models/codegen-result.model";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getRequestConfig } from "./request-utils.service";

const sharedFlowsBasePath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/sharedflows`;

const sharedFlowPathByName = (request: Request, sharedFlowName: string) =>
  `${sharedFlowsBasePath(request)}/${encodePathParam(sharedFlowName)}`;

const sharedFlowPath = (request: Request) =>
  sharedFlowPathByName(request, String(request.params.sharedFlow));

const sharedFlowRevisionsPathByName = (request: Request, sharedFlowName: string) =>
  `${sharedFlowPathByName(request, sharedFlowName)}/revisions`;

const sharedFlowRevisionsPath = (request: Request) =>
  sharedFlowRevisionsPathByName(request, String(request.params.sharedFlow));

const sharedFlowRevisionPathByName = (request: Request, sharedFlowName: string, revision: string) =>
  `${sharedFlowRevisionsPathByName(request, sharedFlowName)}/${encodePathParam(revision)}`;

const sharedFlowRevisionPath = (request: Request, revision: string) =>
  sharedFlowRevisionPathByName(request, String(request.params.sharedFlow), revision);

const sharedFlowDeploymentsPathByName = (request: Request, sharedFlowName: string) =>
  `${sharedFlowPathByName(request, sharedFlowName)}/deployments`;

const sharedFlowDeploymentsPath = (request: Request) =>
  sharedFlowDeploymentsPathByName(request, String(request.params.sharedFlow));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const getSharedFlowItems = (data: unknown): unknown[] => {
  if (Array.isArray(data)) {
    return data;
  }

  const record = asRecord(data);
  if (!record) {
    return [];
  }

  for (const key of ["sharedFlows", "sharedflows", "sharedFlow", "sharedflowsList"]) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  return [];
};

const sharedFlowName = (item: unknown): string | null => {
  if (typeof item === "string" && item.trim()) {
    return item.trim();
  }

  const record = asRecord(item);
  const name = record?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};

type LifecycleMetadata = {
  source: "LIFECYCLE_TOOL" | "DIRECT_MANAGEMENT_API";
  createdInLifecycleTool: boolean;
  artifactId?: string;
  codegenResultId?: string;
  microserviceId?: string;
  onboardingId?: string;
  status?: string;
};

const directManagementMetadata = (): LifecycleMetadata => ({
  source: "DIRECT_MANAGEMENT_API",
  createdInLifecycleTool: false,
});

const optionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  return text ? text : undefined;
};

const toLifecycleMetadata = (codegenResult: Record<string, unknown> | null | undefined): LifecycleMetadata => {
  if (!codegenResult) {
    return directManagementMetadata();
  }

  return {
    source: "LIFECYCLE_TOOL",
    createdInLifecycleTool: true,
    artifactId: optionalString(codegenResult.artifactId),
    codegenResultId: optionalString(codegenResult._id),
    microserviceId: optionalString(codegenResult.microserviceId),
    onboardingId: optionalString(codegenResult.onboardingId),
    status: optionalString(codegenResult.status),
  };
};

const lifecycleMetadataForSharedFlow = async (sharedFlowNameValue: string): Promise<LifecycleMetadata> => {
  try {
    await ensureMongoConnected();
    const codegenResult = await CodegenResultModel.findOne({ artifactId: sharedFlowNameValue }).lean();
    return toLifecycleMetadata(codegenResult as Record<string, unknown> | null);
  } catch {
    return directManagementMetadata();
  }
};

const lifecycleMetadataForSharedFlows = async (sharedFlowNames: string[]): Promise<Map<string, LifecycleMetadata>> => {
  const metadataBySharedFlowName = new Map<string, LifecycleMetadata>();
  const uniqueSharedFlowNames = [...new Set(sharedFlowNames.filter(Boolean))];

  uniqueSharedFlowNames.forEach((name) => metadataBySharedFlowName.set(name, directManagementMetadata()));
  if (uniqueSharedFlowNames.length === 0) {
    return metadataBySharedFlowName;
  }

  try {
    await ensureMongoConnected();
    const codegenResults = await CodegenResultModel.find({
      artifactId: { $in: uniqueSharedFlowNames },
    }).lean();

    for (const codegenResult of codegenResults) {
      const artifactId = optionalString((codegenResult as Record<string, unknown>).artifactId);
      if (artifactId) {
        metadataBySharedFlowName.set(artifactId, toLifecycleMetadata(codegenResult as Record<string, unknown>));
      }
    }
  } catch {
    return metadataBySharedFlowName;
  }

  return metadataBySharedFlowName;
};

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const nestedRecord = (value: unknown, key: string): Record<string, unknown> | null => {
  const record = asRecord(value);
  return record ? asRecord(record[key]) : null;
};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const resolved = stringValue(value);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

const normalizeTimestamp = (value: unknown): string | undefined => {
  const raw = firstString(value);
  if (!raw) {
    return undefined;
  }

  if (/^\d+$/.test(raw)) {
    const date = new Date(Number(raw));
    return Number.isNaN(date.getTime()) ? raw : date.toISOString();
  }

  return raw;
};

const metadata = (value: unknown) =>
  nestedRecord(value, "metaData") ?? nestedRecord(value, "metadata") ?? null;

const createdAt = (sharedFlowDetail: unknown, revisionDetail?: unknown): string | undefined =>
  normalizeTimestamp(
    firstString(
      metadata(sharedFlowDetail)?.createdAt,
      metadata(sharedFlowDetail)?.created,
      asRecord(sharedFlowDetail)?.createdAt,
      metadata(revisionDetail)?.createdAt,
      asRecord(revisionDetail)?.createdAt,
    ),
  );

const lastModifiedAt = (sharedFlowDetail: unknown, revisionDetail?: unknown): string | undefined =>
  normalizeTimestamp(
    firstString(
      metadata(sharedFlowDetail)?.lastModifiedAt,
      metadata(sharedFlowDetail)?.lastModified,
      asRecord(sharedFlowDetail)?.lastModifiedAt,
      asRecord(sharedFlowDetail)?.lastModified,
      metadata(revisionDetail)?.lastModifiedAt,
      asRecord(revisionDetail)?.lastModifiedAt,
    ),
  );

const collectEnvironments = (value: unknown): string[] => {
  const environments = new Set<string>();

  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }

    const record = asRecord(candidate);
    if (!record) {
      return;
    }

    const environment = firstString(record.environment, record.env);
    if (environment) {
      environments.add(environment);
    }

    const name = firstString(record.name);
    if (name && ("deployStartTime" in record || "revision" in record || "state" in record)) {
      environments.add(name);
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return [...environments].sort();
};

const deploymentCount = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.length;
  }

  const record = asRecord(value);
  if (!record) {
    return 0;
  }

  for (const key of ["deployments", "deployment"]) {
    if (Array.isArray(record[key])) {
      return record[key].length;
    }
  }

  const environments = record.environment;
  if (Array.isArray(environments)) {
    return environments.reduce((total, item) => {
      const itemRecord = asRecord(item);
      const revisions = itemRecord?.revision;
      return total + (Array.isArray(revisions) ? revisions.length : 1);
    }, 0);
  }

  return 0;
};

const latestRevision = (revisions: string[]): string | undefined => {
  if (revisions.length === 0) {
    return undefined;
  }

  return [...revisions].sort((left, right) => Number(right) - Number(left))[0];
};

const queryFlag = (request: Request, name: string, defaultValue = false): boolean => {
  const rawValue = request.query[name];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
};

const detailsConcurrency = (request: Request): number => {
  const rawValue = request.query.concurrency;
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const parsed = Number(value ?? process.env.SHARED_FLOWS_DETAILED_CONCURRENCY ?? 10);
  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 25);
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const asStringArray = (data: unknown): string[] => {
  if (Array.isArray(data)) {
    return data
      .map((item) => String(item))
      .filter((item) => item.trim().length > 0);
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["revision", "revisions"]) {
      if (Array.isArray(record[key])) {
        return record[key]
          .map((item) => String(item))
          .filter((item) => item.trim().length > 0);
      }
    }
  }

  return [];
};

const getRevisionDetails = async (request: Request, revisions: string[]) => {
  const requestConfig = getRequestConfig(request);
  const revisionResponses = await Promise.all(
    revisions.map(async (revision) => {
      try {
        const response = await apiClient.get(sharedFlowRevisionPath(request, revision), requestConfig);
        return {
          revision,
          data: response.data,
        };
      } catch (error) {
        return {
          revision,
          error: error instanceof Error ? error.message : "Unable to fetch revision detail",
        };
      }
    }),
  );

  return revisionResponses;
};

export const sharedFlowsEndpoints = {
  listSharedFlows: async (request: Request) => {
    const response = await apiClient.get(sharedFlowsBasePath(request), getRequestConfig(request));
    return response.data;
  },

  listSharedFlowsDetailed: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    const includeRaw = queryFlag(request, "includeRaw", false);
    const includeLatestRevisionDetail = queryFlag(request, "includeLatestRevisionDetail", false);
    const includeDeployments = queryFlag(request, "includeDeployments", true);
    const listResponse = await apiClient.get(sharedFlowsBasePath(request), requestConfig);
    const sharedFlowItems = getSharedFlowItems(listResponse.data)
      .map((item) => ({ item, name: sharedFlowName(item) }))
      .filter((sharedFlow): sharedFlow is { item: unknown; name: string } => Boolean(sharedFlow.name));
    const lifecycleMetadataBySharedFlowName = await lifecycleMetadataForSharedFlows(
      sharedFlowItems.map((sharedFlow) => sharedFlow.name),
    );

    const sharedFlows = await mapWithConcurrency(
      sharedFlowItems,
      detailsConcurrency(request),
      async ({ item, name }) => {
        try {
          const [sharedFlowResult, deploymentsResult] = await Promise.all([
            apiClient.get(sharedFlowPathByName(request, name), requestConfig)
              .then((response) => ({ data: response.data }))
              .catch((error) => ({
                error: error instanceof Error ? error.message : "Unable to fetch shared flow detail",
              })),
            includeDeployments
              ? apiClient.get(sharedFlowDeploymentsPathByName(request, name), requestConfig)
                .then((response) => ({ data: response.data }))
                .catch((error) => ({
                  error: error instanceof Error ? error.message : "Unable to fetch deployments",
                }))
              : Promise.resolve({ data: null }),
          ]);

          const sharedFlowDetail = "data" in sharedFlowResult ? sharedFlowResult.data : null;
          const revisions = asStringArray(
            asRecord(sharedFlowDetail)?.revision ?? asRecord(sharedFlowDetail)?.revisions,
          );
          const latest = latestRevision(revisions);
          const latestRevisionResult = includeLatestRevisionDetail && latest
            ? await apiClient.get(sharedFlowRevisionPathByName(request, name, latest), requestConfig)
              .then((response) => ({ data: response.data }))
              .catch((error) => ({
                error: error instanceof Error ? error.message : "Unable to fetch latest revision",
              }))
            : null;
          const latestRevisionDetail = latestRevisionResult && "data" in latestRevisionResult
            ? latestRevisionResult.data
            : null;
          const deployments = "data" in deploymentsResult ? deploymentsResult.data : null;
          const listRecord = asRecord(item);
          const lifecycle = lifecycleMetadataBySharedFlowName.get(name) ?? directManagementMetadata();
          const environments = collectEnvironments(deployments);

          return {
            ...(listRecord ?? {}),
            name,
            lifecycle,
            source: lifecycle.source,
            createdInLifecycleTool: lifecycle.createdInLifecycleTool,
            environments,
            environmentSummary: environments.join(", ") || "Not deployed",
            latestRevision: latest,
            revisionCount: revisions.length,
            revisions,
            deploymentCount: deploymentCount(deployments),
            createdAt: createdAt(sharedFlowDetail, latestRevisionDetail),
            lastModifiedAt: lastModifiedAt(sharedFlowDetail, latestRevisionDetail),
            ...(includeRaw ? { sharedFlow: sharedFlowDetail } : {}),
            ...(includeLatestRevisionDetail ? { latestRevisionDetail } : {}),
            ...(includeRaw ? { deployments } : {}),
            errors: [
              "error" in sharedFlowResult ? { source: "sharedFlow", message: sharedFlowResult.error } : null,
              "error" in deploymentsResult ? { source: "deployments", message: deploymentsResult.error } : null,
              latestRevisionResult && "error" in latestRevisionResult
                ? { source: "latestRevision", message: latestRevisionResult.error }
                : null,
            ].filter(Boolean),
          };
        } catch (error) {
          const lifecycle = lifecycleMetadataBySharedFlowName.get(name) ?? directManagementMetadata();

          return {
            ...(asRecord(item) ?? {}),
            name,
            lifecycle,
            source: lifecycle.source,
            createdInLifecycleTool: lifecycle.createdInLifecycleTool,
            environments: [],
            environmentSummary: "Unable to load",
            revisions: [],
            revisionCount: 0,
            deploymentCount: 0,
            errors: [{
              source: "sharedFlowDetails",
              message: error instanceof Error ? error.message : "Unable to fetch shared flow details",
            }],
          };
        }
      },
    );

    return {
      organization: request.params.org,
      count: sharedFlows.length,
      options: {
        includeDeployments,
        includeLatestRevisionDetail,
        includeRaw,
        concurrency: detailsConcurrency(request),
      },
      sharedFlows,
    };
  },

  getSharedFlow: async (request: Request) => {
    const response = await apiClient.get(sharedFlowPath(request), getRequestConfig(request));
    return response.data;
  },

  getSharedFlowDetails: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    const lifecycle = await lifecycleMetadataForSharedFlow(String(request.params.sharedFlow));
    const [sharedFlowResponse, revisionsResponse, deploymentsResult] = await Promise.all([
      apiClient.get(sharedFlowPath(request), requestConfig),
      apiClient.get(sharedFlowRevisionsPath(request), requestConfig),
      apiClient.get(sharedFlowDeploymentsPath(request), requestConfig)
        .then((response) => ({ data: response.data }))
        .catch((error) => ({
          error: error instanceof Error ? error.message : "Unable to fetch deployments",
        })),
    ]);

    const revisions = asStringArray(revisionsResponse.data);
    const revisionDetails = await getRevisionDetails(request, revisions);

    return {
      organization: request.params.org,
      sharedFlow: request.params.sharedFlow,
      lifecycle,
      source: lifecycle.source,
      createdInLifecycleTool: lifecycle.createdInLifecycleTool,
      sharedFlowDetails: sharedFlowResponse.data,
      revisions,
      revisionDetails,
      deployments: "data" in deploymentsResult ? deploymentsResult.data : null,
      deploymentError: "error" in deploymentsResult ? deploymentsResult.error : undefined,
    };
  },
};
