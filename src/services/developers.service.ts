import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getRequestConfig } from "./request-utils.service";

export const developersEndpoints = {
  listDevelopers: async (request: Request) => {
    const response = await apiClient.get(
      `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/developers`,
      getRequestConfig(request),
    );
    return response.data;
  },
};
