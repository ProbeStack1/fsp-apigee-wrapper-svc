# Apigee Wrapper Backend

Static Express backend for Apigee X management APIs, matching the structure used by `kong-wrapper`.

## Structure

- `src/routes/`
  - folder-wise route files with explicit endpoints
- `src/controllers/`
  - shared wrapper controller
- `src/services/`
  - folder-wise endpoint definitions
- `src/models/`
  - MongoDB registry and history models for tracked Apigee configs
- `src/client/`
  - upstream HTTP client with retries

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Configuration

```bash
CONTEXT_PATH=/apigee-wrapper
APIGEE_BASE_URL=https://apigee.googleapis.com/v1
MONGODB_URI=mongodb://localhost:27017/forgesphere
MONGODB_DB_NAME=forgesphere
```

Pass the Apigee management API access token with `x-apigee-token`. The wrapper converts it to `Authorization: Bearer <token>` for Apigee and does not forward `x-apigee-token` upstream.

## Generate Apigee Access Token

Place the Google service account JSON key outside source control and configure its path:

```bash
APIGEE_SERVICE_ACCOUNT_KEY_PATH=gen-ai-poc-onboarding-18-may.json
APIGEE_AUTH_SCOPE=https://www.googleapis.com/auth/cloud-platform
```

Then call:

```text
GET /auth/apigee/token
```

The response contains `access_token`, `token_type`, `expires_in`, `expiry_date`, and `scope`. Tokens are cached in memory until shortly before expiry. Add `?forceRefresh=true` to force a new token.

For Docker deployments, mount the key into the container instead of copying it into the image:

```bash
docker run \
  -v /secure/path/gen-ai-poc-onboarding-18-may.json:/app/gen-ai-poc-onboarding-18-may.json:ro \
  -e APIGEE_SERVICE_ACCOUNT_KEY_PATH=/app/gen-ai-poc-onboarding-18-may.json \
  -p 3000:3000 \
  apigee-wrapper
```

## Tracked Config Operations

Create, update, and delete operations for target servers, KVMs/KVM entries, API products, and developer apps require an `onboardingId`.
`microserviceId` is accepted but optional.

Tracking metadata can be sent in any of these places :

```json
{
  "onboardingId": "required-on-mutations",
  "microserviceId": "optional",
  "createdBy": "user@example.com"
}
```

or through query parameters / headers:

```text
?onboardingId=...&microserviceId=...
x-onboarding-id: ...
x-microservice-id: ...
x-created-by: ...
```

The wrapper strips tracking metadata before forwarding requests to Apigee and records current state in `apigee_config_registry` plus immutable operation logs in `apigee_config_history`.
