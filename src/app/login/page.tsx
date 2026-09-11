"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type UserRow = { id: string; name: string; email: string; title: string; role: string; tenant: string };

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const signedOut = params.get("signedOut") === "1";
  const passwordSet = params.get("passwordSet") === "1";

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setError("Database is not ready. Run npm run db:setup"));
  }, []);

  async function enter(res: Response) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      await enter(res);
    } finally {
      setBusy(false);
    }
  }

  async function choose(userId: string) {
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await enter(res);
  }

  return (
    <main className="min-h-screen bg-[#0b1f3a] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-xl rounded-2xl bg-white text-slate-900 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">TalentBridge POC</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Invited users sign in with email and password. Demo picker remains for seed users without a password.
        </p>
        {signedOut ? (
          <p className="mt-3 text-sm text-emerald-700">You have been signed out. Sign in again to continue.</p>
        ) : null}
        {passwordSet ? (
          <p className="mt-3 text-sm text-emerald-700">Password saved. Sign in with your email and password.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <form onSubmit={signInWithPassword} className="mt-6 space-y-3">
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">POC demo switcher</h2>
          <p className="mt-1 text-xs text-slate-500">Seed users can still be opened without a password.</p>
          <ul className="mt-3 space-y-2">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => choose(u.id)}
                  className="w-full text-left rounded-lg border border-slate-200 px-4 py-3 hover:border-blue-600 hover:bg-blue-50 cursor-pointer"
                >
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">
                    {u.role} · {u.title} · {u.tenant}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
