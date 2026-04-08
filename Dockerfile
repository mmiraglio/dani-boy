FROM node:25-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PNPM_VERSION="10.32.1"

RUN npm install -g "pnpm@${PNPM_VERSION}"

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY . .

RUN pnpm build

FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8001

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --prod --frozen-lockfile

COPY apps/api apps/api
COPY --from=build /app/apps/web/dist apps/web/dist

EXPOSE 8001

CMD ["pnpm", "start"]
