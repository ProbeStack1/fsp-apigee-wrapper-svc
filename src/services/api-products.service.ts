import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { getApigeeBaseUrl, encodePathParam } from "./apigee-base-url.service";
import { getForwardBody, getRequestConfig } from "./request-utils.service";

const productsPath = (request: Request) =>
  `${getApigeeBaseUrl(request)}/organizations/${encodePathParam(request.params.org)}/apiproducts`;

const productPath = (request: Request) =>
  `${productsPath(request)}/${encodePathParam(request.params.name)}`;

export const apiProductsEndpoints = {
  listProducts: async (request: Request) => {
    const response = await apiClient.get(productsPath(request), getRequestConfig(request));
    return response.data;
  },

  getProduct: async (request: Request) => {
    const response = await apiClient.get(productPath(request), getRequestConfig(request));
    return response.data;
  },

  createProduct: async (request: Request) => {
    const response = await apiClient.post(productsPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  updateProduct: async (request: Request) => {
    const response = await apiClient.put(productPath(request), getForwardBody(request), getRequestConfig(request));
    return response.data;
  },

  deleteProduct: async (request: Request) => {
    const response = await apiClient.delete(productPath(request), getRequestConfig(request));
    return response.data ?? { success: true };
  },
};
