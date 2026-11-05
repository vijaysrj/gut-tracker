"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/db";

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setMessages(d.messages))
      .catch(() => {
        setMessages([]);
        setError("Couldn't load your history.");
      });
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setMessages((m) => [...(m ?? []), ...d.messages]);
      setDraft("");
    } catch {
      setError("Message didn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  let lastDay = "";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-black/5 bg-surface/80 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur dark:border-white/10">
        <h1 className="text-lg font-semibold">🥗 Gut Tracker</h1>
        <form action="/api/logout" method="post">
          <button className="text-sm text-muted">Lock</button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4">
        {messages === null && <p className="text-center text-sm text-muted">Loading…</p>}
        {messages?.length === 0 && !error && (
          <div className="mt-16 text-center text-muted">
            <p className="text-lg">What did you eat?</p>
            <p className="mt-1 text-sm">
              Try “Idli and sambar at home for breakfast” or “Bloated after lunch, 3/5”.
            </p>
          </div>
        )}
        <ul className="space-y-2">
          {messages?.map((m) => {
            const day = dayLabel(m.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <li key={m.id}>
                {showDay && (
                  <div className="my-3 text-center text-xs font-medium text-muted">{day}</div>
                )}
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
                      m.role === "user"
                        ? "rounded-br-sm bg-accent text-white"
                        : "rounded-bl-sm bg-bubble"
                    }`}
                  >
                    {m.content}
                    <div
                      className={`mt-1 text-[10px] ${
                        m.role === "user" ? "text-white/70" : "text-muted"
                      }`}
                    >
                      {timeLabel(m.created_at)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottom} />
      </main>

      <form
        onSubmit={send}
        className="border-t border-black/5 bg-surface px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 dark:border-white/10"
      >
        {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Log a meal or symptom…"
            className="max-h-32 flex-1 resize-none rounded-2xl border border-black/10 bg-background px-4 py-2.5 text-base outline-none focus:border-accent dark:border-white/15"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="h-11 w-11 shrink-0 rounded-full bg-accent text-lg text-white disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}
