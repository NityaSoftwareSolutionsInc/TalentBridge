"use client";

import { CalendarDays, FileText, Mail, Phone, X } from "lucide-react";
import { Avatar, Badge, cn, WhatsAppIcon } from "./workspace-ui";

export type GlobalHit = {
  id: string;
  name: string;
  module?: string;
  personId?: string;
  type?: string;
  title?: string;
  subtitle?: string;
  snippet?: string;
  company?: string;
  location?: string;
  skills?: string[];
  portalCandidateId?: string;
  availability?: string;
  chips?: { label: string; tone?: "slate" | "green" | "blue" }[];
  channel?: string;
  occurredAt?: string;
  fileKind?: string;
  updatedAt?: string;
};

const SECTIONS: { key: string; label: string; viewAll: string }[] = [
  { key: "candidates", label: "Candidates", viewAll: "candidates" },
  { key: "clients", label: "Clients", viewAll: "clients" },
  { key: "contacts", label: "Contacts", viewAll: "clients" },
  { key: "companies", label: "Companies", viewAll: "clients" },
  { key: "vendors", label: "Vendors", viewAll: "vendors" },
  { key: "conversations", label: "Conversations", viewAll: "communications" },
  { key: "documents", label: "Documents", viewAll: "candidates" },
];

function tokensOf(q: string) {
  return [...new Set(q.split(/[\s,+/]+/).map((s) => s.trim()).filter((s) => s.length >= 2))];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = tokensOf(query);
  if (!text) return null;
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        tokens.some((t) => part.toLowerCase() === t.toLowerCase()) ? (
          <span key={`${part}-${i}`} className="font-semibold text-blue-700">
            {part}
          </span>
        ) : (
          <span key={`${part}-${i}`}>{part}</span>
        ),
      )}
    </>
  );
}

function OrgMark({ name }: { name: string }) {
  const colors = ["#2563eb", "#0f766e", "#1d4ed8", "#334155"];
  const i = name.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % colors.length;
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-semibold text-white shrink-0"
      style={{ background: colors[i] }}
      aria-hidden
    >
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

function ChannelMark({ channel }: { channel?: string }) {
  const key = String(channel || "").toLowerCase();
  const wrap = "inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0";
  if (key === "whatsapp") {
    return (
      <span className={cn(wrap, "bg-emerald-50 text-emerald-700")}>
        <WhatsAppIcon className="h-4 w-4" />
      </span>
    );
  }
  if (key === "email" || key === "outlook") {
    return (
      <span className={cn(wrap, "bg-sky-50 text-sky-700")}>
        <Mail className="h-4 w-4" />
      </span>
    );
  }
  if (key === "meeting") {
    return (
      <span className={cn(wrap, "bg-indigo-50 text-indigo-700")}>
        <CalendarDays className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className={cn(wrap, "bg-blue-50 text-blue-700")}>
      <Phone className="h-4 w-4" />
    </span>
  );
}

function FileMark() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 shrink-0">
      <FileText className="h-4 w-4" />
    </span>
  );
}

function hitHref(row: GlobalHit) {
  const type = row.type || "person";
  const id = row.personId || row.id;
  return `/${row.module || "candidates"}?id=${id}&type=${type}`;
}

function ResultRow({
  row,
  query,
  section,
  onOpen,
}: {
  row: GlobalHit;
  query: string;
  section: string;
  onOpen: (href: string) => void;
}) {
  const skills = (row.skills || []).slice(0, 4);
  return (
    <button
      type="button"
      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 cursor-pointer"
      onClick={() => onOpen(hitHref(row))}
    >
      {section === "candidates" || section === "contacts" ? (
        <Avatar name={row.name} size={36} />
      ) : section === "clients" || section === "companies" || section === "vendors" ? (
        <OrgMark name={row.name} />
      ) : section === "conversations" ? (
        <ChannelMark channel={row.channel} />
      ) : (
        <FileMark />
      )}
      <div className="min-w-0 flex-1">
        {section === "conversations" ? (
          <div className="text-[12px] text-slate-500">
            <span className="font-medium text-slate-800">{row.channel || "Activity"}</span>
            {row.occurredAt ? <span> · {row.occurredAt}</span> : null}
          </div>
        ) : section === "documents" ? null : (
          <div className="text-[13px] font-semibold text-slate-900 truncate">{row.name}</div>
        )}
        {section === "candidates" ? (
          <div className="text-[12px] text-slate-600 truncate">
            <Highlight text={row.title || ""} query={query} />
          </div>
        ) : null}
        {section === "clients" || section === "vendors" ? (
          <div className="text-[12px] text-slate-600 truncate">
            <Highlight text={row.subtitle || row.title || ""} query={query} />
          </div>
        ) : null}
        {section === "contacts" ? (
          <div className="text-[12px] text-slate-600 truncate">
            <Highlight text={[row.title, row.company].filter(Boolean).join(" · ")} query={query} />
          </div>
        ) : null}
        {section === "conversations" ? (
          <div className="text-[12px] text-slate-600 line-clamp-2">
            <Highlight text={row.snippet || row.name} query={query} />
          </div>
        ) : null}
        {section === "documents" ? (
          <>
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              <Highlight text={row.name} query={query} />
            </div>
            <div className="text-[11px] text-slate-500">
              {(row.fileKind || "File").toUpperCase()}
              {row.updatedAt ? ` · Updated ${row.updatedAt}` : ""}
            </div>
          </>
        ) : null}
        {section === "candidates" || section === "companies" ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {skills.map((skill) => (
              <Badge key={skill} tone="blue">
                <Highlight text={skill} query={query} />
              </Badge>
            ))}
            {row.location ? (
              <Badge tone="slate">
                <Highlight text={row.location} query={query} />
              </Badge>
            ) : null}
            {row.portalCandidateId ? <Badge tone="slate">{row.portalCandidateId}</Badge> : null}
            {row.availability ? <Badge tone="green">{row.availability}</Badge> : null}
            {(row.chips || []).map((chip) => (
              <Badge key={chip.label} tone={chip.tone === "green" ? "green" : chip.tone === "blue" ? "blue" : "slate"}>
                {chip.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function GlobalSearchPanel({
  query,
  hits,
  onOpen,
  onViewAll,
  onClose,
}: {
  query: string;
  hits: Record<string, GlobalHit[]>;
  onOpen: (href: string) => void;
  onViewAll: (module: string) => void;
  onClose: () => void;
}) {
  const visible = SECTIONS.map((section) => ({
    ...section,
    rows: hits[section.key] || [],
  })).filter((section) => section.rows.length);
  const total = visible.reduce((n, section) => n + section.rows.length, 0);

  return (
    <div className="absolute z-30 left-0 right-0 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
      <div className="max-h-[min(70vh,560px)] overflow-auto py-1.5">
        {!total ? (
          <div className="px-4 py-6 text-[13px] text-slate-500">No matches for “{query}”.</div>
        ) : (
          visible.map((section) => (
            <section key={section.key} className="px-2 py-1">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.label}{" "}
                  <span className="tabular-nums text-slate-400">({section.rows.length})</span>
                </div>
                <button
                  type="button"
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                  onClick={() => onViewAll(section.viewAll)}
                >
                  View all
                </button>
              </div>
              <div className="space-y-0.5">
                {section.rows.map((row) => (
                  <ResultRow key={`${section.key}-${row.id}`} row={row} query={query} section={section.key} onOpen={onOpen} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-sans text-[10px] text-slate-600">Enter</kbd>{" "}
          opens the record in the workspace without leaving the page.
        </span>
        <button type="button" className="inline-flex items-center gap-1 hover:text-slate-700 cursor-pointer" onClick={onClose} aria-label="Close search">
          <X className="h-3 w-3" />
          Esc
        </button>
      </div>
    </div>
  );
}

export function firstHitHref(hits: Record<string, GlobalHit[]> | null) {
  if (!hits) return null;
  for (const section of SECTIONS) {
    const row = (hits[section.key] || [])[0];
    if (row) return hitHref(row);
  }
  return null;
}
