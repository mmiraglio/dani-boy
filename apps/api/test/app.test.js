import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildServer } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureStaticDir = path.join(__dirname, "fixtures/web-dist");

function createConfig() {
  return {
    appAccessCode: "1510T",
    appOrigin: "",
    debugEnabled: false,
    isProduction: false,
    nodeEnv: "test",
    ollamaApiKey: "",
    ollamaBaseUrl: "https://ollama.com/v1",
    ollamaMaxTokens: 1000,
    ollamaModel: "glm-4.7",
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    port: 3000,
    sessionSecret: "test-session-secret"
  };
}

test("POST /api/access libera a sessao com a palavra-chave correta", async () => {
  const app = await buildServer({
    config: createConfig(),
    responder: async () => "4"
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/access",
    payload: {
      passphrase: "1510T"
    }
  });

  assert.equal(response.statusCode, 204);
  assert.match(
    response.headers["set-cookie"] || "",
    /dani_boy_session=.*HttpOnly/i
  );

  await app.close();
});

test("POST /api/access rejeita a palavra-chave incorreta", async () => {
  const app = await buildServer({
    config: createConfig(),
    responder: async () => "4"
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/access",
    payload: {
      passphrase: "0000"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, "Palavra-chave incorreta.");

  await app.close();
});

test("GET /api/session retorna 401 sem cookie valido", async () => {
  const app = await buildServer({
    config: createConfig(),
    responder: async () => "4"
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/session"
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    authenticated: false
  });

  await app.close();
});

test("GET /api/session inclui debug quando o modo debug esta ativo", async () => {
  const app = await buildServer({
    config: {
      ...createConfig(),
      debugEnabled: true,
      ollamaApiKey: "ollama-key",
      openaiApiKey: "openai-key"
    },
    responder: async () => "4"
  });

  const accessResponse = await app.inject({
    method: "POST",
    url: "/api/access",
    payload: {
      passphrase: "1510T"
    }
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/session",
    headers: {
      cookie: accessResponse.headers["set-cookie"].split(";")[0]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    authenticated: true,
    debug: {
      enabled: true,
      providers: [
        { provider: "ollama", model: "glm-4.7" },
        { provider: "openai", model: "gpt-4o-mini" }
      ]
    }
  });

  await app.close();
});

test("POST /api/chat exige sessao autenticada", async () => {
  const app = await buildServer({
    config: createConfig(),
    responder: async () => "4"
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/chat",
    payload: {
      message: "Quanto e 2 + 2?",
      history: []
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, "Sessao invalida ou expirada.");

  await app.close();
});

test("POST /api/chat responde quando a sessao esta autenticada", async () => {
  let capturedPayload = null;

  const app = await buildServer({
    config: createConfig(),
    responder: async (payload) => {
      capturedPayload = payload;
      return "2 + 2 = 4.";
    }
  });

  const accessResponse = await app.inject({
    method: "POST",
    url: "/api/access",
    payload: {
      passphrase: "1510T"
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/chat",
    headers: {
      cookie: accessResponse.headers["set-cookie"].split(";")[0]
    },
    payload: {
      message: "Quanto e 2 + 2?",
      history: [
        { role: "assistant", content: "Oi!" },
        { role: "user", content: "Quanto e 1 + 1?" },
        { role: "assistant", content: "1 + 1 = 2." }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().reply, "2 + 2 = 4.");
  assert.equal(capturedPayload.message, "Quanto e 2 + 2?");
  assert.equal(capturedPayload.history.length, 3);

  await app.close();
});

test("POST /api/chat inclui metadados de debug quando habilitado", async () => {
  const app = await buildServer({
    config: {
      ...createConfig(),
      debugEnabled: true
    },
    responder: async () => ({
      reply: "2 + 2 = 4.",
      debug: {
        provider: "ollama",
        model: "glm-4.7"
      }
    })
  });

  const accessResponse = await app.inject({
    method: "POST",
    url: "/api/access",
    payload: {
      passphrase: "1510T"
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/chat",
    headers: {
      cookie: accessResponse.headers["set-cookie"].split(";")[0]
    },
    payload: {
      message: "Quanto e 2 + 2?",
      history: []
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    reply: "2 + 2 = 4.",
    debug: {
      provider: "ollama",
      model: "glm-4.7"
    }
  });

  await app.close();
});

test("servidor entrega index e assets da SPA buildada", async () => {
  const app = await buildServer({
    config: createConfig(),
    responder: async () => "4",
    staticDir: fixtureStaticDir
  });

  const documentResponse = await app.inject({
    method: "GET",
    url: "/"
  });

  const assetResponse = await app.inject({
    method: "GET",
    url: "/assets/app.js"
  });

  const routeFallbackResponse = await app.inject({
    method: "GET",
    url: "/qualquer-rota"
  });

  assert.equal(documentResponse.statusCode, 200);
  assert.match(documentResponse.body, /Dani Boy Fixture/);
  assert.equal(assetResponse.statusCode, 200);
  assert.match(assetResponse.body, /fixture asset loaded/);
  assert.equal(routeFallbackResponse.statusCode, 200);
  assert.match(routeFallbackResponse.body, /Dani Boy Fixture/);

  await app.close();
});
