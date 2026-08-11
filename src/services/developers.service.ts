import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { executeTrackedMutation, getResourceAudit } from "./config-tracking.service";
import { encodePathParam, getApigeeBaseUrl } from "./apigee-base-url.service";
import { getBody, getForwardBody, getRequestConfig } from "./request-utils.service";

const developersPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/developers`;
const developerPath = (request: Request) => `${developersPath(request)}/${encodePathParam(request.params.developer)}`;
const bodyEmail = (request: Request) => {
  const body = getBody(request) as Record<string, unknown> | undefined;
  return typeof body?.email === "string" && body.email.trim() ? body.email.trim() : "unknown";
};

export const developersEndpoints = {
  listDevelopers: async (request: Request) => {
    const response = await apiClient.get(developersPath(request), getRequestConfig(request));
    return response.data;
  },

  getDeveloper: async (request: Request) => {
    const response = await apiClient.get(developerPath(request), getRequestConfig(request));
    const name = String(request.params.developer);
    const audit = await getResourceAudit(request, { configType: "DEVELOPER", org: String(request.params.org), name });
    const developer = response.data as Record<string, unknown>;
    return {
      ...developer,
      audit: {
        ...audit,
        registry: {
          ...(audit.registry ?? {}),
          createdBy: audit.registry?.createdBy ?? developer.createdBy,
          createdAt: audit.registry?.createdAt ?? developer.createdAt,
          updatedBy: audit.registry?.updatedBy ?? developer.lastModifiedBy ?? developer.updatedBy,
          updatedAt: audit.registry?.updatedAt ?? developer.lastModifiedAt,
          source: audit.registry?.source ?? "DIRECT_MANAGEMENT_API",
          status: audit.registry?.status ?? "ACTIVE",
        },
      },
    };
  },

  createDeveloper: async (request: Request) => executeTrackedMutation({
    request,
    configType: "DEVELOPER",
    operation: "CREATE",
    org: String(request.params.org),
    name: bodyEmail(request),
    resourceUrl: `${developersPath(request)}/${encodePathParam(bodyEmail(request))}`,
    requestConfig: getRequestConfig(request),
    execute: async () => (await apiClient.post(developersPath(request), getForwardBody(request), getRequestConfig(request))).data,
  }),

  updateDeveloper: async (request: Request) => executeTrackedMutation({
    request,
    configType: "DEVELOPER",
    operation: "UPDATE",
    org: String(request.params.org),
    name: String(request.params.developer),
    resourceUrl: developerPath(request),
    requestConfig: getRequestConfig(request),
    execute: async () => (await apiClient.put(developerPath(request), getForwardBody(request), getRequestConfig(request))).data,
  }),

  deleteDeveloper: async (request: Request) => executeTrackedMutation({
    request,
    configType: "DEVELOPER",
    operation: "DELETE",
    org: String(request.params.org),
    name: String(request.params.developer),
    resourceUrl: developerPath(request),
    requestConfig: getRequestConfig(request),
    execute: async () => (await apiClient.delete(developerPath(request), getRequestConfig(request))).data ?? { success: true },
  }),
};
