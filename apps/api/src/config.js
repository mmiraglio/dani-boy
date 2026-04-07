import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const DEFAULT_ACCESS_CODE = "1510T";
const DEFAULT_MODEL = "gpt-4o-mini";
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

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const port = parsePort(process.env.PORT);
  const sessionSecret =
    process.env.SESSION_SECRET?.trim() || DEFAULT_SESSION_SECRET;
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || "";

  if (isProduction && sessionSecret === DEFAULT_SESSION_SECRET) {
    throw new Error("SESSION_SECRET precisa ser definido em producao.");
  }

  if (isProduction && !openaiApiKey) {
    throw new Error("OPENAI_API_KEY precisa ser definido em producao.");
  }

  return {
    appAccessCode: process.env.APP_ACCESS_CODE?.trim() || DEFAULT_ACCESS_CODE,
    appOrigin: process.env.APP_ORIGIN?.trim() || "",
    isProduction,
    nodeEnv,
    openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    port,
    sessionSecret
  };
}
