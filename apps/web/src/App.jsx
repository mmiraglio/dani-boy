import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { checkSession, requestAccess, sendChatMessage } from "./api.js";

const MessageContent = lazy(() =>
  import("./message-content.jsx").then((module) => ({
    default: module.MessageContent
  }))
);

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Oi! Eu sou o Dani Boy. Posso ajudar com contas, problemas e dúvidas de matemática. Escreva sua pergunta quando quiser."
};

function App() {
  const [screen, setScreen] = useState("loading");
  const [passphrase, setPassphrase] = useState("");
  const [accessError, setAccessError] = useState("");
  const [bootError, setBootError] = useState("");
  const [isSubmittingAccess, setIsSubmittingAccess] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const authenticated = await checkSession();
        setScreen(authenticated ? "chat" : "gate");
      } catch (_error) {
        setBootError(
          "Nao consegui validar sua sessao agora. Tente atualizar a pagina."
        );
        setScreen("gate");
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [isSending, messages]);

  async function handleAccess(event) {
    event.preventDefault();

    const sanitizedPassphrase = passphrase.trim();

    if (!sanitizedPassphrase) {
      setAccessError("Digite a palavra-chave da turma para entrar.");
      return;
    }

    setIsSubmittingAccess(true);
    setAccessError("");

    try {
      await requestAccess(sanitizedPassphrase);
      setPassphrase("");
      setBootError("");
      setMessages([INITIAL_MESSAGE]);
      setScreen("chat");
    } catch (error) {
      setAccessError(error.message);
    } finally {
      setIsSubmittingAccess(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    const sanitizedDraft = draft.trim();

    if (!sanitizedDraft || isSending) {
      return;
    }

    const userMessage = {
      role: "user",
      content: sanitizedDraft
    };

    const nextMessages = [...messages, userMessage];
    const history = messages.map(({ role, content }) => ({ role, content }));

    setMessages(nextMessages);
    setDraft("");
    setChatError("");
    setIsSending(true);

    try {
      const reply = await sendChatMessage(sanitizedDraft, history);
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: reply }
      ]);
    } catch (error) {
      if (error.status === 401) {
        setScreen("gate");
        setMessages([INITIAL_MESSAGE]);
        setAccessError("Sua sessao expirou. Digite a palavra-chave novamente.");
        return;
      }

      setChatError(error.message);
      setMessages(messages);
      setDraft(sanitizedDraft);
    } finally {
      setIsSending(false);
    }
  }

  function handleTextareaKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-glow page-glow-left" />
      <div className="page-glow page-glow-right" />

      <main
        className={`app-frame ${screen === "chat" ? "app-frame-chat" : "app-frame-gate"
          }`}
      >
        {screen === "loading" ? (
          <section className="surface-panel access-panel">
            <Brand />
            <LoadingView />
          </section>
        ) : screen === "gate" ? (
          <section className="surface-panel access-panel">
            <Brand />
            <GateView
              accessError={accessError}
              bootError={bootError}
              isSubmittingAccess={isSubmittingAccess}
              onSubmit={handleAccess}
              passphrase={passphrase}
              setPassphrase={setPassphrase}
            />
          </section>
        ) : (
          <section className="surface-panel chat-panel">
            <ChatView
              chatError={chatError}
              draft={draft}
              handleSendMessage={handleSendMessage}
              handleTextareaKeyDown={handleTextareaKeyDown}
              isSending={isSending}
              messageListRef={messageListRef}
              messages={messages}
              setDraft={setDraft}
            />
          </section>
        )}
      </main>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`brand-row ${compact ? "brand-row-compact" : ""}`}>
      <div className="brand-mark" aria-hidden="true">
        √
      </div>
      <h1 className="brand-title">Dani Boy</h1>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="center-stack">
      <div className="loader" aria-hidden="true" />
      <p>Verificando se a sua sessao ja esta liberada.</p>
    </div>
  );
}

function GateView({
  accessError,
  bootError,
  isSubmittingAccess,
  onSubmit,
  passphrase,
  setPassphrase
}) {
  return (
    <div className="gate-layout">
      <form className="access-form" onSubmit={onSubmit}>
        <label className="field-label" htmlFor="passphrase">
          Palavra-chave
        </label>
        <div className="access-form-row">
          <input
            id="passphrase"
            className="text-input"
            type="password"
            autoComplete="current-password"
            placeholder="Digite a palavra-chave"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          <button
            className="primary-button"
            type="submit"
            disabled={isSubmittingAccess}
          >
            {isSubmittingAccess ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </form>

      {bootError ? <p className="status-error">{bootError}</p> : null}
      {accessError ? <p className="status-error">{accessError}</p> : null}
    </div>
  );
}

function ChatView({
  chatError,
  draft,
  handleSendMessage,
  handleTextareaKeyDown,
  isSending,
  messageListRef,
  messages,
  setDraft
}) {
  return (
    <div className="chat-layout">
      <div className="chat-header">
        <Brand compact />
      </div>

      <div className="message-list" aria-live="polite" ref={messageListRef}>
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`message-bubble message-${message.role}`}
          >
            <span className="message-role">
              {message.role === "assistant" ? "Dani Boy" : "Voce"}
            </span>
            {message.role === "assistant" ? (
              <Suspense fallback={<p className="message-plain">{message.content}</p>}>
                <MessageContent content={message.content} />
              </Suspense>
            ) : (
              <p className="message-plain">{message.content}</p>
            )}
          </article>
        ))}

        {isSending ? (
          <article className="message-bubble message-assistant message-pending">
            <span className="message-role">Dani Boy</span>
            <p>Estou pensando na melhor explicacao para essa conta...</p>
          </article>
        ) : null}
      </div>

      <form className="composer" onSubmit={handleSendMessage}>
        <label className="field-label" htmlFor="question">
          Sua pergunta de matemática
        </label>
        <textarea
          id="question"
          className="composer-input"
          rows="4"
          placeholder="Exemplo: Resolva 248 + 179 e explique o passo a passo."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
        />

        <div className="composer-footer">
          <p className="composer-tip">Use Shift + Enter para quebrar linha.</p>
          <button className="primary-button" type="submit" disabled={isSending}>
            {isSending ? "Respondendo..." : "Enviar pergunta"}
          </button>
        </div>
      </form>

      {chatError ? <p className="status-error">{chatError}</p> : null}
    </div>
  );
}

export default App;
