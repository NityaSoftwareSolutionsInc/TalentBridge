"use client";

import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Inbox,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { Button, Tag, cn, kpiLabel } from "./workspace-ui";

type Risk = {
  id: string;
  type?: string;
  title: string;
  module: string;
  recordId?: string | null;
};

type Opportunity = {
  id: string;
  type?: string;
  title: string;
  module?: string;
  recordId?: string | null;
};

const RISK_META: Record<string, { label: string; tone: "red" | "amber" | "blue" | "slate" }> = {
  requirement_aging: { label: "Job aging", tone: "red" },
  submission_feedback: { label: "Feedback SLA", tone: "amber" },
  interview_feedback: { label: "Interview", tone: "amber" },
  client_silence: { label: "Client silence", tone: "red" },
  callback_today: { label: "Callback", tone: "blue" },
  msa_expiry: { label: "MSA expiry", tone: "red" },
  po_risk: { label: "PO risk", tone: "red" },
};

const KPI_META: Record<
  string,
  { hint: string; href: string; icon: typeof ListTodo; wash: string; iconColor: string }
> = {
  openTasks: {
    hint: "Follow-ups that still need a next action",
    href: "/tasks",
    icon: ListTodo,
    wash: "bg-sky-50",
    iconColor: "text-sky-700",
  },
  openExceptions: {
    hint: "Unmatched mail, calls and sync items",
    href: "/communications",
    icon: Inbox,
    wash: "bg-amber-50",
    iconColor: "text-amber-700",
  },
  openRequirements: {
    hint: "Live client jobs in this tenant",
    href: "/clients",
    icon: Briefcase,
    wash: "bg-indigo-50",
    iconColor: "text-indigo-700",
  },
  submissionsWaiting: {
    hint: "Sent profiles waiting on client feedback",
    href: "/candidates",
    icon: ClipboardList,
    wash: "bg-rose-50",
    iconColor: "text-rose-700",
  },
};

function riskMeta(type?: string) {
  return RISK_META[type || ""] || { label: "Risk", tone: "red" as const };
}

export function DashList({
  dash,
  onOpen,
}: {
  dash: Record<string, unknown> | null;
  onOpen: (module: string, id?: string | null) => void;
}) {
  const risks = (dash?.risks as Risk[]) || [];
  if (!risks.length) {
    return (
      <div className="px-4 py-10 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--color-success)]" />
        <p className="mt-2 text-sm font-medium text-[var(--color-text)]">No SLA risks right now</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">New aging jobs, silent clients and overdue feedback will land here.</p>
      </div>
    );
  }
  return (
    <div>
      {risks.map((r) => {
        const meta = riskMeta(r.type);
        return (
          <button
            key={r.id}
            type="button"
            className="w-full text-left px-3.5 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] cursor-pointer transition-colors"
            onClick={() => onOpen(r.module, r.recordId)}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <Tag tone={meta.tone}>{meta.label}</Tag>
                <div className="mt-1 text-[13px] font-medium text-[var(--color-text)] leading-snug">{r.title}</div>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function DashPane({
  dash,
  onOpen,
}: {
  dash: Record<string, unknown> | null;
  onOpen: (module: string, id?: string | null) => void;
}) {
  const kpis = (dash?.kpis as Record<string, number>) || {};
  const risks = (dash?.risks as Risk[]) || [];
  const opps = (dash?.opportunities as Opportunity[]) || [];

  return (
    <div className="p-5 sm:p-6 space-y-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Operations</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--color-text)]">Today’s risks & opportunities</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-[var(--color-text-secondary)]">
            SLA exceptions that still need an owner, context and a next action. Click through to the live record — this is
            not a separate reporting product.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {Object.entries(kpis).map(([key, value]) => {
          const meta = KPI_META[key];
          const Icon = meta?.icon || ClipboardList;
          return (
            <button
              key={key}
              type="button"
              onClick={() => meta && onOpen(meta.href.replace(/^\//, ""))}
              className="group text-left rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]",
                    meta?.wash || "bg-[var(--color-surface-muted)]",
                    meta?.iconColor || "text-[var(--color-text-muted)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-border-strong)] group-hover:text-[var(--color-accent)] transition-colors" />
              </div>
              <div className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-[var(--color-text)]">{value}</div>
              <div className="mt-1 text-[13px] font-medium text-[var(--color-text)]">{kpiLabel(key)}</div>
              <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)] leading-snug">{meta?.hint}</div>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--color-text)]">Risks that need action</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Aging jobs, silent clients, overdue feedback and commercial dates</p>
            </div>
            <span className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger)]">
              {risks.length}
            </span>
          </div>
          {risks.length ? (
            <ul className="divide-y divide-[var(--color-border)]">
              {risks.map((r) => {
                const meta = riskMeta(r.type);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-[var(--color-surface-muted)] cursor-pointer transition-colors"
                      onClick={() => onOpen(r.module, r.recordId)}
                    >
                      <span className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--color-danger)]" />
                      <span className="min-w-0 flex-1">
                        <Tag tone={meta.tone}>{meta.label}</Tag>
                        <div className="mt-1 text-[13px] font-medium text-[var(--color-text)] leading-snug">{r.title}</div>
                      </span>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-[var(--color-border-strong)]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--color-success)]" />
              <p className="mt-2 text-sm font-medium text-[var(--color-text)]">Queue is clear</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">No SLA breaches in this tenant right now.</p>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-success-bg)]">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--color-text)]">Opportunities</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Work you can convert today</p>
            </div>
            <Sparkles className="h-4 w-4 text-[var(--color-success)]" />
          </div>
          {opps.length ? (
            <ul className="p-3 space-y-2">
              {opps.map((o) => (
                <li key={o.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5">
                  <p className="text-[13px] font-medium text-[var(--color-text)] leading-snug">{o.title}</p>
                  <Button
                    className="mt-3"
                    onClick={() => onOpen(o.module || "candidates", o.recordId)}
                  >
                    Find candidates
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No open opportunities queued.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
