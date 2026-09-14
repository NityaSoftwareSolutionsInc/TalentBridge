"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Button } from "./workspace-ui";

type TicketSummary = {
  id: string;
  subject: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  updatedAt: string;
};

type TicketDetail = TicketSummary & {
  messages: Array<{
    id: string;
    authorKind: string;
    body: string;
    createdAt: string;
    authorName: string;
  }>;
};

function fmt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HelpSupportPanel({
  supportMode,
  onClose,
}: {
  supportMode?: boolean;
  onClose: () => void;
}) {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("other");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadList() {
    const res = await fetch("/api/support-tickets");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load tickets");
      return;
    }
    setTickets(data.tickets || []);
  }

  async function loadDetail(id: string) {
    const res = await fetch(`/api/support-tickets/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load ticket");
      return;
    }
    setDetail(data.ticket);
  }

  useEffect(() => {
    void loadList();
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  async function createTicket(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create ticket");
      setSubject("");
      setBody("");
      setCreating(false);
      setSelectedId(data.ticket.id);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/support-tickets/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send reply");
      setReply("");
      setDetail(data.ticket);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-medium text-[13px]">Help & Support</div>
        <button type="button" className="text-[12px] text-[var(--color-text-muted)]" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mb-2 text-xs text-[var(--color-text-muted)]">
        File an issue for TalentBridge platform Support. Every call, email or meeting still needs wrap-up: Next Action,
        No Action Required, or Closed.
      </p>
      {error ? <p className="mb-2 text-[12px] text-red-700">{error}</p> : null}
      {supportMode ? (
        <p className="mb-2 text-[12px] text-amber-800">Read-only support access cannot file or reply to tickets.</p>
      ) : null}

      {creating ? (
        <form onSubmit={createTicket} className="space-y-2">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Category
            <select
              className="mt-1 h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 text-[13px]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="access">Access</option>
              <option value="integrations">Integrations</option>
              <option value="billing">Billing</option>
              <option value="bug">Bug</option>
              <option value="how_to">How to</option>
              <option value="other">Other</option>
            </select>
          </label>
          <input
            className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 text-[13px]"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
          <textarea
            className="min-h-[72px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1.5 text-[13px]"
            placeholder="Describe the issue"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || supportMode}>
              Submit ticket
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : detail ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto">
          <button type="button" className="text-[12px] text-[var(--color-accent)]" onClick={() => setSelectedId(null)}>
            Back to tickets
          </button>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-[13px]">{detail.subject}</p>
              <Badge tone={detail.status === "resolved" || detail.status === "closed" ? "green" : "amber"}>
                {detail.statusLabel}
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">{detail.categoryLabel}</p>
          </div>
          <div className="max-h-48 space-y-1.5 overflow-auto">
            {detail.messages.map((m) => (
              <div key={m.id} className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-2 py-1.5 text-[12px]">
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {m.authorName} · {fmt(m.createdAt)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
          {!supportMode ? (
            <form onSubmit={sendReply} className="space-y-2">
              <textarea
                className="min-h-[56px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1.5 text-[13px]"
                placeholder={
                  detail.status === "resolved" || detail.status === "closed"
                    ? "Reply to reopen this ticket"
                    : "Reply to Support"
                }
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                required
              />
              <Button type="submit" disabled={busy}>
                Send reply
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <>
          {!supportMode ? (
            <Button type="button" className="mb-2 w-full" onClick={() => setCreating(true)}>
              New ticket
            </Button>
          ) : null}
          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
            {tickets.length === 0 ? (
              <p className="text-[12px] text-[var(--color-text-muted)]">No tickets yet.</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="w-full rounded-[var(--radius-md)] px-2 py-1.5 text-left hover:bg-[var(--color-surface-muted)]"
                  onClick={() => setSelectedId(t.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{t.subject}</span>
                    <Badge tone={t.status === "resolved" || t.status === "closed" ? "green" : "amber"}>
                      {t.statusLabel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {t.categoryLabel} · {fmt(t.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
