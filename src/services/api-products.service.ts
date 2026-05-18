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
    for (const key of ["apiProduct", "apiProducts", "products"]) {
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

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["apiProduct", "apiProducts", "products"]) {
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

const productsPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/apiproducts`;

const productPath = (request: Request) =>
  `${productsPath(request)}/${encodePathParam(request.params.name)}`;

export const apiProductsEndpoints = {
  listProducts: async (request: Request) => {
    const response = await apiClient.get(productsPath(request), getRequestConfig(request));
    const resources = asArray(response.data)
      .map((item) => ({ item, name: itemName(item) }))
      .filter((resource): resource is { item: unknown; name: string } => Boolean(resource.name))
      .map(({ item, name }) => ({
        configType: "API_PRODUCT" as const,
        org: String(request.params.org),
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

  getProduct: async (request: Request) => {
    const response = await apiClient.get(productPath(request), getRequestConfig(request));
    await syncDirectResources(request, [{
      configType: "API_PRODUCT",
      org: String(request.params.org),
      name: itemName(response.data, String(request.params.name)) ?? String(request.params.name),
      payload: response.data,
    }]);
    return response.data;
  },

  createProduct: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "API_PRODUCT",
      operation: "CREATE",
      org: String(request.params.org),
      name: bodyName(request),
      resourceUrl: `${productsPath(request)}/${encodePathParam(bodyName(request))}`,
      requestConfig,
      execute: async () => {
        const response = await apiClient.post(productsPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  updateProduct: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "API_PRODUCT",
      operation: "UPDATE",
      org: String(request.params.org),
      name: String(request.params.name),
      resourceUrl: productPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.put(productPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  deleteProduct: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "API_PRODUCT",
      operation: "DELETE",
      org: String(request.params.org),
      name: String(request.params.name),
      resourceUrl: productPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.delete(productPath(request), requestConfig);
        return response.data ?? { success: true };
      },
    });
  },
};
