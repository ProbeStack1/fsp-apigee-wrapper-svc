import type { AxiosRequestConfig } from "axios";
import type { Request } from "express";

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
]);

export function getBody(request: Request, fallback?: unknown): unknown {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
}

export function getForwardBody(request: Request, fallback?: unknown): unknown {
  const body = getBody(request);
  if (body !== undefined) {
    return body;
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
    if (HOP_BY_HOP_HEADERS.has(lowerName)) {
      continue;
    }

    if (typeof value === "string") {
      headers[name] = value;
    }
  }

  return {
    params: request.query,
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  };
}
