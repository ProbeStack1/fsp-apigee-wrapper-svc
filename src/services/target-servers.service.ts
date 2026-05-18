import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const targetServersPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/environments/${encodePathParam(request.params.env)}/targetservers`;

const targetServerPath = (request: Request) =>
  `${targetServersPath(request)}/${encodePathParam(request.params.name)}`;

export const targetServersEndpoints = {
  listTargetServers: async (request: Request) => {
    const response = await apiClient.get(targetServersPath(request), getRequestConfig(request));
    return response.data;
  },

  getTargetServer: async (request: Request) => {
    const response = await apiClient.get(targetServerPath(request), getRequestConfig(request));
    return response.data;
  },

  createTargetServer: async (request: Request) => {
    const response = await apiClient.post(targetServersPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  updateTargetServer: async (request: Request) => {
    const response = await apiClient.put(targetServerPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  deleteTargetServer: async (request: Request) => {
    const response = await apiClient.delete(targetServerPath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },
};
