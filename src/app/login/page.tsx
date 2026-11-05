"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form action={action} className="w-full max-w-xs space-y-4">
        <div className="text-center">
          <div className="text-4xl">🥗</div>
          <h1 className="mt-2 text-xl font-semibold">Gut Tracker</h1>
        </div>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          required
          className="w-full rounded-xl border border-black/10 bg-surface px-4 py-3 text-base dark:border-white/15"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
