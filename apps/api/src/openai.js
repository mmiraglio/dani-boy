import OpenAI from "openai";

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 500;

const SYSTEM_INSTRUCTIONS = `
Voce e Dani Boy, um tutor virtual que responde exclusivamente perguntas de matematica.
Sempre responda em portugues do Brasil.
Use linguagem apropriada para alunos do quinto ano do ensino fundamental do Brasil.
Explique o raciocinio passo a passo de forma simples e amigavel.
Quando fizer sentido, use exemplos curtos e organizados.
Se a pergunta nao for sobre matematica, recuse com educacao e convide o aluno a enviar uma duvida matematica.
Se houver erro na conta do aluno, corrija com delicadeza.
Prefira respostas diretas, claras e sem jargao tecnico desnecessario.
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

export function createChatResponder(config) {
  if (!config.openaiApiKey) {
    return async function unavailableResponder() {
      const error = new Error(
        "O servidor ainda nao recebeu a OPENAI_API_KEY para responder perguntas."
      );
      error.statusCode = 503;
      throw error;
    };
  }

  const client = new OpenAI({
    apiKey: config.openaiApiKey
  });

  /**
   * @param {{ message: string, history: ChatMessage[] }} payload
   * @returns {Promise<string>}
   */
  return async function chatResponder({ history, message }) {
    const response = await client.responses.create({
      model: config.openaiModel,
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
  };
}
