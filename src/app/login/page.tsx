"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { TbLoader } from "@/components/TbLoader";

type UserRow = { id: string; name: string; email: string; title: string; role: string; tenant: string };

function roleLabel(role: string) {
  const map: Record<string, string> = {
    recruiter: "Recruiter",
    sales: "Sales / BDM",
    operations: "Operations",
    leadership: "Leadership",
    admin: "Administrator",
  };
  return map[role] || role;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const signedOut = params.get("signedOut") === "1";
  const passwordSet = params.get("passwordSet") === "1";

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setError("Database is not ready. Run npm run db:setup"));
  }, []);

  const tenants = useMemo(() => {
    const map = new Map<string, UserRow[]>();
    for (const u of users) {
      const list = map.get(u.tenant) || [];
      list.push(u);
      map.set(u.tenant, list);
    }
    return [...map.entries()];
  }, [users]);

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
    setNotice("");
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

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setNotice(data.message || "If that email is registered, a reset link has been sent.");
      setMode("signin");
    } finally {
      setBusy(false);
    }
  }

  async function choose(userId: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      await enter(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <div className="auth-kicker">
          <span className="auth-kicker-dot" aria-hidden />
          {mode === "forgot" ? "Account recovery" : "Organization sign-in"}
        </div>
        <h1 className="mt-3 font-[family-name:var(--font-auth-display)] text-[2rem] leading-[1.15] tracking-[-0.025em] text-slate-950">
          {mode === "forgot" ? "Reset your password" : "Sign in"}
        </h1>
        <p className="mt-2.5 text-[14px] leading-[1.55] text-slate-500">
          {mode === "forgot"
            ? "Enter your work email. If an account exists, we will send a one-time reset link."
            : "Use the email and password issued for your TalentBridge tenant."}
        </p>
      </div>

      {signedOut ? (
        <div className="auth-banner auth-banner-ok mb-5" role="status">
          You have been signed out. Sign in again to continue.
        </div>
      ) : null}
      {passwordSet ? (
        <div className="auth-banner auth-banner-ok mb-5" role="status">
          Password saved. Sign in with your email and password.
        </div>
      ) : null}
      {notice ? (
        <div className="auth-banner auth-banner-ok mb-5" role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="auth-banner auth-banner-err mb-5" role="alert">
          {error}
        </div>
      ) : null}

      {mode === "signin" ? (
        <form onSubmit={signInWithPassword} className="space-y-5">
          <label className="block">
            <span className="auth-label">Work email</span>
            <div className="auth-field">
              <Mail className="auth-field-icon" aria-hidden />
              <input
                type="email"
                required
                autoComplete="username"
                autoFocus
                className="auth-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="auth-label auth-label-inline">Password</span>
              <button
                type="button"
                className="auth-text-link"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setNotice("");
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="auth-field">
              <Lock className="auth-field-icon" aria-hidden />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="auth-input auth-input-trailing"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-field-action"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <button type="submit" disabled={busy} className="auth-primary">
            <span>{busy ? "Signing in…" : "Continue"}</span>
            {!busy ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
          </button>
        </form>
      ) : (
        <form onSubmit={requestReset} className="space-y-5">
          <label className="block">
            <span className="auth-label">Work email</span>
            <div className="auth-field">
              <Mail className="auth-field-icon" aria-hidden />
              <input
                type="email"
                required
                autoComplete="username"
                autoFocus
                className="auth-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <button type="submit" disabled={busy} className="auth-primary">
            <span>{busy ? "Sending…" : "Send reset link"}</span>
            {!busy ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
          </button>
          <button
            type="button"
            className="auth-secondary"
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Back to sign in
          </button>
        </form>
      )}

      {mode === "signin" && users.length > 0 ? (
        <details className="auth-demo">
          <summary className="auth-demo-summary">
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-slate-800">Demonstration access</span>
              <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                Seed personas for POC walkthroughs · {users.length} users
              </span>
            </span>
            <ChevronDown className="auth-demo-chevron h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </summary>
          <div className="auth-demo-panel">
            <p className="text-[12px] leading-4 text-slate-500">
              Production users should sign in with email and password above.
            </p>
            <div className="mt-3 max-h-[220px] space-y-4 overflow-y-auto pr-1">
              {tenants.map(([tenant, rows]) => (
                <div key={tenant}>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {tenant}
                  </div>
                  <ul className="space-y-1.5">
                    {rows.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => choose(u.id)}
                          className="auth-demo-user"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-[11px] font-semibold text-slate-700">
                            {u.name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-[13px] font-medium text-slate-900">{u.name}</span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {roleLabel(u.role)} · {u.title}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </details>
      ) : null}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<TbLoader variant="page" hint="Loading sign-in" />}>
      <LoginForm />
    </Suspense>
  );
}
