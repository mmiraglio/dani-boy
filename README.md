# Dani Boy

SPA para um chat de matematica voltado a alunos do quinto ano do ensino fundamental. O acesso inicial e protegido por uma palavra-chave simples da turma e o backend usa Ollama Cloud como provedor principal, com OpenAI como fallback, para responder apenas perguntas de matematica.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Fastify + Responses API compativel com OpenAI
- Infra: Docker + docker-compose
- Qualidade: ESLint + testes de API com `node:test`

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste:

```bash
OLLAMA_API_KEY=your_ollama_api_key
OLLAMA_BASE_URL=https://ollama.com/v1
OLLAMA_MAX_TOKENS=1000
OLLAMA_MODEL=glm-4.7
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
DEBUG=false
APP_ACCESS_CODE=1510T
SESSION_SECRET=troque-esta-chave-por-uma-sequencia-grande
PORT=3000
APP_ORIGIN=https://seu-dominio
```

- `OLLAMA_API_KEY` habilita o provedor principal via Ollama Cloud.
- `OPENAI_API_KEY` e opcional e entra como fallback automatico se a chamada da Ollama falhar.
- `OLLAMA_MAX_TOKENS` controla o limite de saida da Ollama Cloud. O default foi ajustado para `1000` porque `glm-4.7` consumia os `350` tokens padrao apenas em raciocinio e devolvia resposta vazia.
- `OLLAMA_MODEL` pode ser trocado por qualquer modelo disponivel na biblioteca da Ollama: <https://ollama.com/search>.
- `DEBUG=true` mostra na tela a cadeia configurada de provedores e o modelo usado em cada resposta. Se ausente, o padrao e `false`.

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
