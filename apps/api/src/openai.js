import OpenAI from "openai";

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 500;

const SYSTEM_INSTRUCTIONS = `
Você é Dani Boy, um tutor virtual que responde somente perguntas de matemática para alunos do 5º ano do ensino fundamental.

Sempre responda em português do Brasil.
Use linguagem simples, amigável e adequada para crianças.
Explique passo a passo de forma clara e curta.
Use exemplos curtos quando ajudarem.
Se a pergunta não for de matemática, recuse com educação e peça uma dúvida de matemática.
Se houver erro do aluno, corrija com delicadeza e explique onde ele se confundiu.
Não invente resultados.
Se a pergunta estiver confusa ou incompleta, peça mais detalhes.

Quando ajudar, use Markdown simples.
Use listas para organizar passos.
Use **negrito** apenas para destaque curto.
Para fórmulas, use $...$ em linha e $$...$$ em bloco.
Evite usar literalmente "begin:math:text", "end:math:text", "begin:math:display" e "end:math:display".

Quando o aluno pedir conta armada, soma em coluna ou subtração em coluna, use bloco \`\`\`calc, com números alinhados à direita, neste formato:
\`\`\`calc
348
+153
---
501
\`\`\`

Use um bloco \`\`\`calc separado para cada conta.
Sempre que possível, termine com um incentivo breve e positivo.
`.trim();

/**
 * @typedef {{ role: "user" | "assistant", content: string }} ChatMessage
 */

/**
 * Mantem apenas o contexto recente e remove entradas invalidas.
 *
 * @param {unknown} history
 * @returns {ChatMessage[]}
 */
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string"
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_HISTORY_CHARS)
    }))
    .filter((message) => message.content.length > 0);
}

function formatHistoryLine(message) {
  const speaker = message.role === "assistant" ? "Dani Boy" : "Aluno";
  return `${speaker}: ${message.content}`;
}

function buildChatMessages({ history, message }) {
  return [
    {
      role: "system",
      content: SYSTEM_INSTRUCTIONS
    },
    ...history.map(({ content, role }) => ({
      role,
      content
    })),
    {
      role: "user",
      content: message
    }
  ];
}

/**
 * Prepara um texto simples para a Responses API sem exigir estado salvo no servidor.
 *
 * @param {{ message: string, history: ChatMessage[] }} payload
 * @returns {string}
 */
export function buildConversationInput({ history, message }) {
  const historyText = history.length
    ? history.map(formatHistoryLine).join("\n")
    : "Nenhum contexto anterior.";

  return `
Contexto recente da conversa:
${historyText}

Pergunta atual do aluno:
${message}
  `.trim();
}

function buildProviderConfigs(config) {
  const providers = [];

  if (config.ollamaApiKey) {
    providers.push({
      apiKey: config.ollamaApiKey,
      baseURL: config.ollamaBaseUrl,
      maxTokens: config.ollamaMaxTokens,
      model: config.ollamaModel,
      name: "ollama"
    });
  }

  if (config.openaiApiKey) {
    providers.push({
      apiKey: config.openaiApiKey,
      model: config.openaiModel,
      name: "openai"
    });
  }

  return providers;
}

export function listConfiguredProviders(config) {
  return buildProviderConfigs(config).map(
    ({ baseURL = null, maxTokens = null, model, name }) => ({
      baseURL,
      maxTokens,
      model,
      name
    })
  );
}

function createOpenAICompatibleClient({ apiKey, baseURL }) {
  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {})
  });
}

function buildUnavailableError() {
  const error = new Error(
    "O servidor ainda nao recebeu OLLAMA_API_KEY nem OPENAI_API_KEY para responder perguntas."
  );
  error.statusCode = 503;
  return error;
}

function resolveStatusCode(error) {
  if (typeof error?.statusCode === "number") {
    return error.statusCode;
  }

  if (typeof error?.status === "number") {
    return error.status;
  }

  return 502;
}

async function requestResponsesReply({ client, history, message, model }) {
  const response = await client.responses.create({
    model,
    instructions: SYSTEM_INSTRUCTIONS,
    input: buildConversationInput({ history, message }),
    max_output_tokens: 350
  });

  const reply = response.output_text?.trim();

  if (!reply) {
    const error = new Error("A resposta do modelo veio vazia.");
    error.statusCode = 502;
    throw error;
  }

  return reply;
}

async function requestChatCompletionsReply({
  client,
  history,
  maxTokens,
  message,
  model
}) {
  const response = await client.chat.completions.create({
    model,
    messages: buildChatMessages({ history, message }),
    max_tokens: maxTokens
  });

  const reply = response.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    const error = new Error("A resposta do modelo veio vazia.");
    error.statusCode = 502;
    throw error;
  }

  return reply;
}

async function requestReply({
  client,
  history,
  maxTokens,
  message,
  model,
  providerName
}) {
  if (providerName === "ollama") {
    return requestChatCompletionsReply({
      client,
      history,
      maxTokens,
      message,
      model
    });
  }

  return requestResponsesReply({
    client,
    history,
    message,
    model
  });
}

export function createChatResponder(
  config,
  { createClient = createOpenAICompatibleClient } = {}
) {
  const providers = buildProviderConfigs(config).map((provider) => ({
    ...provider,
    client: createClient(provider)
  }));

  if (!providers.length) {
    return async function unavailableResponder() {
      throw buildUnavailableError();
    };
  }

  /**
   * @param {{ message: string, history: ChatMessage[] }} payload
   * @returns {Promise<string>}
   */
  return async function chatResponder({ history, message }) {
    let lastError = null;

    for (const provider of providers) {
      try {
        const reply = await requestReply({
          client: provider.client,
          history,
          maxTokens: provider.maxTokens,
          message,
          model: provider.model,
          providerName: provider.name
        });

        return {
          debug: {
            model: provider.model,
            provider: provider.name
          },
          reply
        };
      } catch (error) {
        const providerError = new Error(
          `Falha ao consultar o provedor ${provider.name}.`
        );
        providerError.cause = error;
        providerError.provider = provider.name;
        providerError.statusCode = resolveStatusCode(error);
        lastError = providerError;
      }
    }

    throw lastError || buildUnavailableError();
  };
}
