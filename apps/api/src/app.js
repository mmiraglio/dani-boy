import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import {
  isPassphraseValid,
  readAccessSession,
  requireAuthenticatedSession,
  setAccessCookie
} from "./auth.js";
import { createChatResponder, sanitizeHistory } from "./openai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_DIR = path.resolve(__dirname, "../../web/dist");
const DEFAULT_ASSETS_DIR = path.resolve(DEFAULT_STATIC_DIR, "assets");
const MAX_MESSAGE_LENGTH = 1000;

const accessSchema = {
  body: {
    additionalProperties: false,
    properties: {
      passphrase: {
        type: "string",
        minLength: 1,
        maxLength: 64
      }
    },
    required: ["passphrase"],
    type: "object"
  }
};

const chatSchema = {
  body: {
    additionalProperties: false,
    properties: {
      history: {
        default: [],
        items: {
          additionalProperties: false,
          properties: {
            content: {
              type: "string",
              minLength: 1,
              maxLength: MAX_MESSAGE_LENGTH
            },
            role: {
              enum: ["user", "assistant"],
              type: "string"
            }
          },
          required: ["role", "content"],
          type: "object"
        },
        maxItems: 20,
        type: "array"
      },
      message: {
        type: "string",
        minLength: 1,
        maxLength: MAX_MESSAGE_LENGTH
      }
    },
    required: ["message"],
    type: "object"
  }
};

export async function buildServer({
  config,
  logger = false,
  responder,
  staticDir = DEFAULT_STATIC_DIR
}) {
  const app = Fastify({
    logger,
    trustProxy: true
  });

  await app.register(fastifyCookie, {
    hook: "onRequest",
    secret: config.sessionSecret
  });

  await app.register(fastifyRateLimit, {
    global: false
  });

  const chatResponder = responder || createChatResponder(config);
  const hasStaticAssets = existsSync(staticDir);
  const assetsDir = path.resolve(staticDir, "assets");

  if (hasStaticAssets) {
    await app.register(fastifyStatic, {
      prefix: "/assets/",
      root: existsSync(assetsDir) ? assetsDir : DEFAULT_ASSETS_DIR
    });
  }

  app.get("/api/health", async function healthHandler() {
    return { status: "ok" };
  });

  app.get(
    "/api/session",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute"
        }
      }
    },
    async function sessionHandler(request, reply) {
      if (!readAccessSession(request)) {
        return reply.code(401).send({
          authenticated: false
        });
      }

      return {
        authenticated: true
      };
    }
  );

  app.post(
    "/api/access",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute"
        }
      },
      schema: accessSchema
    },
    async function accessHandler(request, reply) {
      const { passphrase } = request.body;

      if (!isPassphraseValid(passphrase, config.appAccessCode)) {
        return reply.code(401).send({
          message: "Palavra-chave incorreta."
        });
      }

      setAccessCookie(reply, config);
      return reply.code(204).send();
    }
  );

  app.post(
    "/api/chat",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      },
      preHandler: requireAuthenticatedSession,
      schema: chatSchema
    },
    async function chatHandler(request, reply) {
      const message = request.body.message.trim();
      const history = sanitizeHistory(request.body.history);

      try {
        const assistantReply = await chatResponder({ history, message });
        return {
          reply: assistantReply
        };
      } catch (error) {
        request.log.error({ err: error }, "chat_request_failed");

        const statusCode = error.statusCode || 500;
        const message =
          statusCode === 503
            ? error.message
            : "Nao consegui responder agora. Tente novamente em instantes.";

        return reply.code(statusCode).send({ message });
      }
    }
  );

  if (hasStaticAssets) {
    app.get("/", async function rootDocumentHandler(request, reply) {
      return reply.sendFile("index.html", staticDir);
    });

    app.get("/*", async function spaFallbackHandler(request, reply) {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({
          message: "Rota nao encontrada."
        });
      }

      if (request.url.startsWith("/assets/")) {
        return reply.code(404).send({
          message: "Arquivo nao encontrado."
        });
      }

      return reply.sendFile("index.html", staticDir);
    });
  }

  return app;
}
