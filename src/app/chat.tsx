"use client";

import { useEffect, useRef, useState } from "react";
import type { MealCard, Message, SymptomCard } from "@/lib/db";
import { resizeImage } from "@/lib/image";

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

const r = (v: number | null) => (v == null ? "–" : Math.round(v));

function money(amount: number | null, currency: string | null) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`;
  }
}

function MealCardView({ m }: { m: MealCard }) {
  if (m.deleted) {
    return (
      <div className="rounded-xl border border-black/5 bg-surface px-3 py-2 text-sm text-muted line-through dark:border-white/10">
        {m.description}
      </div>
    );
  }
  const where =
    m.location_type === "outside"
      ? ["🍽️ Outside", m.place, money(m.amount_spent, m.currency)].filter(Boolean).join(" · ")
      : m.location_type === "home"
        ? "🏠 Home"
        : "❓ Home or outside?";
  return (
    <div className="rounded-xl border border-black/5 bg-surface px-3 py-2 text-sm dark:border-white/10">
      <div className="font-medium">{m.description}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span className="font-semibold text-foreground">{r(m.calories)} kcal</span>
        <span>P {r(m.protein_g)}g</span>
        <span>C {r(m.carbs_g)}g</span>
        <span>F {r(m.fat_g)}g</span>
        <span>Fibre {r(m.fiber_g)}g</span>
      </div>
      <div className="mt-1 text-xs text-muted">{where}</div>
    </div>
  );
}

function SymptomCardView({ s }: { s: SymptomCard }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm">
      <span className="font-medium capitalize">{s.kind}</span>
      {s.severity != null && (
        <span className="ml-2 text-xs text-muted">
          {"●".repeat(s.severity)}
          {"○".repeat(5 - s.severity)} {s.severity}/5
        </span>
      )}
    </div>
  );
}

type Pending = { text: string; thumb: string | null };

export default function Chat() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<{ full: string; thumb: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/messages")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((d) => setMessages(d.messages))
      .catch(() => {
        setMessages([]);
        setError("Couldn't load your history.");
      });
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, photo]);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const [full, thumb] = await Promise.all([resizeImage(file, 1280), resizeImage(file, 360, 0.7)]);
      setPhoto({ full, thumb });
      setError(null);
    } catch {
      setError("Couldn't read that photo. Try another one.");
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = draft.trim();
    if ((!content && !photo) || pending) return;
    setPending({ text: content, thumb: photo?.thumb ?? null });
    setError(null);
    const sentPhoto = photo;
    setDraft("");
    setPhoto(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          image: sentPhoto?.full,
          thumb: sentPhoto?.thumb,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setMessages((m) => [...(m ?? []), ...d.messages]);
    } catch {
      setDraft(content);
      setPhoto(sentPhoto);
      setError("Message didn't send. Try again.");
    } finally {
      setPending(null);
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
        {messages?.length === 0 && !pending && !error && (
          <div className="mt-16 text-center text-muted">
            <p className="text-lg">What did you eat?</p>
            <p className="mt-1 text-sm">
              Snap a photo with 📷, or type “2 idlis and sambar at home” or “bloated after lunch, 3/5”.
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
                {showDay && <div className="my-3 text-center text-xs font-medium text-muted">{day}</div>}
                <Bubble role={m.role} text={m.content} thumb={m.image_url} time={timeLabel(m.created_at)} />
                {(m.meta?.meals?.length || m.meta?.symptoms?.length) && (
                  <div className="mt-1.5 max-w-[85%] space-y-1.5">
                    {m.meta?.meals?.map((meal) => <MealCardView key={`m${meal.id}`} m={meal} />)}
                    {m.meta?.symptoms?.map((s) => <SymptomCardView key={`s${s.id}`} s={s} />)}
                  </div>
                )}
              </li>
            );
          })}
          {pending && (
            <>
              <li>
                <Bubble role="user" text={pending.text} thumb={pending.thumb} time="sending…" />
              </li>
              <li className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-bubble px-4 py-3 text-sm text-muted">
                  <span className="animate-pulse">{pending.thumb ? "Looking at your plate…" : "Thinking…"}</span>
                </div>
              </li>
            </>
          )}
        </ul>
        <div ref={bottom} />
      </main>

      <form
        onSubmit={send}
        className="border-t border-black/5 bg-surface px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 dark:border-white/10"
      >
        {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
        {photo && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.thumb} alt="Selected food" className="h-16 w-16 rounded-lg object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="text-sm text-muted">
              Remove
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <input ref={fileInput} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={!!pending}
            aria-label="Add a food photo"
            className="h-11 w-11 shrink-0 rounded-full border border-black/10 text-xl disabled:opacity-40 dark:border-white/15"
          >
            📷
          </button>
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
            placeholder={photo ? "Add details (optional)…" : "Log a meal or symptom…"}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-black/10 bg-background px-4 py-2.5 text-base outline-none focus:border-accent dark:border-white/15"
          />
          <button
            type="submit"
            disabled={!!pending || (!draft.trim() && !photo)}
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

function Bubble({
  role,
  text,
  thumb,
  time,
}: {
  role: "user" | "assistant";
  text: string;
  thumb: string | null;
  time: string;
}) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] overflow-hidden whitespace-pre-wrap rounded-2xl ${
          mine ? "rounded-br-sm bg-accent text-white" : "rounded-bl-sm bg-bubble"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb && <img src={thumb} alt="Food photo" className="max-h-60 w-full object-cover" />}
        <div className="px-4 py-2">
          {text}
          <div className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>{time}</div>
        </div>
      </div>
    </div>
  );
}
