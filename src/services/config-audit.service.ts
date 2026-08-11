import type { Request } from "express";

import { getResourceAudit, type ConfigType } from "./config-tracking.service";

const supportedTypes = new Set<ConfigType>(["API_PRODUCT", "DEVELOPER_APP"]);

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
};
