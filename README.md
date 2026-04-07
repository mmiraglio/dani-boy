# Dani Boy

SPA para um chat de matematica voltado a alunos do quinto ano do ensino fundamental. O acesso inicial e protegido por uma palavra-chave simples da turma e o backend usa a API da OpenAI para responder apenas perguntas de matematica.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Fastify + OpenAI Responses API
- Infra: Docker + docker-compose
- Qualidade: ESLint + testes de API com `node:test`

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste:

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
APP_ACCESS_CODE=1510T
SESSION_SECRET=troque-esta-chave-por-uma-sequencia-grande
PORT=3000
APP_ORIGIN=https://seu-dominio
```

## Desenvolvimento local

```bash
pnpm install
pnpm dev
```

- Frontend Vite: `http://localhost:5173`
- API Fastify: `http://localhost:3000`

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm start
```

## APIs

- `POST /api/access`
- `GET /api/session`
- `POST /api/chat`
- `GET /api/health`

## Docker

```bash
docker compose up --build -d
```

No Portainer, basta apontar para este repositorio ou subir os arquivos com as variaveis corretas no stack.
