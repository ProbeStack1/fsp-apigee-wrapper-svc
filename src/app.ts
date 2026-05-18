import express, { type Express } from "express";

import { createApiProductsRouter } from "./routes/api-products.routes";
import { createApisRouter } from "./routes/apis.routes";
import { createAppCredentialsRouter } from "./routes/app-credentials.routes";
import { createAppsRouter } from "./routes/apps.routes";
import { createDevelopersRouter } from "./routes/developers.routes";
import { createKeyValueMapsRouter } from "./routes/key-value-maps.routes";
import { createOrganizationsRouter } from "./routes/organizations.routes";
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

function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAllowedOrigin(requestOrigin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === requestOrigin) {
      return true;
    }

    if (!allowedOrigin.includes("*")) {
      return false;
    }

    const pattern = `^${escapeRegex(allowedOrigin).replace(/\\\*/g, ".*")}$`;
    return new RegExp(pattern).test(requestOrigin);
  });
}

function getAllowedRequestHeaders(request: express.Request): string {
  const defaultHeaders = [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Apigee-Token",
    "X-Partner-Id",
  ];

  const requestedHeaders = (request.header("Access-Control-Request-Headers") ?? "")
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean);

  return [...new Set([...defaultHeaders, ...requestedHeaders])].join(", ");
}

export function buildApp(): Express {
  const app = express();
  const contextPath = normalizeContextPath(process.env.CONTEXT_PATH);
  const allowedOrigins = getAllowedOrigins();
  const api = express.Router();

  app.use((request, response, next) => {
    const requestOrigin = request.headers.origin;

    if (requestOrigin && matchesAllowedOrigin(requestOrigin, allowedOrigins)) {
      response.header("Access-Control-Allow-Origin", requestOrigin);
      response.header("Vary", "Origin");
    }

    response.header("Access-Control-Allow-Headers", getAllowedRequestHeaders(request));
    response.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  api.get("/health", (_request, response) => {
    response.status(200).json({
      status: "UP",
      contextPath,
    });
  });

  api.use(createOrganizationsRouter());
  api.use(createApisRouter());
  api.use(createDevelopersRouter());
  api.use(createTargetServersRouter());
  api.use(createKeyValueMapsRouter());
  api.use(createApiProductsRouter());
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
