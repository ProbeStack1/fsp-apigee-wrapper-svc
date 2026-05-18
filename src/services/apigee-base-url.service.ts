import type { Request } from "express";

const DEFAULT_APIGEE_BASE_URL = "https://apigee.googleapis.com/v1";

function normalizeBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_APIGEE_BASE_URL;
  return candidate.replace(/\/+$/, "");
}

export function getApigeeBaseUrl(_request?: Request): string {
  return normalizeBaseUrl(process.env.APIGEE_BASE_URL);
}

export function encodePathParam(value: string | string[] | undefined): string {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return encodeURIComponent(normalizedValue ?? "");
}
