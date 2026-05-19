"use client";
import * as React from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

interface ActiveFilters {
  department?: string;
  startDate?: string;
  endDate?: string;
}

const SUGGESTED_QUESTIONS = [
  "Which department has the highest repetitive workload?",
  "What is the top automation opportunity this month?",
  "Which employees are significantly above their role average?",
  "What are the week-over-week trends in repetitive work?",
  "Are there any anomalies I should be aware of?",
  "How much INR could we recover through automation?",
];

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ content, error }: { content: string; error?: boolean }) {
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          error
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function AssistantPanel({ activeFilters }: { activeFilters?: ActiveFilters }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messageAreaRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Scroll ONLY the message area — not the page
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Scroll inside the message container, not the window
    if (messageAreaRef.current) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendQuestion = React.useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "44px";
      }
      setLoading(true);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            filters: activeFilters ?? {},
            history: messages
              .filter((m) => !m.error)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: res.ok ? data.answer : data.error ?? "Something went wrong.",
            error: !res.ok,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Network error. Please check your connection.",
            error: true,
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, activeFilters, messages]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  // Desktop: Enter sends, Shift+Enter newline
  // Mobile: Enter key on software keyboard sends (no shift available)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(input);
    }
  };

  // Insert a newline at cursor position — used by the mobile newline button
  const insertNewline = () => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const newVal = input.slice(0, start) + "\n" + input.slice(end);
    setInput(newVal);
    // Restore cursor after the inserted newline
    requestAnimationFrame(() => {
      el.selectionStart = start + 1;
      el.selectionEnd = start + 1;
      // Resize
      el.style.height = "44px";
      el.style.height = Math.min(el.scrollHeight, 140) + "px";
      el.focus();
    });
  };

  const isEmpty = messages.length === 0;

  return (
    // Taller on mobile (560px), even taller on sm+ (600px)
    <div className="rounded-lg border bg-white shadow-sm flex flex-col h-[560px] sm:h-[600px]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden />
          <h3 className="text-sm font-semibold text-gray-900">Workforce Pulse Assistant</h3>
        </div>
        <div className="text-xs text-gray-400 hidden sm:block">Groq · llama-3.3-70b</div>
      </div>

      {/* Message area — scrolls internally, never bleeds to page */}
      <div
        ref={messageAreaRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
      >
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="text-2xl mb-2" aria-hidden>📊</div>
            <p className="text-sm font-medium text-gray-700 mb-1">Ask about your workforce data</p>
            <p className="text-xs text-gray-400 mb-5">
              Answers are grounded in your real analytics — no hallucinations.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuestion(q)}
                  className="text-left text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserBubble key={msg.id} content={msg.content} />
              ) : (
                <AssistantBubble key={msg.id} content={msg.content} error={msg.error} />
              )
            )}
            {loading && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t px-3 py-3 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">

          {/* Newline button — visible on mobile only (sm:hidden) */}
          <button
            type="button"
            onClick={insertNewline}
            aria-label="Insert new line"
            className="sm:hidden shrink-0 w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center hover:bg-gray-100 transition-colors mb-0.5"
          >
            {/* Return/enter icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                d="M9 10l-5 5 5 5M20 4v7a4 4 0 01-4 4H4" />
            </svg>
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about repetitive work, automation…"
            rows={1}
            disabled={loading}
            aria-label="Ask the assistant"
            className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 overflow-y-auto"
            style={{ height: "44px", minHeight: "44px", maxHeight: "140px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "44px";
              el.style.height = Math.min(el.scrollHeight, 140) + "px";
            }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="shrink-0 w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-0.5"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </form>

        {/* Hint — different text for mobile vs desktop */}
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          <span className="sm:hidden">Tap ↵ to add a new line · tap send to submit</span>
          <span className="hidden sm:inline">Enter to send · Shift+Enter for new line</span>
        </p>
      </div>
    </div>
  );
}
