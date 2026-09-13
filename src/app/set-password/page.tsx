"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { TbLoader } from "@/components/TbLoader";

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthShell
      headline="Activate your TalentBridge access"
      subcopy="Set a password from your invitation or reset link. The link is single-use and expires for security."
    >
      <div className="mb-7">
        <div className="auth-kicker">
          <span className="auth-kicker-dot" aria-hidden />
          Account setup
        </div>
        <h1 className="mt-3 font-[family-name:var(--font-auth-display)] text-[2rem] leading-[1.15] tracking-[-0.025em] text-slate-950">
          Activate your account
        </h1>
        <p className="mt-2.5 text-[14px] leading-[1.55] text-slate-500">
          Use the link from your invitation email to set a password (at least 8 characters). You can sign in with your
          work email only after activation.
        </p>
      </div>

      {!token ? (
        <div className="auth-banner auth-banner-err mb-5" role="alert">
          This link is missing a token. Ask an administrator to send a new email.
        </div>
      ) : null}
      {error ? (
        <div className="auth-banner auth-banner-err mb-5" role="alert">
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="auth-label">New password</span>
          <div className="auth-field">
            <Lock className="auth-field-icon" aria-hidden />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              className="auth-input auth-input-trailing"
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
        <label className="block">
          <span className="auth-label">Confirm password</span>
          <div className="auth-field">
            <Lock className="auth-field-icon" aria-hidden />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              className="auth-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </label>
        <button type="submit" disabled={busy || !token} className="auth-primary">
          <span>{busy ? "Activating…" : "Activate and continue"}</span>
          {!busy ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<TbLoader variant="page" hint="Loading" />}>
      <SetPasswordForm />
    </Suspense>
  );
}
