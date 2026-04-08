import test from "node:test";
import assert from "node:assert/strict";
import { createChatResponder } from "../src/openai.js";

function createConfig(overrides = {}) {
  return {
    ollamaApiKey: "",
    ollamaBaseUrl: "https://ollama.com/v1",
    ollamaMaxTokens: 1000,
    ollamaModel: "glm-4.7",
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    ...overrides
  };
}

test("createChatResponder prioriza Ollama Cloud quando configurado", async () => {
  const calls = [];
  const responder = createChatResponder(
    createConfig({
      ollamaApiKey: "ollama-key",
      openaiApiKey: "openai-key"
    }),
    {
      createClient(provider) {
        return {
          chat: {
            completions: {
              async create({ max_tokens, model }) {
                calls.push({ model, name: provider.name, route: "chat" });
                assert.equal(max_tokens, 1000);

                if (provider.name === "openai") {
                  throw new Error("OpenAI nao deveria ser chamado.");
                }

                return {
                  choices: [
                    {
                      message: {
                        content: "Resposta da Ollama."
                      }
                    }
                  ]
                };
              }
            }
          },
          responses: {
            async create() {
              throw new Error("Responses nao deveria ser chamado para Ollama.");
            }
          }
        };
      }
    }
  );

  const reply = await responder({
    history: [],
    message: "Quanto e 2 + 2?"
  });

  assert.deepEqual(reply, {
    reply: "Resposta da Ollama.",
    debug: {
      provider: "ollama",
      model: "glm-4.7"
    }
  });
  assert.deepEqual(calls, [
    { model: "glm-4.7", name: "ollama", route: "chat" }
  ]);
});

test("createChatResponder usa OpenAI como fallback quando Ollama falha", async () => {
  const calls = [];
  const responder = createChatResponder(
    createConfig({
      ollamaApiKey: "ollama-key",
      openaiApiKey: "openai-key"
    }),
    {
      createClient(provider) {
        return {
          chat: {
            completions: {
              async create({ max_tokens, model }) {
                calls.push({ model, name: provider.name, route: "chat" });
                assert.equal(max_tokens, 1000);

                if (provider.name === "ollama") {
                  const error = new Error("Rate limit");
                  error.status = 429;
                  throw error;
                }

                throw new Error("Chat completions nao deveria ser chamado para OpenAI.");
              }
            }
          },
          responses: {
            async create({ model }) {
              calls.push({ model, name: provider.name, route: "responses" });

              return {
                output_text: "2 + 2 = 4."
              };
            }
          }
        };
      }
    }
  );

  const reply = await responder({
    history: [{ role: "user", content: "Quanto e 1 + 1?" }],
    message: "Quanto e 2 + 2?"
  });

  assert.deepEqual(reply, {
    reply: "2 + 2 = 4.",
    debug: {
      provider: "openai",
      model: "gpt-4o-mini"
    }
  });
  assert.deepEqual(calls, [
    { model: "glm-4.7", name: "ollama", route: "chat" },
    { model: "gpt-4o-mini", name: "openai", route: "responses" }
  ]);
});

test("createChatResponder repassa apiKey e baseURL ao criar os clients", async () => {
  const createdProviders = [];

  createChatResponder(
    createConfig({
      ollamaApiKey: "ollama-key",
      openaiApiKey: "openai-key"
    }),
    {
      createClient(provider) {
        createdProviders.push(provider);

        return {
          chat: {
            completions: {
              async create() {
                return {
                  choices: [
                    {
                      message: {
                        content: "ok"
                      }
                    }
                  ]
                };
              }
            }
          },
          responses: {
            async create() {
              return {
                output_text: "ok"
              };
            }
          }
        };
      }
    }
  );

  assert.deepEqual(createdProviders, [
    {
      apiKey: "ollama-key",
      baseURL: "https://ollama.com/v1",
      maxTokens: 1000,
      model: "glm-4.7",
      name: "ollama"
    },
    {
      apiKey: "openai-key",
      model: "gpt-4o-mini",
      name: "openai"
    }
  ]);
});

test("createChatResponder retorna 503 quando nenhum provedor esta configurado", async () => {
  const responder = createChatResponder(createConfig());

  await assert.rejects(
    responder({
      history: [],
      message: "Quanto e 2 + 2?"
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /OLLAMA_API_KEY/);
      assert.match(error.message, /OPENAI_API_KEY/);
      return true;
    }
  );
});
