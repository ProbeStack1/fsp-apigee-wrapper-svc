import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { apiClient } from "../client/api-client";
import { HttpError } from "../errors/http-error";

const DEFAULT_KEY_FILE = "gen-ai-poc-onboarding-18-may.json";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

export type AccessTokenResult = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expiry_date: string;
  scope: string;
};

let cachedToken: (AccessTokenResult & { expiresAtMs: number; cacheKey: string }) | undefined;

function getScope(): string {
  return process.env.APIGEE_AUTH_SCOPE?.trim() || DEFAULT_SCOPE;
}

function getServiceAccountKeyPath(): string {
  const configuredPath =
    process.env.APIGEE_SERVICE_ACCOUNT_KEY_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    DEFAULT_KEY_FILE;

  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
}

async function readServiceAccountKey(): Promise<ServiceAccountKey> {
  const keyPath = getServiceAccountKeyPath();

  try {
    const rawKey = await fs.readFile(keyPath, "utf8");
    const parsedKey = JSON.parse(rawKey) as Partial<ServiceAccountKey>;

    if (!parsedKey.client_email || !parsedKey.private_key) {
      throw new HttpError(500, "Google service account key is missing client_email or private_key");
    }

    return {
      client_email: parsedKey.client_email,
      private_key: parsedKey.private_key,
      token_uri: parsedKey.token_uri,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(500, `Unable to read Google service account key at ${keyPath}`);
  }
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function createJwtAssertion(serviceAccountKey: ServiceAccountKey, tokenUri: string, scope: string): string {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + 3600;
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claimSet = {
    iss: serviceAccountKey.client_email,
    scope,
    aud: tokenUri,
    exp: expiresAtSeconds,
    iat: issuedAtSeconds,
  };

  const unsignedToken = [
    toBase64Url(JSON.stringify(header)),
    toBase64Url(JSON.stringify(claimSet)),
  ].join(".");

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${toBase64Url(signer.sign(serviceAccountKey.private_key))}`;
}

export async function generateGoogleAccessToken(forceRefresh = false): Promise<AccessTokenResult> {
  const nowMs = Date.now();
  const scope = getScope();
  const keyPath = getServiceAccountKeyPath();
  const cacheKey = `${keyPath}:${scope}`;

  if (
    !forceRefresh &&
    cachedToken?.cacheKey === cacheKey &&
    cachedToken.expiresAtMs - TOKEN_REFRESH_BUFFER_MS > nowMs
  ) {
    const expiresIn = Math.max(0, Math.floor((cachedToken.expiresAtMs - nowMs) / 1000));
    return {
      access_token: cachedToken.access_token,
      token_type: cachedToken.token_type,
      expires_in: expiresIn,
      expiry_date: cachedToken.expiry_date,
      scope: cachedToken.scope,
    };
  }

  const serviceAccountKey = await readServiceAccountKey();
  const tokenUri = serviceAccountKey.token_uri || "https://oauth2.googleapis.com/token";
  const assertion = createJwtAssertion(serviceAccountKey, tokenUri, scope);
  const formBody = new URLSearchParams({
    grant_type: JWT_GRANT_TYPE,
    assertion,
  });

  const response = await apiClient.post<GoogleTokenResponse>(tokenUri, formBody.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const expiresAtMs = nowMs + response.data.expires_in * 1000;
  const result: AccessTokenResult & { expiresAtMs: number; cacheKey: string } = {
    access_token: response.data.access_token,
    token_type: response.data.token_type,
    expires_in: response.data.expires_in,
    expiry_date: new Date(expiresAtMs).toISOString(),
    scope,
    expiresAtMs,
    cacheKey,
  };

  cachedToken = result;

  return {
    access_token: result.access_token,
    token_type: result.token_type,
    expires_in: result.expires_in,
    expiry_date: result.expiry_date,
    scope: result.scope,
  };
}
