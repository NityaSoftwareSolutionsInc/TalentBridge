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
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <p className="mt-2 text-sm font-medium text-slate-800">No SLA risks right now</p>
        <p className="mt-1 text-xs text-slate-500">New aging jobs, silent clients and overdue feedback will land here.</p>
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
            className="w-full text-left px-3.5 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
            onClick={() => onOpen(r.module, r.recordId)}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <Tag tone={meta.tone}>{meta.label}</Tag>
                <div className="mt-1 text-[13px] font-medium text-slate-900 leading-snug">{r.title}</div>
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
    <div className="p-5 sm:p-7 space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Today’s risks & opportunities</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
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
              className="group text-left rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                    meta?.wash || "bg-slate-50",
                    meta?.iconColor || "text-slate-600",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</div>
              <div className="mt-1 text-[13px] font-medium text-slate-800">{kpiLabel(key)}</div>
              <div className="mt-0.5 text-[12px] text-slate-500 leading-snug">{meta?.hint}</div>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Risks that need action</h2>
              <p className="text-xs text-slate-500 mt-0.5">Aging jobs, silent clients, overdue feedback and commercial dates</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              {risks.length}
            </span>
          </div>
          {risks.length ? (
            <ul className="divide-y divide-slate-100">
              {risks.map((r) => {
                const meta = riskMeta(r.type);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => onOpen(r.module, r.recordId)}
                    >
                      <span className="mt-1 h-8 w-1 shrink-0 rounded-full bg-red-500/80" />
                      <span className="min-w-0 flex-1">
                        <Tag tone={meta.tone}>{meta.label}</Tag>
                        <div className="mt-1 text-[13px] font-medium text-slate-900 leading-snug">{r.title}</div>
                      </span>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-slate-800">Queue is clear</p>
              <p className="mt-1 text-xs text-slate-500">No SLA breaches in this tenant right now.</p>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 rounded-xl border border-emerald-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-emerald-50 bg-gradient-to-r from-emerald-50/80 to-white">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Opportunities</h2>
              <p className="text-xs text-slate-500 mt-0.5">Work you can convert today</p>
            </div>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          {opps.length ? (
            <ul className="p-3 space-y-2">
              {opps.map((o) => (
                <li key={o.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-[13px] font-medium text-slate-900 leading-snug">{o.title}</p>
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
              <p className="text-sm text-slate-500">No open opportunities queued.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
