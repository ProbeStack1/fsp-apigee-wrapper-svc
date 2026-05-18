import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type { Request } from "express";
import { createHash } from "node:crypto";

import { apiClient } from "../client/api-client";
import { ensureMongoConnected } from "../db/mongo";
import { ApigeeConfigHistoryModel } from "../models/apigee-config-history.model";
import { ApigeeConfigRegistryModel } from "../models/apigee-config-registry.model";
import { getBody, stripTrackingMetadataFromBody } from "./request-utils.service";
import { readTrackingMetadata } from "./tracking-metadata.service";

export type ConfigType = "TARGET_SERVER" | "KVM" | "KVM_ENTRY" | "API_PRODUCT" | "DEVELOPER_APP";
export type ConfigOperation = "CREATE" | "UPDATE" | "DELETE";

type ResourceIdentity = {
  configType: ConfigType;
  org: string;
  environment?: string;
  developerEmail?: string;
  name: string;
};

type TrackedMutationOptions<T> = ResourceIdentity & {
  request: Request;
  operation: ConfigOperation;
  resourceUrl: string;
  requestConfig: AxiosRequestConfig;
  execute: () => Promise<T>;
};

type DirectResource = ResourceIdentity & {
  payload: unknown;
};

export type ResourceSourceMetadata = {
  configId?: string;
  source: "PLATFORM" | "DIRECT_MANAGEMENT_API";
  onboardingId?: string;
  microserviceId?: string;
};

export function buildResourceKey(identity: ResourceIdentity): string {
  return [
    identity.configType,
    identity.org,
    identity.environment ?? "-",
    identity.developerEmail ?? "-",
    identity.name,
  ].join("|");
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data === "string"
        ? error.response.data
        : JSON.stringify(error.response?.data ?? "");
    return responseMessage || error.message;
  }

  return error instanceof Error ? error.message : "Unknown error";
}

async function getBeforeSnapshot(resourceUrl: string, requestConfig: AxiosRequestConfig): Promise<unknown> {
  try {
    const response = await apiClient.get(resourceUrl, requestConfig);
    return response.data;
  } catch {
    return null;
  }
}

export async function executeTrackedMutation<T>(options: TrackedMutationOptions<T>): Promise<T> {
  const tracking = readTrackingMetadata(options.request, true);
  if (!tracking) {
    throw new Error("Tracking metadata is required");
  }

  await ensureMongoConnected();

  const now = new Date();
  const resourceKey = buildResourceKey(options);
  const requestPayload = stripTrackingMetadataFromBody(getBody(options.request));
  const beforeSnapshot =
    options.operation === "UPDATE" || options.operation === "DELETE"
      ? await getBeforeSnapshot(options.resourceUrl, options.requestConfig)
      : null;

  try {
    const responsePayload = await options.execute();
    const afterSnapshot = options.operation === "DELETE" ? null : responsePayload;
    const existingRegistry = await ApigeeConfigRegistryModel.findOne({
      onboardingId: tracking.onboardingId,
      resourceKey,
    }).lean();

    const registryUpdate: Record<string, unknown> = {
      onboardingId: tracking.onboardingId,
      microserviceId: tracking.microserviceId,
      configType: options.configType,
      source: "PLATFORM",
      org: options.org,
      environment: options.environment,
      developerEmail: options.developerEmail,
      name: options.name,
      resourceKey,
      status: options.operation === "DELETE" ? "DELETED" : "ACTIVE",
      lastKnownPayload: afterSnapshot ?? beforeSnapshot ?? responsePayload,
      payloadHash: hashPayload(afterSnapshot ?? beforeSnapshot ?? responsePayload),
      updatedBy: tracking.createdBy,
      updatedAt: now,
    };

    if (!existingRegistry) {
      registryUpdate.createdBy = tracking.createdBy;
      registryUpdate.createdAt = now;
    }

    if (options.operation === "DELETE") {
      registryUpdate.deletedBy = tracking.createdBy;
      registryUpdate.deletedAt = now;
    }

    const registry = await ApigeeConfigRegistryModel.findOneAndUpdate(
      { onboardingId: tracking.onboardingId, resourceKey },
      { $set: registryUpdate },
      { new: true, upsert: true },
    );

    await ApigeeConfigHistoryModel.create({
      configId: registry._id.toString(),
      onboardingId: tracking.onboardingId,
      microserviceId: tracking.microserviceId,
      configType: options.configType,
      operation: options.operation,
      source: "PLATFORM",
      org: options.org,
      environment: options.environment,
      developerEmail: options.developerEmail,
      name: options.name,
      resourceKey,
      requestPayload,
      beforeSnapshot,
      afterSnapshot,
      responsePayload,
      status: "SUCCESS",
      createdBy: tracking.createdBy,
      performedAt: now,
    });

    return responsePayload;
  } catch (error) {
    await ApigeeConfigHistoryModel.create({
      onboardingId: tracking.onboardingId,
      microserviceId: tracking.microserviceId,
      configType: options.configType,
      operation: options.operation,
      source: "PLATFORM",
      org: options.org,
      environment: options.environment,
      developerEmail: options.developerEmail,
      name: options.name,
      resourceKey,
      requestPayload,
      beforeSnapshot,
      responsePayload: axios.isAxiosError(error) ? error.response?.data : null,
      status: "FAILED",
      errorMessage: errorMessage(error),
      createdBy: tracking.createdBy,
      performedAt: now,
    });

    throw error;
  }
}

export async function syncDirectResources(request: Request, resources: DirectResource[]): Promise<Map<string, ResourceSourceMetadata>> {
  const metadataByResourceKey = new Map<string, ResourceSourceMetadata>();
  const tracking = readTrackingMetadata(request, false);
  if (!tracking || resources.length === 0) {
    return metadataByResourceKey;
  }

  await ensureMongoConnected();

  const now = new Date();

  for (const resource of resources) {
    const resourceKey = buildResourceKey(resource);
    const payloadHash = hashPayload(resource.payload);
    const existingRegistry = await ApigeeConfigRegistryModel.findOne({
      onboardingId: tracking.onboardingId,
      resourceKey,
    });

    if (!existingRegistry) {
      const registry = await ApigeeConfigRegistryModel.create({
        onboardingId: tracking.onboardingId,
        microserviceId: tracking.microserviceId,
        configType: resource.configType,
        source: "DIRECT_MANAGEMENT_API",
        org: resource.org,
        environment: resource.environment,
        developerEmail: resource.developerEmail,
        name: resource.name,
        resourceKey,
        status: "ACTIVE",
        lastKnownPayload: resource.payload,
        payloadHash,
        createdBy: tracking.createdBy,
        createdAt: now,
        updatedBy: tracking.createdBy,
        updatedAt: now,
      });

      metadataByResourceKey.set(resourceKey, {
        configId: registry._id.toString(),
        source: "DIRECT_MANAGEMENT_API",
        onboardingId: tracking.onboardingId,
        microserviceId: tracking.microserviceId,
      });

      await ApigeeConfigHistoryModel.create({
        configId: registry._id.toString(),
        onboardingId: tracking.onboardingId,
        microserviceId: tracking.microserviceId,
        configType: resource.configType,
        operation: "SYNC_DISCOVERED",
        source: "DIRECT_MANAGEMENT_API",
        org: resource.org,
        environment: resource.environment,
        developerEmail: resource.developerEmail,
        name: resource.name,
        resourceKey,
        afterSnapshot: resource.payload,
        responsePayload: resource.payload,
        status: "SUCCESS",
        createdBy: tracking.createdBy,
        performedAt: now,
      });

      continue;
    }

    if (existingRegistry.payloadHash !== payloadHash || existingRegistry.status !== "ACTIVE") {
      const beforeSnapshot = existingRegistry.lastKnownPayload;
      existingRegistry.microserviceId = tracking.microserviceId ?? existingRegistry.microserviceId;
      existingRegistry.status = "ACTIVE";
      existingRegistry.lastKnownPayload = resource.payload;
      existingRegistry.payloadHash = payloadHash;
      existingRegistry.updatedBy = tracking.createdBy;
      existingRegistry.updatedAt = now;
      await existingRegistry.save();

      await ApigeeConfigHistoryModel.create({
        configId: existingRegistry._id.toString(),
        onboardingId: tracking.onboardingId,
        microserviceId: tracking.microserviceId,
        configType: resource.configType,
        operation: "SYNC_CHANGED",
        source: "DIRECT_MANAGEMENT_API",
        org: resource.org,
        environment: resource.environment,
        developerEmail: resource.developerEmail,
        name: resource.name,
        resourceKey,
        beforeSnapshot,
        afterSnapshot: resource.payload,
        responsePayload: resource.payload,
        status: "SUCCESS",
        createdBy: tracking.createdBy,
        performedAt: now,
      });
    }

    metadataByResourceKey.set(resourceKey, {
      configId: existingRegistry._id.toString(),
      source: existingRegistry.source === "PLATFORM" ? "PLATFORM" : "DIRECT_MANAGEMENT_API",
      onboardingId: tracking.onboardingId,
      microserviceId: existingRegistry.microserviceId ?? tracking.microserviceId,
    });
  }

  return metadataByResourceKey;
}

export async function resolveListResourceSources(
  request: Request,
  resources: DirectResource[],
): Promise<Map<string, ResourceSourceMetadata>> {
  const metadataByResourceKey = new Map<string, ResourceSourceMetadata>();
  if (resources.length === 0) {
    return metadataByResourceKey;
  }

  await ensureMongoConnected();

  const tracking = readTrackingMetadata(request, false);
  const resourceKeys = [...new Set(resources.map((resource) => buildResourceKey(resource)))];
  const query: Record<string, unknown> = {
    resourceKey: { $in: resourceKeys },
    status: "ACTIVE",
  };

  if (tracking?.onboardingId) {
    query.onboardingId = tracking.onboardingId;
  }

  const registries = await ApigeeConfigRegistryModel.find(query).lean();
  const registriesByResourceKey = new Map<string, typeof registries>();

  for (const registry of registries) {
    const existing = registriesByResourceKey.get(registry.resourceKey) ?? [];
    existing.push(registry);
    registriesByResourceKey.set(registry.resourceKey, existing);
  }

  for (const resource of resources) {
    const resourceKey = buildResourceKey(resource);
    const matchingRegistries = registriesByResourceKey.get(resourceKey) ?? [];

    if (tracking?.onboardingId && matchingRegistries.length === 0) {
      continue;
    }

    const platformRegistry = matchingRegistries.find((registry) => registry.source === "PLATFORM");
    const selectedRegistry = platformRegistry ?? matchingRegistries[0];

    metadataByResourceKey.set(resourceKey, {
      configId: selectedRegistry?._id?.toString(),
      source: platformRegistry ? "PLATFORM" : "DIRECT_MANAGEMENT_API",
      onboardingId: selectedRegistry?.onboardingId ?? tracking?.onboardingId,
      microserviceId: selectedRegistry?.microserviceId ?? tracking?.microserviceId,
    });
  }

  return metadataByResourceKey;
}
