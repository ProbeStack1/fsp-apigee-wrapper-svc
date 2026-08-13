import type { Request } from "express";

import { HttpError } from "../errors/http-error";

export type TrackingMetadata = {
  onboardingId: string;
  microserviceId?: string;
  createdBy: string;
  projectId?: string;
  projectName?: string;
  applicationId?: string;
  applicationName?: string;
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

  if (!createdBy) {
    throw new HttpError(400, "createdBy is required for tracked Apigee config operations");
  }

  const projectId =
    firstString(body?.projectId) ??
    firstString(tracking?.projectId) ??
    firstString(request.query.projectId) ??
    firstString(firstHeaderValue(request.headers["x-project-id"]));

  const projectName =
    firstString(body?.projectName) ??
    firstString(tracking?.projectName) ??
    firstString(request.query.projectName) ??
    firstString(firstHeaderValue(request.headers["x-project-name"]));

  const applicationId =
    firstString(body?.applicationId) ??
    firstString(tracking?.applicationId) ??
    firstString(request.query.applicationId) ??
    firstString(firstHeaderValue(request.headers["x-application-id"]));

  const applicationName =
    firstString(body?.applicationName) ??
    firstString(tracking?.applicationName) ??
    firstString(request.query.applicationName) ??
    firstString(firstHeaderValue(request.headers["x-application-name"]));

  return {
    onboardingId,
    microserviceId,
    createdBy,
    projectId,
    projectName,
    applicationId,
    applicationName,
  };
}
