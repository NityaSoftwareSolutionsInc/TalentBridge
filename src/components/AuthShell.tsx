"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { TalentBridgeLogo } from "./TbLoader";

const POINTS = [
  {
    title: "One operating picture",
    body: "Candidates, clients, requirements and submissions stay connected — not scattered across inboxes and portals.",
  },
  {
    title: "Hub-first communication",
    body: "Call, email and follow-up write into the same timeline with a mandatory next action.",
  },
  {
    title: "Tenant-scoped by design",
    body: "Every record, search hit and audit event belongs to your organization alone.",
  },
];

export function AuthShell({
  children,
  eyebrow = "Contact Manager",
  headline = "The staffing relationship hub",
  subcopy = "Connect JobsNProfiles, Outlook and VioTalk without rebuilding them — keep ownership, context and next action in one place.",
}: {
  children: ReactNode;
  eyebrow?: string;
  headline?: string;
  subcopy?: string;
}) {
  return (
    <main className="auth-shell relative min-h-screen lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)]">
      <aside className="auth-brand relative hidden overflow-hidden text-[var(--color-text-inverse)] lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16 xl:py-14">
        <div className="auth-brand-grid absolute inset-0" aria-hidden />
        <div className="auth-brand-glow absolute inset-0" aria-hidden />

        <div className="auth-rise relative z-[1]">
          <TalentBridgeLogo theme="dark" size={44} product={eyebrow} />
        </div>

        <div className="auth-rise auth-rise-delay relative z-[1] max-w-[34rem]">
          <p className="font-[family-name:var(--font-auth-display)] text-[2.35rem] leading-[1.12] tracking-[-0.02em] text-white xl:text-[2.75rem]">
            {headline}
          </p>
          <p className="mt-5 max-w-[30rem] text-[15px] leading-6 text-slate-300">{subcopy}</p>

          <ul className="mt-10 space-y-5">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-sky-400" aria-hidden />
                <div>
                  <div className="text-[13px] font-semibold text-white">{point.title}</div>
                  <p className="mt-1 text-[13px] leading-5 text-slate-400">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <footer className="auth-rise auth-rise-delay-2 relative z-[1] border-t border-white/10 pt-6 text-[12px] text-slate-500">
          Secure workspace · Role-based access · Audit-ready activity
        </footer>
      </aside>

      <section className="auth-form-pane relative flex min-h-screen flex-col">
        <div className="auth-form-ambient absolute inset-0" aria-hidden />

        <header className="relative z-[1] flex items-center justify-between px-6 py-5 sm:px-10 lg:px-12">
          <div className="lg:hidden">
            <TalentBridgeLogo theme="light" size={32} product={eyebrow} />
          </div>
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace access</p>
          </div>
          <div className="auth-trust-chip">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden />
            <span>Encrypted session</span>
          </div>
        </header>

        <div className="relative z-[1] mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 py-6 sm:px-8">
          <div className="auth-rise auth-rise-delay auth-card">
            <div className="auth-card-header">
              <TalentBridgeLogo theme="light" size={34} product={null} />
            </div>
            <div className="auth-card-body">{children}</div>
          </div>
        </div>

        <footer className="relative z-[1] border-t border-slate-200/80 px-6 py-4 sm:px-10 lg:px-12">
          <div className="mx-auto flex max-w-[520px] flex-col gap-1 text-[11px] leading-4 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Private tenant workspace</span>
            <span className="text-slate-400">Unauthorized access is prohibited</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
