import type { Request } from "express";

import { HttpError } from "../errors/http-error";

export type TrackingMetadata = {
  onboardingId: string;
  microserviceId?: string;
  createdBy?: string;
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return firstString(value[0]);
  }

  return undefined;
}

export function readTrackingMetadata(request: Request, requireOnboardingId = true): TrackingMetadata | null {
  const body = request.body as Record<string, unknown> | undefined;
  const tracking = body?.tracking as Record<string, unknown> | undefined;

  const onboardingId =
    firstString(body?.onboardingId) ??
    firstString(tracking?.onboardingId) ??
    firstString(request.query.onboardingId) ??
    firstString(firstHeaderValue(request.headers["x-onboarding-id"]));

  if (!onboardingId) {
    if (requireOnboardingId) {
      throw new HttpError(400, "onboardingId is required for tracked Apigee config operations");
    }

    return null;
  }

  const microserviceId =
    firstString(body?.microserviceId) ??
    firstString(tracking?.microserviceId) ??
    firstString(request.query.microserviceId) ??
    firstString(firstHeaderValue(request.headers["x-microservice-id"]));

  const createdBy =
    firstString(body?.createdBy) ??
    firstString(body?.performedBy) ??
    firstString(body?.updatedBy) ??
    firstString(body?.deletedBy) ??
    firstString(tracking?.createdBy) ??
    firstString(tracking?.performedBy) ??
    firstString(request.query.createdBy) ??
    firstString(request.query.performedBy) ??
    firstString(firstHeaderValue(request.headers["x-created-by"])) ??
    firstString(firstHeaderValue(request.headers["x-performed-by"])) ??
    firstString(firstHeaderValue(request.headers["x-user-email"])) ??
    firstString(firstHeaderValue(request.headers["x-user-id"]));

  return {
    onboardingId,
    microserviceId,
    createdBy,
  };
}
