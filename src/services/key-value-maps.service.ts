import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const kvmsPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}` +
  `/environments/${encodePathParam(request.params.env)}/keyvaluemaps`;

const kvmPath = (request: Request) =>
  `${kvmsPath(request)}/${encodePathParam(request.params.kvm)}`;

const entriesPath = (request: Request) =>
  `${kvmPath(request)}/entries`;

const entryPath = (request: Request) =>
  `${entriesPath(request)}/${encodePathParam(request.params.entry)}`;

export const keyValueMapsEndpoints = {
  listKvms: async (request: Request) => {
    const response = await apiClient.get(kvmsPath(request), getRequestConfig(request));
    return response.data;
  },

  getKvm: async (request: Request) => {
    const response = await apiClient.get(kvmPath(request), getRequestConfig(request));
    return response.data;
  },

  createKvm: async (request: Request) => {
    const response = await apiClient.post(kvmsPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  updateKvm: async (request: Request) => {
    const response = await apiClient.put(kvmPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  deleteKvm: async (request: Request) => {
    const response = await apiClient.delete(kvmPath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },

  listEntries: async (request: Request) => {
    const response = await apiClient.get(entriesPath(request), getRequestConfig(request));
    return response.data;
  },

  getEntry: async (request: Request) => {
    const response = await apiClient.get(entryPath(request), getRequestConfig(request));
    return response.data;
  },

  createEntry: async (request: Request) => {
    const response = await apiClient.post(entriesPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  updateEntry: async (request: Request) => {
    const response = await apiClient.put(entryPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  deleteEntry: async (request: Request) => {
    const response = await apiClient.delete(entryPath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },
};
