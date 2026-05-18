import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { encodePathParam, getApigeeBaseUrl } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const keystoresPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/environments/${encodePathParam(request.params.env)}/keystores`;

const keystorePath = (request: Request) =>
  `${keystoresPath(request)}/${encodePathParam(request.params.keystore)}`;

const aliasesPath = (request: Request) => `${keystorePath(request)}/aliases`;

const aliasPath = (request: Request) =>
  `${aliasesPath(request)}/${encodePathParam(request.params.alias)}`;

export const tlsKeystoresEndpoints = {
  listKeystores: async (request: Request) => {
    const response = await apiClient.get(keystoresPath(request), getRequestConfig(request));
    return response.data;
  },

  getKeystore: async (request: Request) => {
    const response = await apiClient.get(keystorePath(request), getRequestConfig(request));
    return response.data;
  },

  createKeystore: async (request: Request) => {
    const response = await apiClient.post(keystoresPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  deleteKeystore: async (request: Request) => {
    const response = await apiClient.delete(keystorePath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },

  listAliases: async (request: Request) => {
    const response = await apiClient.get(aliasesPath(request), getRequestConfig(request));
    return response.data;
  },

  getAlias: async (request: Request) => {
    const response = await apiClient.get(aliasPath(request), getRequestConfig(request));
    return response.data;
  },

  createAlias: async (request: Request) => {
    const response = await apiClient.post(aliasesPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  deleteAlias: async (request: Request) => {
    const response = await apiClient.delete(aliasPath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },
};
