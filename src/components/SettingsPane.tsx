"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, FieldInput, FieldSelect, Label, SignaturePreview, Tag, Tabs, cn } from "./workspace-ui";
import { MAX_EMAIL_SIGNATURE_CHARS } from "@/lib/email-signature-html";
import { TbLoader } from "./TbLoader";

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
  emailSignatures?: { id: string; name: string; body: string; isDefault: boolean }[];
  emailSignatureName?: string;
  emailSignatureBody?: string;
  emailSignatureEnabled?: boolean;
  jnpMapped: boolean;
  jnpUserId: string;
  jnpEnabled: boolean;
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

type GraphStatus = {
  copy?: string;
  live?: boolean;
  lastIngest?: { lastSyncedAt: string; syncStatus: string } | null;
  adapterStatus?: string;
};

type JnpStatus = {
  jnpAccountUserId?: string;
  allowed?: boolean;
};

const ADMIN_TABS = ["User details", "VioTalk map", "Mailbox map", "Email signature", "JNP map", "Queues", "Audit"] as const;
const PERSONAL_TABS = ["Email signature"] as const;
type SettingsTab = (typeof ADMIN_TABS)[number];
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

function fmtDate(v: string) {
  const d = new Date(v.includes("T") ? v : `${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function jnpAuthMessage(result: { authenticated?: boolean; packageEndDate?: string | null } | null) {
  if (!result?.authenticated) return "";
  if (result.packageEndDate) return `Authenticated. Subscription is active until ${fmtDate(result.packageEndDate)}.`;
  return "Authenticated. This ID can pull candidates.";
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
  session: { userId?: string; permissions: string[]; role?: string; recordingPlaybackAllowed?: boolean; jnpAllowed?: boolean } | null;
  busy: boolean;
  selectedUserId?: string | null;
  onAction: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const admin = Boolean(session?.permissions.includes("admin") || session?.role === "admin");
  const personalMode = !admin;
  const [tab, setTab] = useState<SettingsTab>(personalMode ? "Email signature" : "User details");
  const [queueKind, setQueueKind] = useState<string>("all");
  const [openExceptionId, setOpenExceptionId] = useState<string | null>(null);
  const [auditQ, setAuditQ] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [editForm, setEditForm] = useState({
    name: "",
    title: "",
    role: "recruiter",
    enabled: true,
    extraPermissions: [] as string[],
  });
  const [vioDrafts, setVioDrafts] = useState<Record<string, { vioTalkUserId: string; assignedNumber: string }>>({});
  const [mailDrafts, setMailDrafts] = useState<Record<string, string>>({});
  const [sigEditId, setSigEditId] = useState<string | "new" | null>(null);
  const [sigDraft, setSigDraft] = useState({ name: "Default", body: "", isDefault: false });
  const [jnpUserDrafts, setJnpUserDrafts] = useState<Record<string, string>>({});
  const [jnpAccountDraft, setJnpAccountDraft] = useState("");
  const [jnpAuthNotice, setJnpAuthNotice] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [ingestNotice, setIngestNotice] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");

  const users = (Array.isArray(data?.users) ? data.users : []) as AdminUser[];
  const selected =
    users.find((u) => u.id === selectedUserId) ??
    (personalMode ? users.find((u) => u.id === session?.userId) ?? users[0] ?? null : null);
  const isSelf = Boolean(session?.userId && selected?.id === session.userId);
  const exceptions = (Array.isArray(data?.exceptions) ? data.exceptions : []) as ExceptionRow[];
  const auditEvents = (Array.isArray(data?.auditEvents) ? data.auditEvents : []) as AuditRow[];
  const settings = (data?.settings || {}) as { recordingPlaybackAllowed?: boolean; jnpAccountUserId?: string };
  const jnp = (data?.jnp || {}) as JnpStatus;
  const jnpAllowed = Boolean(session?.jnpAllowed ?? jnp.allowed);
  const graph = (data?.graph || {}) as GraphStatus;
  const playbackAllowed = Boolean(settings.recordingPlaybackAllowed);
  const canPlay = playbackAllowed && Boolean(session?.permissions.includes("recording"));
  const tabs = personalMode
    ? [...PERSONAL_TABS]
    : jnpAllowed
      ? [...ADMIN_TABS]
      : ADMIN_TABS.filter((item) => item !== "JNP map");

  useEffect(() => {
    if (personalMode && tab !== "Email signature") setTab("Email signature");
  }, [personalMode, tab]);

  useEffect(() => {
    if (!personalMode && !jnpAllowed && tab === "JNP map") setTab("User details");
  }, [jnpAllowed, personalMode, tab]);

  useEffect(() => {
    setVioDrafts(
      Object.fromEntries(users.map((u) => [u.id, { vioTalkUserId: u.vioTalkUserId, assignedNumber: u.assignedNumber }])),
    );
    setMailDrafts(Object.fromEntries(users.map((u) => [u.id, u.mailbox])));
    setJnpUserDrafts(Object.fromEntries(users.map((u) => [u.id, u.jnpUserId])));
    setSigEditId(null);
    setJnpAccountDraft(String((data?.settings as { jnpAccountUserId?: string } | undefined)?.jnpAccountUserId || (data?.jnp as JnpStatus | undefined)?.jnpAccountUserId || ""));
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
      if (auditFilter === "jnp" && e.action !== "jnp_sync") return false;
      if (auditFilter === "person" && !["create_person", "update_person", "add_note", "toggle_dnc"].includes(e.action))
        return false;
      if (auditFilter === "outlook" && !["send_email", "ingest_outlook"].includes(e.action)) return false;
      if (auditFilter === "teams" && e.action !== "schedule_meeting") return false;
      if (
        auditFilter === "access" &&
        !["view_file", "view_recording", "view_transcript", "view_msa", "view_po", "export"].includes(e.action)
      ) {
        return false;
      }
      if (auditFilter === "auth" && !["login", "login_failed", "logout", "password_set"].includes(e.action)) return false;
      if (
        auditFilter === "role-map" &&
        ![
          "admin_create_user",
          "admin_update_user",
          "admin_upsert_viotalk_map",
          "admin_upsert_mailbox_map",
          "admin_upsert_jnp_map",
          "admin_set_jnp_account",
          "admin_set_jnp_enabled",
          "admin_set_password",
          "admin_send_password_email",
          "password_set",
        ].includes(e.action)
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

  if (!data) {
    return <TbLoader variant="inline" hint={personalMode ? "Loading your settings" : "Loading administrator workspace"} />;
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

  async function authenticateJnp(kind: "organization" | "recruiter") {
    setJnpAuthNotice("");
    if (kind === "organization") {
      const result = (await onAction({ action: "admin_set_jnp_account", jnpAccountUserId: jnpAccountDraft })) as
        | { authenticated?: boolean; packageEndDate?: string | null }
        | null;
      setJnpAuthNotice(jnpAuthMessage(result));
      return;
    }
    if (!selected) return;
    const result = (await onAction({
      action: "admin_upsert_jnp_map",
      userId: selected.id,
      jnpUserId: jnpUserDrafts[selected.id] || "",
    })) as { authenticated?: boolean; packageEndDate?: string | null } | null;
    setJnpAuthNotice(jnpAuthMessage(result));
  }

  const openException = filteredQueues.find((e) => e.id === openExceptionId) ?? null;

  return (
    <div className="min-h-full bg-[var(--color-surface)]">
      <header className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          {personalMode ? "My settings" : "Settings"}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          {personalMode
            ? "Personal preferences for how you work in TalentBridge. Email signature is first — more options can land here later."
            : "Administrator workspace for this tenant. VioTalk number inventory stays in VioTalk; TalentBridge only maps user → agent / mailbox."}
        </p>
        {!personalMode ? (
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
        ) : null}
      </header>

      <Tabs items={[...tabs]} value={tab} onChange={(t) => setTab(t as SettingsTab)} />

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
                      <Tag tone={selected.jnpEnabled ? "green" : "slate"}>
                        JNP {selected.jnpEnabled ? "Enabled" : "Disabled"}
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
            <p className="text-xs text-slate-600 mb-3">Unmapped users cannot Submit Profile, send Outlook mail, or schedule Teams meetings.</p>
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
            <div className="mt-6 space-y-3 max-w-xl">
              <h3 className="text-sm font-semibold text-slate-900">Outlook / Teams (Microsoft Graph)</h3>
              <p className="text-xs text-slate-600">{graph.copy}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={graph.live ? "green" : "slate"}>{graph.live ? "Graph live" : "Graph stub"}</Tag>
                <span className="text-xs text-slate-500">
                  Last ingest{" "}
                  {graph.lastIngest?.lastSyncedAt ? `${fmtTime(graph.lastIngest.lastSyncedAt)} · ${graph.lastIngest.syncStatus}` : "none yet"}
                </span>
              </div>
              <p className="text-xs text-slate-600">{graph.adapterStatus}</p>
              <Button
                disabled={busy}
                onClick={async () => {
                  setIngestNotice("");
                  const result = (await onAction({ action: "ingest_outlook" })) as
                    | { created?: number; linked?: number; unmatched?: number; skipped?: number; adapter?: string }
                    | null;
                  if (result) {
                    setIngestNotice(
                      `Ingest (${result.adapter || "stub"}): ${result.created || 0} timeline, ${result.linked || 0} linked to submissions, ${result.unmatched || 0} unmatched, ${result.skipped || 0} skipped.`,
                    );
                  }
                }}
              >
                Ingest Outlook mail
              </Button>
              {ingestNotice ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{ingestNotice}</div>
              ) : null}
            </div>
          </section>
          )
        ) : null}

        {tab === "Email signature" ? (
          !selected ? (
            <p className="text-sm text-slate-500">
              {personalMode ? "Your user record is unavailable." : "Select a user to manage Outlook email signatures."}
            </p>
          ) : (
            <section className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {personalMode ? "Your email signatures" : `Email signatures · ${selected.name}`}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Keep multiple identity footers and mark one as default for Outlook send. Paste the same HTML you
                    use in Outlook — tables, logos, and images are sent as HTML, not as source text.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy || (selected.emailSignatures || []).length >= 10}
                  onClick={() => {
                    setSigEditId("new");
                    setSigDraft({
                      name: "New signature",
                      body: "",
                      isDefault: !(selected.emailSignatures || []).length,
                    });
                  }}
                >
                  Add signature
                </Button>
              </div>

              <div className="space-y-3">
                {(selected.emailSignatures || []).length === 0 && sigEditId !== "new" ? (
                  <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-6 text-sm text-slate-500">
                    No signatures yet. Add one to attach on Outlook send.
                  </p>
                ) : null}
                {(selected.emailSignatures || []).map((sig) => (
                  <div
                    key={sig.id || sig.name}
                    className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white"
                  >
                    {sigEditId === sig.id ? (
                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div className="min-w-[12rem] flex-1">
                            <Label>Signature name</Label>
                            <FieldInput
                              value={sigDraft.name}
                              onChange={(e) => setSigDraft({ ...sigDraft, name: e.target.value })}
                              placeholder="Default"
                            />
                          </div>
                          <label className="flex items-center gap-2 pb-2 text-[13px] text-slate-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                              checked={sigDraft.isDefault || sig.isDefault}
                              disabled={sig.isDefault}
                              onChange={(e) => setSigDraft({ ...sigDraft, isDefault: e.target.checked })}
                            />
                            Default
                          </label>
                        </div>
                        <div>
                          <Label>Signature body</Label>
                          <textarea
                            className="mt-1 h-44 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            value={sigDraft.body}
                            onChange={(e) => setSigDraft({ ...sigDraft, body: e.target.value })}
                            placeholder={"Paste Outlook HTML, or plain text:\nRegards,\nSarah Mitchell\nNorthstar Staffing"}
                          />
                          <p className="mt-1 text-[11px] text-slate-500">
                            {sigDraft.body.length}/{MAX_EMAIL_SIGNATURE_CHARS} · Outlook HTML tables and images send as they look in Outlook.
                          </p>
                        </div>
                        {sigDraft.body.trim() ? (
                          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                How it looks in Outlook
                              </p>
                            </div>
                            <SignaturePreview body={sigDraft.body} />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={busy}
                            onClick={() =>
                              onAction({
                                action: "upsert_email_signature",
                                id: sig.id,
                                userId: selected.id,
                                name: sigDraft.name,
                                body: sigDraft.body,
                                isDefault: sigDraft.isDefault || sig.isDefault,
                              })
                            }
                          >
                            Save
                          </Button>
                          <Button variant="secondary" disabled={busy} onClick={() => setSigEditId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{sig.name}</p>
                            {sig.isDefault ? <Tag tone="green">Default</Tag> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!sig.isDefault && sig.id ? (
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  onAction({
                                    action: "set_default_email_signature",
                                    id: sig.id,
                                    userId: selected.id,
                                  })
                                }
                              >
                                Make default
                              </Button>
                            ) : null}
                            <Button
                              variant="secondary"
                              disabled={busy || !sig.id}
                              onClick={() => {
                                setSigEditId(sig.id);
                                setSigDraft({ name: sig.name, body: sig.body, isDefault: sig.isDefault });
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy || !sig.id}
                              onClick={() =>
                                onAction({
                                  action: "delete_email_signature",
                                  id: sig.id,
                                  userId: selected.id,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="bg-white px-1 py-1">
                          {sig.body.trim() ? (
                            <SignaturePreview body={sig.body} />
                          ) : (
                            <p className="px-3 py-3 text-[12px] text-slate-500">(empty)</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {sigEditId === "new" ? (
                  <div className="space-y-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">New signature</p>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="min-w-[12rem] flex-1">
                        <Label>Signature name</Label>
                        <FieldInput
                          value={sigDraft.name}
                          onChange={(e) => setSigDraft({ ...sigDraft, name: e.target.value })}
                          placeholder="Default"
                        />
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-[13px] text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          checked={sigDraft.isDefault}
                          onChange={(e) => setSigDraft({ ...sigDraft, isDefault: e.target.checked })}
                        />
                        Set as default
                      </label>
                    </div>
                    <div>
                      <Label>Signature body</Label>
                      <textarea
                        className="mt-1 h-44 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                        value={sigDraft.body}
                        onChange={(e) => setSigDraft({ ...sigDraft, body: e.target.value })}
                        placeholder={"Paste Outlook HTML, or plain text:\nRegards,\nSarah Mitchell\nNorthstar Staffing"}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {sigDraft.body.length}/{MAX_EMAIL_SIGNATURE_CHARS} · Outlook HTML tables and images send as they look in Outlook.
                      </p>
                    </div>
                    {sigDraft.body.trim() ? (
                      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            How it looks in Outlook
                          </p>
                        </div>
                        <SignaturePreview body={sigDraft.body} />
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          onAction({
                            action: "upsert_email_signature",
                            userId: selected.id,
                            name: sigDraft.name,
                            body: sigDraft.body,
                            isDefault: sigDraft.isDefault,
                          })
                        }
                      >
                        Create signature
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setSigEditId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )
        ) : null}

        {tab === "JNP map" ? (
          <section>
            <h2 className="text-sm font-semibold text-slate-900">
              JobsNProfiles map{selected ? ` · ${selected.name}` : ""}
            </h2>
            <p className="text-xs text-slate-600 mb-3">
              Enable JobsNProfiles only for users who should pull candidates. The organization must be allowed by a platform administrator first. Access refreshes at sign-in (background) and again after 2 hours — not on every resume sync.
            </p>
            <div className="max-w-xl space-y-4">
              {selected ? (
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-medium text-slate-800">JobsNProfiles</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onAction({ action: "admin_set_jnp_enabled", userId: selected.id, enabled: !selected.jnpEnabled })
                    }
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors cursor-pointer disabled:opacity-40",
                      selected.jnpEnabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]",
                    )}
                    title={selected.jnpEnabled ? "Disable JobsNProfiles for this user" : "Enable JobsNProfiles for this user"}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                        selected.jnpEnabled && "translate-x-4",
                      )}
                    />
                  </button>
                  <span className="text-[13px] text-slate-700">{selected.jnpEnabled ? "Enabled" : "Disabled"}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select a user to enable or disable JobsNProfiles for them.</p>
              )}
              <div>
                <Label>Organization ID</Label>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <FieldInput
                      value={jnpAccountDraft}
                      onChange={(e) => setJnpAccountDraft(e.target.value)}
                      placeholder="Company admin ID"
                    />
                  </div>
                  <Button disabled={busy || !jnpAccountDraft.trim()} onClick={() => authenticateJnp("organization")}>
                    Authenticate
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || !settings.jnpAccountUserId}
                    onClick={async () => {
                      setJnpAuthNotice("");
                      const result = await onAction({ action: "admin_set_jnp_account", clear: true });
                      if (result) setJnpAuthNotice("Organization ID cleared.");
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Used when a user has no recruiter ID.</p>
              </div>
              {selected ? (
                <div>
                  <Label>Recruiter ID</Label>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <FieldInput
                        value={jnpUserDrafts[selected.id] || ""}
                        onChange={(e) => setJnpUserDrafts({ ...jnpUserDrafts, [selected.id]: e.target.value })}
                        placeholder="Recruiter user ID"
                      />
                    </div>
                    <Button
                      disabled={busy || !String(jnpUserDrafts[selected.id] || "").trim()}
                      onClick={() => authenticateJnp("recruiter")}
                    >
                      Authenticate
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || !selected.jnpMapped}
                      onClick={async () => {
                        setJnpAuthNotice("");
                        const result = await onAction({ action: "admin_upsert_jnp_map", userId: selected.id, clear: true });
                        if (result) setJnpAuthNotice("Recruiter ID cleared.");
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Optional. Overrides the organization ID for this user.</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select a user to authenticate a recruiter ID.</p>
              )}
              {jnpAuthNotice ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  {jnpAuthNotice}
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
                  <option value="person">Person / notes / DNC</option>
                  <option value="jnp">JNP candidate sync</option>
                  <option value="outlook">Outlook send / ingest</option>
                  <option value="teams">Teams meetings</option>
                  <option value="wrap-up">Wrap-up</option>
                  <option value="submit">Submit</option>
                  <option value="ownership">Ownership</option>
                  <option value="access">Views / downloads / export</option>
                  <option value="auth">Login / logout</option>
                  <option value="role-map">Role / map / password</option>
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
  const sensitive = /recording|transcript|msa|po|export|view_file/i.test(`${e.action} ${e.entityType} ${e.after}`);
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
        Same tenant only. Use a business email (not Gmail, Yahoo, Outlook.com, etc.). Roles are recruiter, sales,
        operations, leadership, or admin. An invitation email is sent to set their password.
      </p>
      <div>
        <Label>Name</Label>
        <FieldInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>Email</Label>
        <FieldInput
          type="email"
          required
          placeholder="name@yourcompany.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
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
