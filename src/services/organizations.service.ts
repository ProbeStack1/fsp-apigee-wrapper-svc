import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getRequestConfig } from "./request-utils.service";

export const organizationsEndpoints = {
  listOrganizations: async (request: Request) => {
    const response = await apiClient.get(`${getApigeeBaseUrl(request)}/organizations`, getRequestConfig(request));
    return response.data;
  },

  listEnvironments: async (request: Request) => {
    const response = await apiClient.get(
      `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/environments`,
      getRequestConfig(request),
    );
    return response.data;
  },
};
