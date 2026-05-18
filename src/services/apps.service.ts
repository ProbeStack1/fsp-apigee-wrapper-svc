import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const appsPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/developers/${encodePathParam(request.params.developer)}/apps`;

const appPath = (request: Request) =>
  `${appsPath(request)}/${encodePathParam(request.params.app)}`;

export const appsEndpoints = {
  listApps: async (request: Request) => {
    const response = await apiClient.get(appsPath(request), getRequestConfig(request));
    return response.data;
  },

  getApp: async (request: Request) => {
    const response = await apiClient.get(appPath(request), getRequestConfig(request));
    return response.data;
  },

  createApp: async (request: Request) => {
    const response = await apiClient.post(appsPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  updateApp: async (request: Request) => {
    const response = await apiClient.put(appPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  deleteApp: async (request: Request) => {
    const response = await apiClient.delete(appPath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },
};
