import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const DEFAULT_ACCESS_CODE = "1510T";
const DEFAULT_DEBUG_ENABLED = false;
const DEFAULT_OLLAMA_BASE_URL = "https://ollama.com/v1";
const DEFAULT_OLLAMA_MAX_TOKENS = 1000;
const DEFAULT_OLLAMA_MODEL = "glm-4.7";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_PORT = 3000;
const DEFAULT_SESSION_SECRET = "development-session-secret-change-me";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  const envPaths = [
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../../.env")
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
}

loadEnvFiles();

function parsePort(value) {
  const parsedValue = Number.parseInt(value || `${DEFAULT_PORT}`, 10);
  return Number.isNaN(parsedValue) ? DEFAULT_PORT : parsedValue;
}

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(`${value ?? ""}`, 10);

  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const port = parsePort(process.env.PORT);
  const debugEnabled = parseBoolean(
    process.env.DEBUG,
    DEFAULT_DEBUG_ENABLED
  );
  const sessionSecret =
    process.env.SESSION_SECRET?.trim() || DEFAULT_SESSION_SECRET;
  const ollamaApiKey = process.env.OLLAMA_API_KEY?.trim() || "";
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || "";

  if (isProduction && sessionSecret === DEFAULT_SESSION_SECRET) {
    throw new Error("SESSION_SECRET precisa ser definido em producao.");
  }

  if (isProduction && !ollamaApiKey && !openaiApiKey) {
    throw new Error(
      "OLLAMA_API_KEY ou OPENAI_API_KEY precisa ser definido em producao."
    );
  }

  return {
    appAccessCode: process.env.APP_ACCESS_CODE?.trim() || DEFAULT_ACCESS_CODE,
    appOrigin: process.env.APP_ORIGIN?.trim() || "",
    debugEnabled,
    isProduction,
    nodeEnv,
    ollamaApiKey,
    ollamaBaseUrl:
      process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
    ollamaMaxTokens: parsePositiveInteger(
      process.env.OLLAMA_MAX_TOKENS,
      DEFAULT_OLLAMA_MAX_TOKENS
    ),
    ollamaModel: process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL,
    openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    port,
    sessionSecret
  };
}
