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

## Tracked Config Operations

Create, update, and delete operations for target servers, KVMs/KVM entries, API products, and developer apps require an `onboardingId`.
`microserviceId` is accepted but optional.

Tracking metadata can be sent in any of these places:

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
