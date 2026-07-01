import type { EndpointHandler } from "./endpoint.types";
import { generateGoogleAccessToken } from "./google-service-account-token.service";

function shouldForceRefresh(value: unknown): boolean {
  if (Array.isArray(value)) {
    return shouldForceRefresh(value[0]);
  }

  return typeof value === "string" && ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

export const authEndpoints: Record<string, EndpointHandler> = {
  async getApigeeAccessToken(request) {
    return generateGoogleAccessToken(shouldForceRefresh(request.query.forceRefresh));
  },
};
