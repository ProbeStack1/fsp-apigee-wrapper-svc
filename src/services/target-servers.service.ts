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
    const targetServers = (data as Record<string, unknown>).targetServers;
    return Array.isArray(targetServers) ? targetServers : [];
  }

  return [];
};

const itemName = (item: unknown, fallback?: string): string | null => {
  if (typeof item === "string" && item.trim()) {
    return item.trim();
  }

  if (item && typeof item === "object") {
    const name = (item as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() ? name.trim() : fallback ?? null;
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

  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).targetServers)) {
    return {
      ...(data as Record<string, unknown>),
      targetServers: enrichedItems,
    };
  }

  return data;
};

const targetServersPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/environments/${encodePathParam(request.params.env)}/targetservers`;

const targetServerPath = (request: Request) =>
  `${targetServersPath(request)}/${encodePathParam(request.params.name)}`;

export const targetServersEndpoints = {
  listTargetServers: async (request: Request) => {
    const response = await apiClient.get(targetServersPath(request), getRequestConfig(request));
    const resources = asArray(response.data)
      .map((item) => ({ item, name: itemName(item) }))
      .filter((resource): resource is { item: unknown; name: string } => Boolean(resource.name))
      .map(({ item, name }) => ({
        configType: "TARGET_SERVER" as const,
        org: String(request.params.org),
        environment: String(request.params.env),
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

  getTargetServer: async (request: Request) => {
    const response = await apiClient.get(targetServerPath(request), getRequestConfig(request));
    await syncDirectResources(request, [{
      configType: "TARGET_SERVER",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: itemName(response.data, String(request.params.name)) ?? String(request.params.name),
      payload: response.data,
    }]);
    return response.data;
  },

  createTargetServer: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "TARGET_SERVER",
      operation: "CREATE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: bodyName(request),
      resourceUrl: `${targetServersPath(request)}/${encodePathParam(bodyName(request))}`,
      requestConfig,
      execute: async () => {
        const response = await apiClient.post(targetServersPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  updateTargetServer: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "TARGET_SERVER",
      operation: "UPDATE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: String(request.params.name),
      resourceUrl: targetServerPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.put(targetServerPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  deleteTargetServer: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "TARGET_SERVER",
      operation: "DELETE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: String(request.params.name),
      resourceUrl: targetServerPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.delete(targetServerPath(request), requestConfig);
        return response.data ?? { success: true };
      },
    });
  },
};
