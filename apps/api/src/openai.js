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
