# Apigee Wrapper Backend

Static Express backend for Apigee X management APIs, matching the structure used by `kong-wrapper`.

## Structure

- `src/routes/`
  - folder-wise route files with explicit endpoints
- `src/controllers/`
  - shared wrapper controller
- `src/services/`
  - folder-wise endpoint definitions
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
APIGEE_ACCESS_TOKEN=
```

If the browser sends an `Authorization` header, that token is forwarded to Apigee. Otherwise, the wrapper uses `APIGEE_ACCESS_TOKEN`.
