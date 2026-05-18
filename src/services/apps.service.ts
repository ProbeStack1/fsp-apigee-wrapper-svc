import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { buildResourceKey, executeTrackedMutation, resolveListResourceSources, syncDirectResources, type ResourceSourceMetadata } from "./config-tracking.service";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getBody, getForwardBody, getRequestConfig } from "./request-utils.service";

const bodyName = (request: Request, fallback?: string) => {
  const body = getBody(request) as Record<string, unknown> | undefined;
  return typeof body?.name === "string" && body.name.trim() ? body.name.trim() : fallback ?? "unknown";
};

const asArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["app", "apps", "developerApps"]) {
      if (Array.isArray(record[key])) {
        return record[key];
      }
    }
  }

  return [];
};

const itemName = (item: unknown, fallback?: string): string | null => {
  if (typeof item === "string" && item.trim()) {
    return item.trim();
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const name = record.name;
    const appId = record.appId;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }

    if (typeof appId === "string" && appId.trim()) {
      return appId.trim();
    }

    return fallback ?? null;
  }

  return fallback ?? null;
};

const annotateItem = (item: unknown, name: string, metadata?: ResourceSourceMetadata) => {
  const source = metadata?.source ?? "DIRECT_MANAGEMENT_API";
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      ...(item as Record<string, unknown>),
      source,
      onboardingId: metadata?.onboardingId,
      microserviceId: metadata?.microserviceId,
    };
  }

  return {
    name,
    source,
    onboardingId: metadata?.onboardingId,
    microserviceId: metadata?.microserviceId,
  };
};

const replaceList = (data: unknown, enrichedItems: unknown[]) => {
  if (Array.isArray(data)) {
    return enrichedItems;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["app", "apps", "developerApps"]) {
      if (Array.isArray(record[key])) {
        return {
          ...record,
          [key]: enrichedItems,
        };
      }
    }
  }

  return data;
};

const appsPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/developers/${encodePathParam(request.params.developer)}/apps`;

const appPath = (request: Request) =>
  `${appsPath(request)}/${encodePathParam(request.params.app)}`;

export const appsEndpoints = {
  listApps: async (request: Request) => {
    const response = await apiClient.get(appsPath(request), getRequestConfig(request));
    const resources = asArray(response.data)
      .map((item) => ({ item, name: itemName(item) }))
      .filter((resource): resource is { item: unknown; name: string } => Boolean(resource.name))
      .map(({ item, name }) => ({
        configType: "DEVELOPER_APP" as const,
        org: String(request.params.org),
        developerEmail: String(request.params.developer),
        name,
        payload: item,
    }));
    const metadataByKey = await resolveListResourceSources(request, resources);
    const enrichedItems = resources
      .map((resource) => ({ resource, metadata: metadataByKey.get(buildResourceKey(resource)) }))
      .filter((item): item is { resource: (typeof resources)[number]; metadata: ResourceSourceMetadata } =>
        Boolean(item.metadata),
      )
      .map(({ resource, metadata }) => annotateItem(resource.payload, resource.name, metadata));
    return replaceList(response.data, enrichedItems);
  },

  getApp: async (request: Request) => {
    const response = await apiClient.get(appPath(request), getRequestConfig(request));
    await syncDirectResources(request, [{
      configType: "DEVELOPER_APP",
      org: String(request.params.org),
      developerEmail: String(request.params.developer),
      name: itemName(response.data, String(request.params.app)) ?? String(request.params.app),
      payload: response.data,
    }]);
    return response.data;
  },

  createApp: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "DEVELOPER_APP",
      operation: "CREATE",
      org: String(request.params.org),
      developerEmail: String(request.params.developer),
      name: bodyName(request),
      resourceUrl: `${appsPath(request)}/${encodePathParam(bodyName(request))}`,
      requestConfig,
      execute: async () => {
        const response = await apiClient.post(appsPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  updateApp: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "DEVELOPER_APP",
      operation: "UPDATE",
      org: String(request.params.org),
      developerEmail: String(request.params.developer),
      name: String(request.params.app),
      resourceUrl: appPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.put(appPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  deleteApp: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "DEVELOPER_APP",
      operation: "DELETE",
      org: String(request.params.org),
      developerEmail: String(request.params.developer),
      name: String(request.params.app),
      resourceUrl: appPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.delete(appPath(request), requestConfig);
        return response.data ?? { success: true };
      },
    });
  },
};
