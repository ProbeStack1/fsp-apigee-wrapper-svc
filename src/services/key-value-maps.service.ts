import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { buildResourceKey, executeTrackedMutation, resolveListResourceSources, syncDirectResources, type ResourceSourceMetadata } from "./config-tracking.service";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getBody, getForwardBody, getRequestConfig } from "./request-utils.service";

const bodyName = (request: Request, fallback?: string) => {
  const body = getBody(request) as Record<string, unknown> | undefined;
  return typeof body?.name === "string" && body.name.trim() ? body.name.trim() : fallback ?? "unknown";
};

const asArray = (data: unknown, keys: string[]): unknown[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
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
    for (const key of ["name", "key"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
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

const replaceList = (data: unknown, enrichedItems: unknown[], keys: string[]) => {
  if (Array.isArray(data)) {
    return enrichedItems;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
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

const kvmsPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/environments/${encodePathParam(request.params.env)}/keyvaluemaps`;

const kvmPath = (request: Request) =>
  `${kvmsPath(request)}/${encodePathParam(request.params.kvm)}`;

const entriesPath = (request: Request) =>
  `${kvmPath(request)}/entries`;

const entryPath = (request: Request) =>
  `${entriesPath(request)}/${encodePathParam(request.params.entry)}`;

export const keyValueMapsEndpoints = {
  listKvms: async (request: Request) => {
    const response = await apiClient.get(kvmsPath(request), getRequestConfig(request));
    const keys = ["keyValueMaps", "keyvaluemaps", "kvms"];
    const resources = asArray(response.data, keys)
      .map((item) => ({ item, name: itemName(item) }))
      .filter((resource): resource is { item: unknown; name: string } => Boolean(resource.name))
      .map(({ item, name }) => ({
        configType: "KVM" as const,
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
    return replaceList(response.data, enrichedItems, keys);
  },

  getKvm: async (request: Request) => {
    const response = await apiClient.get(kvmPath(request), getRequestConfig(request));
    await syncDirectResources(request, [{
      configType: "KVM",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: itemName(response.data, String(request.params.kvm)) ?? String(request.params.kvm),
      payload: response.data,
    }]);
    return response.data;
  },

  createKvm: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "KVM",
      operation: "CREATE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: bodyName(request),
      resourceUrl: `${kvmsPath(request)}/${encodePathParam(bodyName(request))}`,
      requestConfig,
      execute: async () => {
        const response = await apiClient.post(kvmsPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  updateKvm: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "KVM",
      operation: "UPDATE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: String(request.params.kvm),
      resourceUrl: kvmPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.put(kvmPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  deleteKvm: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "KVM",
      operation: "DELETE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: String(request.params.kvm),
      resourceUrl: kvmPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.delete(kvmPath(request), requestConfig);
        return response.data ?? { success: true };
      },
    });
  },

  listEntries: async (request: Request) => {
    const response = await apiClient.get(entriesPath(request), getRequestConfig(request));
    const keys = ["entry", "entries"];
    const resources = asArray(response.data, keys)
      .map((item) => ({ item, name: itemName(item) }))
      .filter((resource): resource is { item: unknown; name: string } => Boolean(resource.name))
      .map(({ item, name }) => ({
        configType: "KVM_ENTRY" as const,
        org: String(request.params.org),
        environment: String(request.params.env),
        name: `${String(request.params.kvm)}/${name}`,
        payload: item,
    }));
    const metadataByKey = await resolveListResourceSources(request, resources);
    const enrichedItems = resources
      .map((resource) => ({ resource, metadata: metadataByKey.get(buildResourceKey(resource)) }))
      .filter((item): item is { resource: (typeof resources)[number]; metadata: ResourceSourceMetadata } =>
        Boolean(item.metadata),
      )
      .map(({ resource, metadata }) =>
        annotateItem(resource.payload, resource.name.split("/").slice(-1)[0] ?? resource.name, metadata),
      );
    return replaceList(response.data, enrichedItems, keys);
  },

  getEntry: async (request: Request) => {
    const response = await apiClient.get(entryPath(request), getRequestConfig(request));
    const entryName = itemName(response.data, String(request.params.entry)) ?? String(request.params.entry);
    await syncDirectResources(request, [{
      configType: "KVM_ENTRY",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: `${String(request.params.kvm)}/${entryName}`,
      payload: response.data,
    }]);
    return response.data;
  },

  createEntry: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "KVM_ENTRY",
      operation: "CREATE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: `${String(request.params.kvm)}/${bodyName(request)}`,
      resourceUrl: `${entriesPath(request)}/${encodePathParam(bodyName(request))}`,
      requestConfig,
      execute: async () => {
        const response = await apiClient.post(entriesPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  updateEntry: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "KVM_ENTRY",
      operation: "UPDATE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: `${String(request.params.kvm)}/${String(request.params.entry)}`,
      resourceUrl: entryPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.put(entryPath(request), getForwardBody(request), requestConfig);
        return response.data;
      },
    });
  },

  deleteEntry: async (request: Request) => {
    const requestConfig = getRequestConfig(request);
    return executeTrackedMutation({
      request,
      configType: "KVM_ENTRY",
      operation: "DELETE",
      org: String(request.params.org),
      environment: String(request.params.env),
      name: `${String(request.params.kvm)}/${String(request.params.entry)}`,
      resourceUrl: entryPath(request),
      requestConfig,
      execute: async () => {
        const response = await apiClient.delete(entryPath(request), requestConfig);
        return response.data ?? { success: true };
      },
    });
  },
};
