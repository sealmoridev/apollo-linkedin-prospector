# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev:server       # Run Express server with hot-reload (tsx watch)
npm run dev              # Run index.ts standalone script in watch mode

# Build & Production
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled server (node dist/server.js)

# Testing
npm test                 # Run Jest tests
npm run test:watch       # Jest in watch mode

# Manual enrichment tests (require .env)
npm run enrich           # Test single profile (src/test-single.ts)
npm run enrich:batch     # Test batch enrichment (src/test-batch.ts)
```

There is no ESLint configured. TypeScript strict mode is enabled (`tsconfig.json`).

## Architecture Overview

**MrProspect** is a multi-tenant LinkedIn prospecting tool for SDRs. It has three main components:

### 1. Backend (`src/`)

Express.js + TypeScript server deployed on Railway.app.

**Request flow for enrichment:**
1. Chrome extension sends `POST /api/enrich` with `x-api-key` (tenant key), `x-google-id`, and `x-google-email` headers
2. `tenantAuthMiddleware` (`src/middlewares/tenant-auth.ts`) looks up the `Empresa` by `tenant_api_key`, then finds/creates the `ExtensionUser` — no explicit registration needed
3. `EnrichmentService` (`src/services/enrichment-service.ts`) validates the LinkedIn URL and calls `ApolloClient`
4. If `includePhone: true`, `WebhookServer` is set up to receive Apollo's async callback
5. Results are returned to the extension

**Key services:**
- `src/services/apollo-client.ts` — HTTP client to Apollo.io API; handles sync/async (webhook) enrichment modes
- `src/services/enrichment-service.ts` — Orchestrates enrichment: validates URLs, calls Apollo, returns typed `EnrichedLead` objects
- `src/services/sheets-service.ts` — Google Sheets integration; uses OAuth tokens from `TokenStorage` to create/append leads
- `src/services/token-storage.ts` — Persists Google OAuth tokens to `google-tokens.json` on disk (file-based, legacy)
- `src/services/million-verify-service.ts` — Email validation via MillionVerify API
- `src/services/webhook-server.ts` — EventEmitter-based server to receive Apollo async phone data

**Auth layers:**
- **Extension/Tenant auth** (`src/middlewares/tenant-auth.ts`): `x-api-key` header → lookup `Empresa` in DB → inject `req.tenant` and `req.extensionUser`
- **Admin auth** (`src/middlewares/admin-auth.ts`): `Authorization: Bearer <JWT>` → verify with `JWT_SECRET` → roles: `SUPERADMIN` (global) or `ADMIN` (company-scoped)

**Admin routes** (`src/routes/admin.ts`): mounted at `/api/admin`. Public: `/setup`, `/login`. Protected: `/me`, `/consumos`, `/empresas`, `/users`, `/api-keys`, etc.

### 2. Database (`prisma/`)

PostgreSQL via Prisma ORM with PG adapter (direct pool, no proxy).

Key models:
- `Empresa` — tenant company; holds `tenant_api_key`, `apollo_api_key`, `millionverifier_api_key`
- `ExtensionUser` — SDR identified by Google Auth ID; linked to an `Empresa`
- `AdminUser` — backoffice admin with role `SUPERADMIN` or `ADMIN`
- `Consumo` — credit usage log per user/company for Apollo and MillionVerify

### 3. Chrome Extension (`chrome-extension/`)

Manifest v3 extension. Runs on `https://*.linkedin.com/*`.

- `content.js` — Injects a collapsible widget panel on LinkedIn profile pages. Calls `/api/enrich` and `/api/sheets/save`. Stores user ID as `user_XXXXXXXXX` in Chrome local storage.
- `background.js` — Service worker; handles options page opening
- `options.html/js` — Settings page for Google OAuth connection and spreadsheet selection

The extension authenticates via the **tenant's `x-api-key`** (hardcoded in the extension options). The SDR's identity is tied to their Google identity (`x-google-id`).

### 4. Backoffice (`backoffice/`)

React/Vite SPA served from `npm run build` in `backoffice/`. Uses Shadcn/ui with dark theme, TanStack Query, React Router v6, Recharts. Served statically at `/admin` by Express. Vite is configured with `base: '/admin/'` and proxies `/admin/api` to `localhost:3000`.

## Environment Variables

See `.env.example`. Key vars:
- `DATABASE_URL` — PostgreSQL connection string (Prisma)
- `JWT_SECRET` — Admin backoffice JWT signing key
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth for Sheets
- `RAILWAY_PUBLIC_DOMAIN` — Auto-set by Railway; used to construct webhook URL
- `APOLLO_API_KEY` — Default Apollo key (overridden per-tenant from DB)

## Deployment

Railway.app. Build command: `npm run build`. Start: `npm start`. The `Procfile` and `railway.json` handle this. Persistent volume at `/app/data` stores `google-tokens.json`.
