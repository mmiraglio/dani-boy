# AGENTS.md

## Overview

- Package manager: `pnpm` (`packageManager: pnpm@10.32.1`)
- Workspace apps:
  - `apps/api`: Fastify backend
  - `apps/web`: React + Vite frontend

## Setup

```bash
pnpm install
cp .env.example .env
```

## Common Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm start
```

## App-Specific Commands

```bash
pnpm --filter @dani-boy/api dev
pnpm --filter @dani-boy/api start
pnpm --filter @dani-boy/api test
pnpm --filter @dani-boy/web dev
pnpm --filter @dani-boy/web build
pnpm --filter @dani-boy/web preview
```

## Repo Workflows

- `pnpm dev` starts both workspace apps in parallel.
- The Vite dev server runs on `http://localhost:5173` and proxies `/api` requests to `http://localhost:3000`.
- `pnpm start` starts only the API app. For a production-style local run, build the frontend first with `pnpm build`.
- API tests run with `node --test` through `pnpm --filter @dani-boy/api test` and use fixture files under `apps/api/test/fixtures/web-dist` for SPA static-file coverage.
- Docker production flow is `docker compose up --build -d`; the image builds the web app and serves the built `apps/web/dist` assets from the API container.
