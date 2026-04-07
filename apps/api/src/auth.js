import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "dani_boy_session";
const SESSION_SCOPE = "chat-access";
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

function toUtf8Buffer(value) {
  return Buffer.from(value || "", "utf8");
}

export function isPassphraseValid(input, expected) {
  const inputBuffer = toUtf8Buffer(input);
  const expectedBuffer = toUtf8Buffer(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

function createSessionPayload() {
  return JSON.stringify({
    issuedAt: Date.now(),
    scope: SESSION_SCOPE
  });
}

export function setAccessCookie(reply, config) {
  reply.setCookie(SESSION_COOKIE_NAME, createSessionPayload(), {
    httpOnly: true,
    maxAge: ONE_DAY_IN_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: config.isProduction,
    signed: true
  });
}

export function readAccessSession(request) {
  const rawCookie = request.cookies[SESSION_COOKIE_NAME];

  if (!rawCookie) {
    return null;
  }

  const unsignedCookie = request.unsignCookie(rawCookie);

  if (!unsignedCookie.valid) {
    return null;
  }

  try {
    const payload = JSON.parse(unsignedCookie.value);
    return payload.scope === SESSION_SCOPE ? payload : null;
  } catch {
    return null;
  }
}

export function requireAuthenticatedSession(request, reply, done) {
  if (!readAccessSession(request)) {
    reply.code(401).send({
      message: "Sessao invalida ou expirada."
    });
    return;
  }

  done();
}
