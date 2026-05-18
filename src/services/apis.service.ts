import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const apisBasePath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/apis`;

export const apisEndpoints = {
  listApis: async (request: Request) => {
    const response = await apiClient.get(apisBasePath(request), getRequestConfig(request));
    return response.data;
  },

  importApi: async (request: Request) => {
    const response = await apiClient.post(
      apisBasePath(request),
      getForwardBody(request),
      getRequestConfig(request),
    );
    return response.data;
  },
};
