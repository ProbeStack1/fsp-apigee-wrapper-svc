import type { Request } from "express";

import { getResourceAudit, recordTrackedMutation, type ConfigOperation, type ConfigType } from "./config-tracking.service";

const supportedTypes = new Set<ConfigType>(["API_PRODUCT", "DEVELOPER_APP", "API", "SHARED_FLOW", "DEVELOPER"]);

export const configAuditEndpoints = {
  getAudit: async (request: Request) => {
    const configType = String(request.params.configType).toUpperCase() as ConfigType;
    if (!supportedTypes.has(configType)) {
      throw new Error(`Unsupported config type: ${request.params.configType}`);
    }

    return getResourceAudit(request, {
      configType,
      org: String(request.params.org),
      developerEmail: typeof request.query.developer === "string" ? request.query.developer : undefined,
      name: String(request.params.name),
    });
  },

  record: async (request: Request) => {
    const configType = String(request.params.configType).toUpperCase() as ConfigType;
    if (!supportedTypes.has(configType)) throw new Error(`Unsupported config type: ${request.params.configType}`);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const operation = String(body.operation ?? "CREATE").toUpperCase() as ConfigOperation;
    await recordTrackedMutation({
      request,
      identity: {
        configType,
        org: String(request.params.org),
        developerEmail: typeof request.query.developer === "string" ? request.query.developer : undefined,
        name: String(request.params.name),
      },
      operation,
      requestPayload: body.requestPayload,
      beforeSnapshot: body.beforeSnapshot,
      afterSnapshot: body.afterSnapshot,
      responsePayload: body.responsePayload,
    });
    return { success: true };
  },
};
