import type { AxiosRequestConfig } from "axios";
import type { Request } from "express";

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
]);

const TRACKING_HEADERS = new Set([
  "x-onboarding-id",
  "x-microservice-id",
  "x-user-id",
  "x-user-email",
  "x-created-by",
  "x-performed-by",
  "x-apigee-token",
]);

const TRACKING_QUERY_PARAMS = new Set([
  "onboardingId",
  "microserviceId",
  "performedBy",
  "createdBy",
  "updatedBy",
  "deletedBy",
]);

const TRACKING_BODY_FIELDS = new Set([
  "onboardingId",
  "microserviceId",
  "performedBy",
  "createdBy",
  "updatedBy",
  "deletedBy",
  "tracking",
  "_tracking",
]);

export function getBody(request: Request, fallback?: unknown): unknown {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
}

export function stripTrackingMetadataFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body) || Buffer.isBuffer(body)) {
    return body;
  }

  const sanitizedBody: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!TRACKING_BODY_FIELDS.has(key)) {
      sanitizedBody[key] = value;
    }
  }

  return sanitizedBody;
}

export function getForwardBody(request: Request, fallback?: unknown): unknown {
  const body = getBody(request);
  if (body !== undefined) {
    return stripTrackingMetadataFromBody(body);
  }

  if (request.readable) {
    return request;
  }

  return fallback;
}

export function getRequestConfig(request: Request): AxiosRequestConfig {
  const headers: Record<string, string> = {};

  for (const [name, value] of Object.entries(request.headers)) {
    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName) || TRACKING_HEADERS.has(lowerName)) {
      continue;
    }

    if (typeof value === "string") {
      headers[name] = value;
    }
  }

  const apigeeTokenHeader = request.headers["x-apigee-token"];
  const apigeeToken = Array.isArray(apigeeTokenHeader) ? apigeeTokenHeader[0] : apigeeTokenHeader;
  if (apigeeToken?.trim()) {
    headers.Authorization = `Bearer ${apigeeToken.trim()}`;
  }

  const params: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(request.query)) {
    if (!TRACKING_QUERY_PARAMS.has(name)) {
      params[name] = value;
    }
  }

  return {
    params,
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  };
}
