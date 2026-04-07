async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

export async function checkSession() {
  const response = await fetch("/api/session", {
    credentials: "include"
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 401) {
    return false;
  }

  throw new Error("Nao foi possivel verificar a sessao.");
}

export async function requestAccess(passphrase) {
  const response = await fetch("/api/access", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ passphrase })
  });

  if (response.status === 204) {
    return;
  }

  const body = await parseResponse(response);
  throw new Error(body?.message || "Palavra-chave incorreta.");
}

export async function sendChatMessage(message, history) {
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message, history })
  });

  const body = await parseResponse(response);

  if (response.ok && body?.reply) {
    return body.reply;
  }

  const error = new Error(
    body?.message || "Nao foi possivel enviar sua pergunta agora."
  );

  error.status = response.status;
  throw error;
}
