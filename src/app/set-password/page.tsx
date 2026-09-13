"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TalentBridgeMark, TbLoader } from "@/components/TbLoader";

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set password");
      router.replace("/login?passwordSet=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1f3a] text-white flex items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white text-slate-900 p-8 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <TalentBridgeMark size={36} />
          <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">TalentBridge</p>
        </div>
        <h1 className="text-2xl font-semibold">Set your password</h1>
        <p className="text-sm text-slate-600">
          This link comes from an administrator invitation or password reset. It can be used once.
        </p>
        {!token ? <p className="text-sm text-red-600">This link is missing a token. Ask an administrator to send a new email.</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">New password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !token}
          className="w-full h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          {busy ? "Saving…" : "Save password and continue"}
        </button>
      </form>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<TbLoader variant="page" hint="Loading" />}>
      <SetPasswordForm />
    </Suspense>
  );
}
