import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { encodePathParam, getApigeeBaseUrl } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const keysPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/developers/${encodePathParam(request.params.developer)}` +
  `/apps/${encodePathParam(request.params.app)}/keys`;

const keyPath = (request: Request) =>
  `${keysPath(request)}/${encodePathParam(request.params.consumerKey)}`;

const apiProductPath = (request: Request) =>
  `${keyPath(request)}/apiProducts/${encodePathParam(request.params.productName)}`;

export const appCredentialsEndpoints = {
  createKey: async (request: Request) => {
    const response = await apiClient.post(keysPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  attachProducts: async (request: Request) => {
    const response = await apiClient.post(keyPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  replaceProducts: async (request: Request) => {
    const response = await apiClient.put(keyPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  updateProducts: async (request: Request) => {
    const response = await apiClient.patch(keyPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  rotateKey: async (request: Request) => {
    const response = await apiClient.post(
      `${keyPath(request)}/rotate`,
      getForwardBody(request),
      getRequestConfig(request),
    );
    return response.data;
  },

  approveProduct: async (request: Request) => {
    const response = await apiClient.post(apiProductPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  revokeProduct: async (request: Request) => {
    const response = await apiClient.delete(apiProductPath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },
};
