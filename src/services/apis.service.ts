import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { ensureMongoConnected } from "../db/mongo";
import { CodegenResultModel } from "../models/codegen-result.model";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const apisBasePath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/apis`;

const apiPathByName = (request: Request, apiName: string) =>
  `${apisBasePath(request)}/${encodePathParam(apiName)}`;

const apiPath = (request: Request) =>
  apiPathByName(request, String(request.params.api));

const apiRevisionsPathByName = (request: Request, apiName: string) =>
  `${apiPathByName(request, apiName)}/revisions`;

const apiRevisionsPath = (request: Request) =>
  apiRevisionsPathByName(request, String(request.params.api));

const apiRevisionPathByName = (request: Request, apiName: string, revision: string) =>
  `${apiRevisionsPathByName(request, apiName)}/${encodePathParam(revision)}`;

const apiRevisionPath = (request: Request, revision: string) =>
  apiRevisionPathByName(request, String(request.params.api), revision);

const apiDeploymentsPathByName = (request: Request, apiName: string) =>
  `${apiPathByName(request, apiName)}/deployments`;

const apiDeploymentsPath = (request: Request) =>
  apiDeploymentsPathByName(request, String(request.params.api));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const getProxyItems = (data: unknown): unknown[] => {
  if (Array.isArray(data)) {
    return data;
  }

  const record = asRecord(data);
  if (!record) {
    return [];
  }

  for (const key of ["proxies", "apis", "apiProxy", "apiProxies"]) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  return [];
};

const proxyName = (item: unknown): string | null => {
  if (typeof item === "string" && item.trim()) {
    return item.trim();
  }

  const record = asRecord(item);
  const name = record?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};

type LifecycleProxyMetadata = {
  source: "LIFECYCLE_TOOL" | "DIRECT_MANAGEMENT_API";
  createdInLifecycleTool: boolean;
  artifactId?: string;
  codegenResultId?: string;
  microserviceId?: string;
  onboardingId?: string;
  status?: string;
};

const directManagementMetadata = (): LifecycleProxyMetadata => ({
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

const toLifecycleProxyMetadata = (codegenResult: Record<string, unknown> | null | undefined): LifecycleProxyMetadata => {
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

const lifecycleMetadataForProxy = async (proxyNameValue: string): Promise<LifecycleProxyMetadata> => {
  try {
    await ensureMongoConnected();
    const codegenResult = await CodegenResultModel.findOne({ artifactId: proxyNameValue }).lean();
    return toLifecycleProxyMetadata(codegenResult as Record<string, unknown> | null);
  } catch {
    return directManagementMetadata();
  }
};

const lifecycleMetadataForProxies = async (proxyNames: string[]): Promise<Map<string, LifecycleProxyMetadata>> => {
  const metadataByProxyName = new Map<string, LifecycleProxyMetadata>();
  const uniqueProxyNames = [...new Set(proxyNames.filter(Boolean))];

  uniqueProxyNames.forEach((name) => metadataByProxyName.set(name, directManagementMetadata()));
  if (uniqueProxyNames.length === 0) {
    return metadataByProxyName;
  }

  try {
    await ensureMongoConnected();
    const codegenResults = await CodegenResultModel.find({
      artifactId: { $in: uniqueProxyNames },
    }).lean();

    for (const codegenResult of codegenResults) {
      const artifactId = optionalString((codegenResult as Record<string, unknown>).artifactId);
      if (artifactId) {
        metadataByProxyName.set(artifactId, toLifecycleProxyMetadata(codegenResult as Record<string, unknown>));
      }
    }
  } catch {
    return metadataByProxyName;
  }

  return metadataByProxyName;
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

const createdAt = (proxyDetail: unknown, revisionDetail?: unknown): string | undefined =>
  normalizeTimestamp(
    firstString(
      metadata(proxyDetail)?.createdAt,
      metadata(proxyDetail)?.created,
      asRecord(proxyDetail)?.createdAt,
      metadata(revisionDetail)?.createdAt,
      asRecord(revisionDetail)?.createdAt,
    ),
  );

const lastModifiedAt = (proxyDetail: unknown, revisionDetail?: unknown): string | undefined =>
  normalizeTimestamp(
    firstString(
      metadata(proxyDetail)?.lastModifiedAt,
      metadata(proxyDetail)?.lastModified,
      asRecord(proxyDetail)?.lastModifiedAt,
      asRecord(proxyDetail)?.lastModified,
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

const inferProxyType = (name: string, listItem: unknown, proxyDetail: unknown, revisionDetail?: unknown): string => {
  const source = JSON.stringify([name, listItem, proxyDetail, revisionDetail]).toLowerCase();
  if (source.includes("graphql")) return "GraphQL";
  if (source.includes("soap") || source.includes("wsdl")) return "SOAP";
  if (source.includes("mcp")) return "MCP";
  return "REST";
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
  const parsed = Number(value ?? process.env.APIS_DETAILED_CONCURRENCY ?? 10);
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
        const response = await apiClient.get(apiRevisionPath(request, revision), requestConfig);
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

export const apisEndpoints = {
  listApis: async (request: Request) => {
    const response = await apiClient.get(apisBasePath(request), getRequestConfig(request));
    return response.data;
  },

  listApisDetailed: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    const includeRaw = queryFlag(request, "includeRaw", false);
    const includeLatestRevisionDetail = queryFlag(request, "includeLatestRevisionDetail", false);
    const includeDeployments = queryFlag(request, "includeDeployments", true);
    const listResponse = await apiClient.get(apisBasePath(request), requestConfig);
    const proxyItems = getProxyItems(listResponse.data)
      .map((item) => ({ item, name: proxyName(item) }))
      .filter((proxy): proxy is { item: unknown; name: string } => Boolean(proxy.name));
    const lifecycleMetadataByProxyName = await lifecycleMetadataForProxies(
      proxyItems.map((proxy) => proxy.name),
    );

    const proxies = await mapWithConcurrency(proxyItems, detailsConcurrency(request), async ({ item, name }) => {
      try {
        const [proxyResult, deploymentsResult] = await Promise.all([
          apiClient.get(apiPathByName(request, name), requestConfig)
            .then((response) => ({ data: response.data }))
            .catch((error) => ({ error: error instanceof Error ? error.message : "Unable to fetch proxy detail" })),
          includeDeployments
            ? apiClient.get(apiDeploymentsPathByName(request, name), requestConfig)
              .then((response) => ({ data: response.data }))
              .catch((error) => ({ error: error instanceof Error ? error.message : "Unable to fetch deployments" }))
            : Promise.resolve({ data: null }),
        ]);

        const proxyDetail = "data" in proxyResult ? proxyResult.data : null;
        const revisions = asStringArray(asRecord(proxyDetail)?.revision ?? asRecord(proxyDetail)?.revisions);
        const latest = latestRevision(revisions);
        const latestRevisionResult = includeLatestRevisionDetail && latest
          ? await apiClient.get(apiRevisionPathByName(request, name, latest), requestConfig)
            .then((response) => ({ data: response.data }))
            .catch((error) => ({ error: error instanceof Error ? error.message : "Unable to fetch latest revision" }))
          : null;
        const latestRevisionDetail = latestRevisionResult && "data" in latestRevisionResult
          ? latestRevisionResult.data
          : null;
        const deployments = "data" in deploymentsResult ? deploymentsResult.data : null;
        const listRecord = asRecord(item);

        return {
          ...(listRecord ?? {}),
          name,
          lifecycle: lifecycleMetadataByProxyName.get(name) ?? directManagementMetadata(),
          source: lifecycleMetadataByProxyName.get(name)?.source ?? "DIRECT_MANAGEMENT_API",
          createdInLifecycleTool: lifecycleMetadataByProxyName.get(name)?.createdInLifecycleTool ?? false,
          apiProxyType: firstString(listRecord?.apiProxyType, asRecord(proxyDetail)?.apiProxyType),
          type: inferProxyType(name, item, proxyDetail, latestRevisionDetail),
          environments: collectEnvironments(deployments),
          environmentSummary: collectEnvironments(deployments).join(", ") || "Not deployed",
          latestRevision: latest,
          revisionCount: revisions.length,
          revisions,
          deploymentCount: deploymentCount(deployments),
          createdAt: createdAt(proxyDetail, latestRevisionDetail),
          lastModifiedAt: lastModifiedAt(proxyDetail, latestRevisionDetail),
          ...(includeRaw ? { proxy: proxyDetail } : {}),
          ...(includeLatestRevisionDetail ? { latestRevisionDetail } : {}),
          ...(includeRaw ? { deployments } : {}),
          errors: [
            "error" in proxyResult ? { source: "proxy", message: proxyResult.error } : null,
            "error" in deploymentsResult ? { source: "deployments", message: deploymentsResult.error } : null,
            latestRevisionResult && "error" in latestRevisionResult
              ? { source: "latestRevision", message: latestRevisionResult.error }
              : null,
          ].filter(Boolean),
        };
      } catch (error) {
        return {
          ...(asRecord(item) ?? {}),
          name,
          lifecycle: lifecycleMetadataByProxyName.get(name) ?? directManagementMetadata(),
          source: lifecycleMetadataByProxyName.get(name)?.source ?? "DIRECT_MANAGEMENT_API",
          createdInLifecycleTool: lifecycleMetadataByProxyName.get(name)?.createdInLifecycleTool ?? false,
          type: inferProxyType(name, item, null),
          environments: [],
          environmentSummary: "Unable to load",
          revisions: [],
          revisionCount: 0,
          deploymentCount: 0,
          errors: [{
            source: "proxyDetails",
            message: error instanceof Error ? error.message : "Unable to fetch proxy details",
          }],
        };
      }
    });

    return {
      organization: request.params.org,
      count: proxies.length,
      options: {
        includeDeployments,
        includeLatestRevisionDetail,
        includeRaw,
        concurrency: detailsConcurrency(request),
      },
      proxies,
    };
  },

  getApi: async (request: Request) => {
    const response = await apiClient.get(apiPath(request), getRequestConfig(request));
    return response.data;
  },

  getApiDetails: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    const lifecycle = await lifecycleMetadataForProxy(String(request.params.api));
    const [proxyResponse, revisionsResponse, deploymentsResult] = await Promise.all([
      apiClient.get(apiPath(request), requestConfig),
      apiClient.get(apiRevisionsPath(request), requestConfig),
      apiClient.get(apiDeploymentsPath(request), requestConfig)
        .then((response) => ({ data: response.data }))
        .catch((error) => ({
          error: error instanceof Error ? error.message : "Unable to fetch deployments",
        })),
    ]);

    const revisions = asStringArray(revisionsResponse.data);
    const revisionDetails = await getRevisionDetails(request, revisions);

    return {
      organization: request.params.org,
      api: request.params.api,
      lifecycle,
      source: lifecycle.source,
      createdInLifecycleTool: lifecycle.createdInLifecycleTool,
      proxy: proxyResponse.data,
      revisions,
      revisionDetails,
      deployments: "data" in deploymentsResult ? deploymentsResult.data : null,
      deploymentError: "error" in deploymentsResult ? deploymentsResult.error : undefined,
    };
  },

  importApi: async (request: Request) => {
    const response = await apiClient.post(
      apisBasePath(request),
      getForwardBody(request),
      getRequestConfig(request),
    );
    return response.data;
  },
};
