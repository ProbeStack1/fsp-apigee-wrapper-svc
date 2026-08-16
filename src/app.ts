import express, { type Express } from "express";

import { createCorsMiddleware } from "./config/cors-config";
import { createApiProductsRouter } from "./routes/api-products.routes";
import { createConfigAuditRouter } from "./routes/config-audit.routes";
import { createApisRouter } from "./routes/apis.routes";
import { createAppCredentialsRouter } from "./routes/app-credentials.routes";
import { createAppsRouter } from "./routes/apps.routes";
import { createAuthRouter } from "./routes/auth.routes";
import { createDevelopersRouter } from "./routes/developers.routes";
import { createKeyValueMapsRouter } from "./routes/key-value-maps.routes";
import { createOrganizationsRouter } from "./routes/organizations.routes";
import { createSharedFlowsRouter } from "./routes/shared-flows.routes";
import { createTargetServersRouter } from "./routes/target-servers.routes";
import { createTlsKeystoresRouter } from "./routes/tls-keystores.routes";

function normalizeContextPath(value: string | undefined): string {
  if (!value || value === "/") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function buildApp(): Express {
  const app = express();
  const contextPath = normalizeContextPath(process.env.CONTEXT_PATH);
  const api = express.Router();

  app.use(createCorsMiddleware());

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  api.get("/health", (_request, response) => {
    response.status(200).json({
      status: "UP",
      contextPath,
    });
  });

  api.use(createOrganizationsRouter());
  api.use(createAuthRouter());
  api.use(createApisRouter());
  api.use(createSharedFlowsRouter());
  api.use(createDevelopersRouter());
  api.use(createTargetServersRouter());
  api.use(createKeyValueMapsRouter());
  api.use(createApiProductsRouter());
  api.use(createConfigAuditRouter());
  api.use(createAppsRouter());
  api.use(createAppCredentialsRouter());
  api.use(createTlsKeystoresRouter());

  app.use(contextPath || "/", api);

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        statusCode: 404,
        message: "Route not found",
      },
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      error: {
        statusCode: 500,
        message: error instanceof Error ? error.message : "Internal server error",
      },
    });
  });

  return app;
}
