"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, FieldInput, FieldSelect, Label, Tag, Tabs, cn } from "./workspace-ui";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  title: string;
  enabled: boolean;
  role: string;
  extraPermissions: string[];
  vioTalkMapped: boolean;
  vioTalkUserId: string;
  assignedNumber: string;
  mailboxMapped: boolean;
  mailbox: string;
  passwordSet?: boolean;
  passwordSetAt?: string | null;
  inviteStatus?: "not_invited" | "pending" | "expired" | "accepted";
  invitePending?: boolean;
  inviteSentAt?: string | null;
  inviteExpiresAt?: string | null;
  resetPending?: boolean;
  resetExpiresAt?: string | null;
};

const INVITE_STATUS: Record<
  NonNullable<AdminUser["inviteStatus"]>,
  { label: string; tone: "slate" | "green" | "amber" | "red" }
> = {
  not_invited: { label: "Not invited", tone: "slate" },
  pending: { label: "Invite pending", tone: "amber" },
  expired: { label: "Invite expired", tone: "red" },
  accepted: { label: "Invite accepted", tone: "green" },
};

export function inviteStatusMeta(status?: AdminUser["inviteStatus"]) {
  return INVITE_STATUS[status || "not_invited"];
}

type ExceptionRow = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  status: string;
  payload: string;
  createdAt: string;
};

type AuditRow = {
  id: string;
  actorId?: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before: string;
  after: string;
  createdAt: string;
};

type JnpStatus = {
  oneWayIn?: boolean;
  writeBack?: boolean;
  copy?: string;
  lastException?: { kind: string; title: string; detail: string; status: string; createdAt: string } | null;
  lastSync?: { externalId: string; lastSyncedAt: string; syncStatus: string } | null;
  secretsVault?: { name: string; present: boolean }[];
  adapterStatus?: string;
};

const TABS = ["User details", "VioTalk map", "Mailbox map", "JNP sync", "Queues", "Audit"] as const;
const ROLES = ["recruiter", "sales", "operations", "leadership", "admin"] as const;
const QUEUE_KINDS = ["unmatched_mail", "unmatched_call", "duplicate", "failed_sync"] as const;
const EXTRA_PERMS = ["recording", "export"] as const;

const ROLE_LABEL: Record<string, string> = {
  recruiter: "Recruiter",
  sales: "Sales",
  operations: "Operations",
  leadership: "Leadership",
  admin: "Admin",
};

const KIND_LABEL: Record<string, string> = {
  unmatched_mail: "Unmatched mail",
  unmatched_call: "Unmatched call",
  duplicate: "Duplicate",
  failed_sync: "Failed sync",
};

function yesNo(v: boolean) {
  return v ? "Yes" : "No";
}

function fmtTime(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function parseJson(raw: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function pretty(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    const parsed = parseJson(value);
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
  }
  return JSON.stringify(value, null, 2);
}

export function SettingsPane({
  data,
  session,
  busy,
  selectedUserId,
  onAction,
}: {
  data: Record<string, unknown> | null;
  session: { userId?: string; permissions: string[]; role?: string; recordingPlaybackAllowed?: boolean } | null;
  busy: boolean;
  selectedUserId?: string | null;
  onAction: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("User details");
  const [queueKind, setQueueKind] = useState<string>("all");
  const [openExceptionId, setOpenExceptionId] = useState<string | null>(null);
  const [auditQ, setAuditQ] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [jnpId, setJnpId] = useState("JNP-104582");
  const [jnpBanner, setJnpBanner] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    title: "",
    role: "recruiter",
    enabled: true,
    extraPermissions: [] as string[],
  });
  const [vioDrafts, setVioDrafts] = useState<Record<string, { vioTalkUserId: string; assignedNumber: string }>>({});
  const [mailDrafts, setMailDrafts] = useState<Record<string, string>>({});
  const [inviteNotice, setInviteNotice] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");

  const admin = Boolean(session?.permissions.includes("admin") || session?.role === "admin");
  const users = (Array.isArray(data?.users) ? data.users : []) as AdminUser[];
  const selected = users.find((u) => u.id === selectedUserId) ?? null;
  const isSelf = Boolean(session?.userId && selected?.id === session.userId);
  const exceptions = (Array.isArray(data?.exceptions) ? data.exceptions : []) as ExceptionRow[];
  const auditEvents = (Array.isArray(data?.auditEvents) ? data.auditEvents : []) as AuditRow[];
  const settings = (data?.settings || {}) as { recordingPlaybackAllowed?: boolean };
  const jnp = (data?.jnp || {}) as JnpStatus;
  const playbackAllowed = Boolean(settings.recordingPlaybackAllowed);
  const canPlay = playbackAllowed && Boolean(session?.permissions.includes("recording"));

  useEffect(() => {
    setVioDrafts(
      Object.fromEntries(users.map((u) => [u.id, { vioTalkUserId: u.vioTalkUserId, assignedNumber: u.assignedNumber }])),
    );
    setMailDrafts(Object.fromEntries(users.map((u) => [u.id, u.mailbox])));
  }, [data]);

  useEffect(() => {
    const selected = users.find((u) => u.id === selectedUserId);
    if (!selected) return;
    setEditForm({
      name: selected.name,
      title: selected.title,
      role: selected.role,
      enabled: selected.enabled,
      extraPermissions: selected.extraPermissions.filter((p) => (EXTRA_PERMS as readonly string[]).includes(p)),
    });
    setAdminPassword("");
    setAdminPasswordConfirm("");
    setInviteNotice("");
  }, [selectedUserId, data]);

  const filteredQueues = useMemo(
    () => (queueKind === "all" ? exceptions : exceptions.filter((e) => e.kind === queueKind)),
    [exceptions, queueKind],
  );

  const filteredAudit = useMemo(() => {
    const q = auditQ.trim().toLowerCase();
    return auditEvents.filter((e) => {
      if (selectedUserId && e.entityId !== selectedUserId && e.actorId !== selectedUserId) return false;
      if (auditFilter === "wrap-up" && e.action !== "wrap_up") return false;
      if (auditFilter === "submit" && e.action !== "submit_profile") return false;
      if (auditFilter === "ownership" && !e.action.startsWith("ownership")) return false;
      if (
        auditFilter === "role-map" &&
        !["admin_create_user", "admin_update_user", "admin_upsert_viotalk_map", "admin_upsert_mailbox_map"].includes(
          e.action,
        )
      ) {
        return false;
      }
      if (q) {
        const hay = `${e.actorName} ${e.action} ${e.entityType} ${e.entityId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditEvents, auditFilter, auditQ, selectedUserId]);

  if (session && !admin) {
    return (
      <div className="p-8 text-sm text-slate-600">
        Settings is administrator-only. Restricted fields stay omitted rather than 403ing the workspace.
      </div>
    );
  }
  if (data?.forbidden) {
    return <div className="p-8 text-sm text-slate-600">Settings hidden for this role.</div>;
  }
  if (!data) {
    return <div className="p-8 text-sm text-slate-500">Loading administrator workspace…</div>;
  }

  function toggleExtra(list: string[], perm: string) {
    return list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm];
  }

  async function saveUser() {
    if (!selectedUserId) return;
    await onAction({
      action: "admin_update_user",
      userId: selectedUserId,
      ...editForm,
    });
  }

  async function disableUser() {
    if (!selectedUserId) return;
    await onAction({ action: "admin_update_user", userId: selectedUserId, enabled: false });
  }

  async function sendPasswordEmail(kind: "invite" | "reset") {
    if (!selectedUserId || isSelf) return;
    setInviteNotice("");
    const result = (await onAction({
      action: "admin_send_password_email",
      userId: selectedUserId,
      kind,
    })) as { sent?: boolean; stub?: boolean; previewUrl?: string; email?: string } | null;
    if (!result) return;
    if (result.sent) {
      setInviteNotice(
        kind === "invite" ? `Invitation email sent via SendGrid.` : `Password reset email sent via SendGrid.`,
      );
    } else if (result.stub && result.previewUrl) {
      setInviteNotice(
        `SendGrid is not configured. ${kind === "invite" ? "Invitation" : "Reset"} link for local testing: ${result.previewUrl}`,
      );
    } else {
      setInviteNotice("Email was not sent. Check SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.");
    }
  }

  async function setUserPassword() {
    if (!selectedUserId || isSelf) return;
    setInviteNotice("");
    if (adminPassword !== adminPasswordConfirm) {
      setInviteNotice("Passwords do not match");
      return;
    }
    const result = await onAction({
      action: "admin_set_password",
      userId: selectedUserId,
      password: adminPassword,
    });
    if (result) {
      setAdminPassword("");
      setAdminPasswordConfirm("");
      setInviteNotice("Password saved. The user can sign in with email and password.");
    }
  }

  async function syncPortal() {
    setJnpBanner("");
    const result = (await onAction({ action: "jnp_sync", portalCandidateId: jnpId })) as
      | { status?: string; existingId?: string }
      | null;
    if (!result) return;
    if (result.status === "collision") {
      setJnpBanner(
        `Collision on portal ${jnpId} — existing record ${result.existingId || ""}. Never auto-merged; sent to the duplicate queue.`,
      );
    } else if (result.status === "upserted") {
      setJnpBanner(`Synced ${jnpId} one-way in. No write-back to JobsNProfiles.`);
    }
  }

  const openException = filteredQueues.find((e) => e.id === openExceptionId) ?? null;

  return (
    <div className="min-h-full bg-[var(--color-surface)]">
      <header className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Settings</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Administrator workspace for this tenant. VioTalk number inventory stays in VioTalk; TalentBridge only maps
          user → agent / mailbox.
        </p>
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">
          <span className="font-medium text-[var(--color-text)]">Privacy. </span>
          Candidates, clients and vendors never log in. DNC blocks outbound call, WhatsApp and email. Search snippets
          strip restricted values. Leadership Communication review is in-tenant, not public monitoring. Recordings and
          MSA files store a <span className="font-medium">reference</span>
          {canPlay ? " — playback permission is on for this tenant." : " — do not play in POC unless policy and recording permission are both on."}
          <span className="ml-3 inline-flex items-center gap-2 align-middle">
            <span className="uppercase tracking-wide text-[10px] text-[var(--color-text-muted)]">Recording playback</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction({ action: "admin_set_recording_policy", allowed: !playbackAllowed })}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors cursor-pointer disabled:opacity-40",
                playbackAllowed ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]",
              )}
              title={playbackAllowed ? "Playback allowed (still no file player in POC)" : "Store reference only"}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  playbackAllowed && "translate-x-4",
                )}
              />
            </button>
            <span>{playbackAllowed ? "On" : "Off"}</span>
          </span>
        </div>
      </header>

      <Tabs items={[...TABS]} value={tab} onChange={(t) => setTab(t as (typeof TABS)[number])} />

      <div className="p-4 sm:p-5 space-y-5">
        {tab === "User details" ? (
          <div className="space-y-5">
            {selected ? (
              <section>
                <div className="flex items-start gap-3 mb-5">
                  <Avatar name={selected.name} size={56} />
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selected.name}
                      {isSelf ? <span className="ml-2 text-xs font-medium text-slate-500">You</span> : null}
                    </h2>
                    <p className="text-sm text-slate-600">{selected.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Tag tone="slate">{ROLE_LABEL[selected.role] ?? selected.role}</Tag>
                      <Tag tone={selected.enabled ? "green" : "slate"}>{selected.enabled ? "Enabled" : "Disabled"}</Tag>
                      <Tag tone={inviteStatusMeta(selected.inviteStatus).tone}>
                        {inviteStatusMeta(selected.inviteStatus).label}
                      </Tag>
                      <Tag tone={selected.passwordSet ? "green" : "slate"}>
                        {selected.passwordSet ? "Password set" : "No password"}
                      </Tag>
                      {selected.resetPending ? <Tag tone="amber">Reset pending</Tag> : null}
                      <Tag tone={selected.vioTalkMapped ? "green" : "slate"}>
                        VioTalk {selected.vioTalkMapped ? "mapped" : "unmapped"}
                      </Tag>
                      <Tag tone={selected.mailboxMapped ? "green" : "slate"}>
                        Mailbox {selected.mailboxMapped ? "mapped" : "unmapped"}
                      </Tag>
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Update user</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label>Name</Label>
                    <FieldInput value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Title</Label>
                    <FieldInput value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <FieldSelect
                      disabled={isSelf}
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </FieldSelect>
                  </div>
                  <div>
                    <Label>Enabled</Label>
                    <FieldSelect
                      disabled={isSelf}
                      value={editForm.enabled ? "yes" : "no"}
                      onChange={(e) => setEditForm({ ...editForm, enabled: e.target.value === "yes" })}
                    >
                      <option value="yes">Enabled</option>
                      <option value="no">Disabled</option>
                    </FieldSelect>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {EXTRA_PERMS.map((p) => (
                    <label
                      key={p}
                      className={cn(
                        "flex items-center gap-1.5 text-[13px] text-slate-700",
                        isSelf && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <input
                        type="checkbox"
                        disabled={isSelf}
                        checked={editForm.extraPermissions.includes(p)}
                        onChange={() =>
                          setEditForm({ ...editForm, extraPermissions: toggleExtra(editForm.extraPermissions, p) })
                        }
                      />
                      Grant {p}
                    </label>
                  ))}
                  <Button disabled={busy} onClick={saveUser}>
                    Save
                  </Button>
                  {editForm.enabled && !isSelf ? (
                    <Button variant="danger" disabled={busy} onClick={disableUser}>
                      Disable user
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {isSelf
                    ? "You cannot change your own role, extra permissions, or enabled status. Another administrator must do that."
                    : "Disable instead of delete. The last administrator cannot be disabled."}
                </p>
                <div className="mt-5 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900">Invitation & password</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Invitation</dt>
                          <dd className="text-slate-900">{inviteStatusMeta(selected.inviteStatus).label}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Password</dt>
                          <dd className="text-slate-900">
                            {selected.passwordSet
                              ? selected.passwordSetAt
                                ? `Set · ${fmtTime(selected.passwordSetAt)}`
                                : "Set"
                              : "Not set"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Invitation sent</dt>
                          <dd className="text-slate-900">{selected.inviteSentAt ? fmtTime(selected.inviteSentAt) : "Never"}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                            {selected.resetPending ? "Reset link expires" : "Invite link expires"}
                          </dt>
                          <dd className="text-slate-900">
                            {selected.resetPending && selected.resetExpiresAt
                              ? fmtTime(selected.resetExpiresAt)
                              : selected.inviteStatus === "pending" && selected.inviteExpiresAt
                                ? fmtTime(selected.inviteExpiresAt)
                                : selected.inviteStatus === "expired" && selected.inviteExpiresAt
                                  ? `Expired ${fmtTime(selected.inviteExpiresAt)}`
                                  : "—"}
                          </dd>
                        </div>
                      </dl>
                      {isSelf ? (
                        <p className="text-xs text-slate-500">
                          You cannot send a reset, invitation, or set a password on your own account. Another administrator must do that.
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-slate-600">
                            Invitation status stays on this user: pending, expired, or accepted after they set a password.
                            Reset sends a SendGrid email. You can also set a password here.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {!selected.passwordSet ? (
                              <Button variant="secondary" disabled={busy || !selected.enabled} onClick={() => sendPasswordEmail("invite")}>
                                {selected.inviteSentAt ? "Resend invitation" : "Send invitation"}
                              </Button>
                            ) : null}
                            <Button variant="secondary" disabled={busy || !selected.enabled} onClick={() => sendPasswordEmail("reset")}>
                              Send reset email
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                            <div>
                              <Label>New password</Label>
                              <FieldInput
                                type="password"
                                autoComplete="new-password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Confirm password</Label>
                              <FieldInput
                                type="password"
                                autoComplete="new-password"
                                value={adminPasswordConfirm}
                                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                              />
                            </div>
                            <div>
                              <Button disabled={busy} onClick={setUserPassword}>
                                Set password
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                      {inviteNotice ? (
                        <p className="text-xs text-slate-700 break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          {inviteNotice}
                        </p>
                      ) : null}
                    </div>
              </section>
            ) : (
              <p className="text-sm text-slate-500">Select a user from the list, or click Add user in the header.</p>
            )}
          </div>
        ) : null}

        {tab === "VioTalk map" ? (
          !selected ? (
            <p className="text-sm text-slate-500">Select a user from the list to map their VioTalk agent.</p>
          ) : (
          <section>
            <h2 className="text-sm font-semibold text-slate-900">VioTalk map · {selected.name}</h2>
            <p className="text-xs text-slate-600 mb-3">
              Number inventory stays in VioTalk. Unmapped users cannot Call. Do not administer numbers here.
            </p>
            {(() => {
              const draft = vioDrafts[selected.id] || { vioTalkUserId: "", assignedNumber: "" };
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                  <div>
                    <Label>VioTalk user ID</Label>
                    <FieldInput
                      value={draft.vioTalkUserId}
                      onChange={(e) =>
                        setVioDrafts({ ...vioDrafts, [selected.id]: { ...draft, vioTalkUserId: e.target.value } })
                      }
                      placeholder="vt-user"
                    />
                  </div>
                  <div>
                    <Label>Assigned number</Label>
                    <FieldInput
                      value={draft.assignedNumber}
                      onChange={(e) =>
                        setVioDrafts({ ...vioDrafts, [selected.id]: { ...draft, assignedNumber: e.target.value } })
                      }
                      placeholder="+1-800-555-0100"
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        onAction({
                          action: "admin_upsert_viotalk_map",
                          userId: selected.id,
                          vioTalkUserId: draft.vioTalkUserId,
                          assignedNumber: draft.assignedNumber,
                        })
                      }
                    >
                      Save map
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || !selected.vioTalkMapped}
                      onClick={() => onAction({ action: "admin_upsert_viotalk_map", userId: selected.id, clear: true })}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              );
            })()}
          </section>
          )
        ) : null}

        {tab === "Mailbox map" ? (
          !selected ? (
            <p className="text-sm text-slate-500">Select a user from the list to map their Outlook mailbox.</p>
          ) : (
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Mailbox map · {selected.name}</h2>
            <p className="text-xs text-slate-600 mb-3">Unmapped users cannot Submit Profile.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl items-end">
              <div className="sm:col-span-2">
                <Label>Mailbox</Label>
                <FieldInput
                  value={mailDrafts[selected.id] || ""}
                  onChange={(e) => setMailDrafts({ ...mailDrafts, [selected.id]: e.target.value })}
                  placeholder={selected.email}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    onAction({ action: "admin_upsert_mailbox_map", userId: selected.id, mailbox: mailDrafts[selected.id] || "" })
                  }
                >
                  Save map
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || !selected.mailboxMapped}
                  onClick={() => onAction({ action: "admin_upsert_mailbox_map", userId: selected.id, clear: true })}
                >
                  Clear
                </Button>
              </div>
            </div>
          </section>
          )
        ) : null}

        {tab === "JNP sync" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">JobsNProfiles sync status</h2>
              <p className="text-xs text-slate-600 mt-1">{jnp.copy}</p>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Direction</dt>
                <dd className="text-slate-900">One-way in · no write-back</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Last sync</dt>
                <dd className="text-slate-900">
                  {jnp.lastSync
                    ? `${jnp.lastSync.externalId} · ${fmtTime(jnp.lastSync.lastSyncedAt)} · ${jnp.lastSync.syncStatus}`
                    : "None yet"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Last exception</dt>
                <dd className="text-slate-900">
                  {jnp.lastException
                    ? `${jnp.lastException.title} · ${KIND_LABEL[jnp.lastException.kind] ?? jnp.lastException.kind} · ${jnp.lastException.status}`
                    : "None"}
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Secrets vault</h3>
              <p className="text-xs text-slate-600 mb-2">{jnp.adapterStatus}</p>
              <ul className="text-[13px] space-y-1">
                {(jnp.secretsVault || []).map((s) => (
                  <li key={s.name} className="flex items-center gap-2">
                    <Tag tone={s.present ? "green" : "red"}>{s.present ? "Present" : "Missing"}</Tag>
                    <span className="text-slate-800">{s.name}</span>
                    <span className="text-slate-500">— value never shown</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="max-w-md space-y-2">
              <Label>Portal candidate ID</Label>
              <FieldInput value={jnpId} onChange={(e) => setJnpId(e.target.value)} />
              <Button disabled={busy} onClick={syncPortal}>
                Sync portal ID
              </Button>
              {jnpBanner ? (
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs",
                    jnpBanner.startsWith("Collision")
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900",
                  )}
                >
                  {jnpBanner}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "Queues" ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Kind</Label>
                <FieldSelect value={queueKind} onChange={(e) => setQueueKind(e.target.value)} wrapClassName="w-52">
                  <option value="all">All queues</option>
                  {QUEUE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </FieldSelect>
              </div>
              <div className="text-xs text-slate-500">{filteredQueues.length} item{filteredQueues.length === 1 ? "" : "s"}</div>
            </div>
            <div className="overflow-x-auto border-t border-slate-200">
              <table className="w-full text-[13px] text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Kind</th>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueues.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 align-top">
                      <td className="py-2 pr-3">{KIND_LABEL[e.kind] ?? e.kind}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="text-left text-blue-700 hover:underline cursor-pointer"
                          onClick={() => setOpenExceptionId(openExceptionId === e.id ? null : e.id)}
                        >
                          {e.title}
                        </button>
                        {e.detail ? <div className="text-xs text-slate-500 mt-0.5">{e.detail}</div> : null}
                      </td>
                      <td className="py-2 pr-3">
                        <Tag tone={e.status === "open" ? "amber" : "green"}>{e.status}</Tag>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{fmtTime(e.createdAt)}</td>
                      <td className="py-2">
                        {e.status === "open" ? (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => onAction({ action: "admin_resolve_exception", exceptionId: e.id })}
                          >
                            Mark reviewed
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredQueues.length ? (
                <div className="py-8 text-sm text-slate-500">No exceptions in this queue.</div>
              ) : null}
            </div>
            {openException ? (
              <div className="border-t border-slate-200 pt-3">
                <h3 className="text-sm font-semibold text-slate-900">Payload / linked record</h3>
                <pre className="mt-2 text-xs text-slate-800 whitespace-pre-wrap font-sans">
                  {pretty(openException.payload)}
                </pre>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "Audit" ? (
          <section className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label>Search</Label>
                <FieldInput
                  value={auditQ}
                  onChange={(e) => setAuditQ(e.target.value)}
                  placeholder="Actor, action, entity…"
                />
              </div>
              <div>
                <Label>Filter</Label>
                <FieldSelect value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}>
                  <option value="all">All events</option>
                  <option value="wrap-up">Wrap-up</option>
                  <option value="submit">Submit</option>
                  <option value="ownership">Ownership</option>
                  <option value="role-map">Role / map changes</option>
                </FieldSelect>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {selected ? `Events for ${selected.name} (as actor or subject). ` : null}
              Recording and MSA: reference only
              {canPlay ? " (policy on)." : " — playback is off for this tenant."} Files are not played in POC.
            </p>
            <div className="overflow-x-auto border-t border-slate-200">
              <table className="w-full text-[13px] text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Actor</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium">Entity</th>
                    <th className="py-2 font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 align-top">
                      <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{fmtTime(e.createdAt)}</td>
                      <td className="py-2 pr-3">{e.actorName}</td>
                      <td className="py-2 pr-3">{e.action.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {e.entityType} · {e.entityId.slice(0, 8)}
                      </td>
                      <td className="py-2 text-xs text-slate-600 max-w-xs truncate" title={pretty(e.after)}>
                        {auditAfterLabel(e)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredAudit.length ? <div className="py-8 text-sm text-slate-500">No matching audit events.</div> : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function auditAfterLabel(e: AuditRow) {
  const sensitive = /recording|msa|po|export/i.test(`${e.action} ${e.entityType} ${e.after}`);
  if (sensitive) {
    const parsed = parseJson(e.after);
    if (parsed && typeof parsed === "object") {
      const rec = parsed as Record<string, unknown>;
      const ref = rec.recordingRef || rec.callId || rec.number || rec.id;
      if (ref) return `Reference ${String(ref)}`;
    }
    return "Reference stored — no playback";
  }
  const parsed = parseJson(e.after);
  if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>;
    return Object.entries(rec)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`)
      .join(" · ");
  }
  return e.after || "—";
}

export function CreateUserForm({
  busy,
  onClose,
  onAction,
  onCreated,
}: {
  busy: boolean;
  onClose: () => void;
  onAction: (payload: Record<string, unknown>) => Promise<unknown>;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    role: "recruiter",
    extraPermissions: [] as string[],
  });
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  function toggleExtra(list: string[], perm: string) {
    return list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    const result = (await onAction({
      action: "admin_create_user",
      ...form,
    })) as { id?: string; invite?: { sent?: boolean; stub?: boolean; previewUrl?: string; error?: string } } | null;
    if (!result?.id) return;
    const invite = result.invite;
    if (invite?.error) {
      setNotice(invite.error);
      setPendingId(result.id);
      return;
    }
    if (invite?.stub && invite.previewUrl) {
      setNotice(`SendGrid is not configured. Invitation link: ${invite.previewUrl}`);
      setPendingId(result.id);
      return;
    }
    onCreated(result.id);
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <h2 className="text-lg font-semibold">Add user</h2>
      <p className="text-sm text-slate-600">
        Same tenant only. Roles are recruiter, sales, operations, leadership, or admin. An invitation email is sent to
        set their password.
      </p>
      <div>
        <Label>Name</Label>
        <FieldInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>Email</Label>
        <FieldInput type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <Label>Title</Label>
        <FieldInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <Label>Role</Label>
        <FieldSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </FieldSelect>
      </div>
      <div className="flex flex-wrap gap-4">
        {EXTRA_PERMS.map((p) => (
          <label key={p} className="flex items-center gap-1.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={form.extraPermissions.includes(p)}
              onChange={() => setForm({ ...form, extraPermissions: toggleExtra(form.extraPermissions, p) })}
            />
            Grant {p}
          </label>
        ))}
      </div>
      {notice ? <p className="text-xs text-slate-700 break-all">{notice}</p> : null}
      <div className="flex gap-2">
        {pendingId ? (
          <Button type="button" onClick={() => onCreated(pendingId)}>
            Done
          </Button>
        ) : (
          <Button type="submit" disabled={busy}>
            Create user
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
