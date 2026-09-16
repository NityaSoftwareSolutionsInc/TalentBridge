"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { availabilityBadge, Avatar, btnGhost, btnPrimary, Button, Card, CardHeader, cn, EmptyState, FieldInput, FieldSelect, IconBtn, IconButton, IconChip, IconOnly, InlineError, Label, LinkedInIcon, LoadingSkeleton, MenuItem, shortDate, SignaturePreview, Tag, tagTone, Tabs, TextLink, timeZoneHint, WhatsAppIcon } from "./workspace-ui";
import { MAX_EMAIL_SIGNATURE_CHARS } from "@/lib/email-signature-html";
import { AppShell } from "./AppShell";
import type { GlobalHit } from "./GlobalSearchPanel";
import { SettingsPane, CreateUserForm, inviteStatusMeta } from "./SettingsPane";
import { DashList, DashPane } from "./DashboardPane";
import { CalendarAgenda, CalendarPane, type CalendarItem } from "./CalendarPane";
import { ListPager } from "./ListPager";
import { ListToolbar, sortRecords } from "./ListToolbar";
import { paginate, parsePageSize, readStoredPageSize, storePageSize } from "@/lib/paging";
import { EMPLOYMENT_TYPE_OPTIONS, RELOCATE_OPTIONS, WORK_AUTH_OPTIONS } from "@/lib/candidate-fields";
import { buildJnpProfileUrl } from "@/lib/jnp-links";
import {
  Ban,
  Building2,
  CalendarDays,
  ChevronDown,
  CloudUpload,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  Star,
  StickyNote,
  UserRound,
  Video,
} from "lucide-react";

type Session = {
  userId: string;
  name: string;
  title: string;
  role: string;
  tenantName: string;
  permissions: string[];
  landing: string;
  vioTalkMapped: boolean;
  mailbox: string | null;
  jnpUserId?: string | null;
  jnpEnabled?: boolean;
  jnpAllowed?: boolean;
  jnpAccessOk?: boolean;
  jnpAccessCode?: string;
  emailSignatures?: { id: string; name: string; body: string; isDefault: boolean }[];
  emailSignatureName?: string;
  emailSignatureBody?: string;
  emailSignatureEnabled?: boolean;
  recordingPlaybackAllowed?: boolean;
};

type Drawer = "none" | "call" | "wrap" | "submit" | "note" | "email" | "meeting" | "jnp" | "req" | "create" | "create-user" | "edit";

export function Workspace({ moduleKey }: { moduleKey: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id") || "";
  const [session, setSession] = useState<Session | null>(null);
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarItem[]>([]);
  const [calendarPeople, setCalendarPeople] = useState<{ id: string; name: string; email: string; kind: string; title: string }[]>([]);
  const [calendarMeta, setCalendarMeta] = useState<{ graphLive?: boolean; mailbox?: string | null }>({});
  const [activityEvents, setActivityEvents] = useState<Record<string, unknown>[]>([]);
  const [requirements, setRequirements] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [globalHits, setGlobalHits] = useState<Record<string, GlobalHit[]> | null>(null);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<Drawer>("none");
  const [tab, setTab] = useState("Overview");
  const [commFocusId, setCommFocusId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [callActivityId, setCallActivityId] = useState<string | null>(null);
  const [wrapPersonId, setWrapPersonId] = useState<string | null>(null);
  const [proposed, setProposed] = useState("");
  const [badges, setBadges] = useState({ tasks: 0, communications: 0 });
  const [menu, setMenu] = useState<"none" | "help" | "user" | "more" | "bell" | "qa-more">("none");
  const [starred, setStarred] = useState(false);
  const [extraFilters, setExtraFilters] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    try {
      setNavCollapsed(window.localStorage.getItem("tb_nav_collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleNav = () => {
    setNavCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("tb_nav_collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const filters = useMemo(
    () => ({
      q: params.get("q") || "",
      title: params.get("title") || "",
      skills: params.get("skills") || "",
      location: params.get("location") || "",
      experience: params.get("experience") || "",
      owner: params.get("owner") || "",
      source: params.get("source") || "",
      availability: params.get("availability") || "",
      lastOutreach: params.get("lastOutreach") || "",
      excludeRequirementId: params.get("excludeRequirementId") || "",
      workAuthorization: params.get("workAuthorization") || "",
      sort: params.get("sort") || "",
    }),
    [params],
  );

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`/${moduleKey}?${next.toString()}`);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params.toString());
    [
      "q",
      "title",
      "skills",
      "location",
      "experience",
      "owner",
      "source",
      "availability",
      "lastOutreach",
      "excludeRequirementId",
      "workAuthorization",
      "sort",
    ].forEach((key) => next.delete(key));
    next.delete("page");
    router.replace(`/${moduleKey}?${next.toString()}`);
  };

  const page = Math.max(1, Number(params.get("page") || "1") || 1);
  const pageSize = parsePageSize(params.get("pageSize") || readStoredPageSize());
  const communicationThreads = useMemo(() => {
    if (moduleKey !== "communications") return [];
    const threads = buildPersonCommunicationThreads(activityEvents);
    const q = filters.q.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = [
        t.title,
        t.preview,
        t.person?.name,
        t.organization?.name,
        ...(t.channels || []).map(channelLabel),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [moduleKey, activityEvents, filters.q]);
  const listSource =
    moduleKey === "calendar"
      ? calendarEvents.filter((row) => {
          const q = filters.q.trim().toLowerCase();
          if (!q) return true;
          return [row.title, row.personName, row.organizationName, row.requirementTitle]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q);
        })
      : moduleKey === "tasks"
      ? tasks
      : moduleKey === "communications"
        ? (communicationThreads as unknown as Record<string, unknown>[])
        : moduleKey === "dashboard" || moduleKey === "reports"
          ? (((dash?.risks as unknown[]) || []) as Record<string, unknown>[]).filter((row) => {
              const q = filters.q.trim().toLowerCase();
              if (!q) return true;
              return String(row.title || "").toLowerCase().includes(q);
            })
          : list;
  const sortedSource = useMemo(
    () => (["candidates", "clients", "vendors"].includes(moduleKey) ? sortRecords(listSource, filters.sort) : listSource),
    [listSource, moduleKey, filters.sort],
  );
  const pageSlice = paginate(sortedSource, page, pageSize);

  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(nextPage));
    router.replace(`/${moduleKey}?${next.toString()}`);
  };
  const setPageSize = (size: number) => {
    storePageSize(size);
    const next = new URLSearchParams(params.toString());
    next.set("pageSize", String(size));
    next.set("page", "1");
    router.replace(`/${moduleKey}?${next.toString()}`);
  };

  const select = (id: string, type?: "person" | "organization") => {
    const next = new URLSearchParams(params.toString());
    if (!id) {
      next.delete("id");
      next.delete("type");
    } else {
      next.set("id", id);
      if (type) next.set("type", type);
      else next.delete("type");
    }
    router.replace(`/${moduleKey}?${next.toString()}`);
  };

  const load = useCallback(async () => {
    const qs = params.toString();
    const res = await fetch(`/api/workspace?module=${moduleKey}&${qs}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (data.list) setList(data.list);
    if (data.dashboard) setDash(data.dashboard);
    if (data.tasks) setTasks(data.tasks);
    if (data.calendar) {
      setCalendarEvents((data.calendar.events || []) as CalendarItem[]);
      setCalendarPeople((data.calendar.people || []) as { id: string; name: string; email: string; kind: string; title: string }[]);
      setCalendarMeta({ graphLive: Boolean(data.calendar.graphLive), mailbox: data.calendar.mailbox || null });
    }
    if (data.activityEvents) setActivityEvents(data.activityEvents);
    if (data.requirements) setRequirements(data.requirements);
    if (data.users) setUsers(data.users);
    if (data.settings || data.maps || data.users || data.mode) setSettings(data);
    if (data.items) setList(data.items);
    if (data.reports) setDash({ kpis: data.reports, risks: data.risks });
    if (data.badges) setBadges(data.badges);
  }, [moduleKey, params, router]);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        if (!d.session) router.push("/login");
        else setSession(d.session);
      });
  }, [router]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  const isAdmin = Boolean(session?.permissions?.includes("admin") || session?.role === "admin");
  const settingsPersonal = moduleKey === "settings" && !isAdmin;

  useEffect(() => {
    if (selectedId) return;
    if (moduleKey === "settings") {
      const settingsUsers = (settings?.users as { id: string }[] | undefined) || [];
      const selfId = session?.userId;
      const pick =
        (!isAdmin && selfId && settingsUsers.some((u) => u.id === selfId) ? selfId : null) ||
        (settingsUsers[0]?.id ?? null);
      if (!pick) return;
      const next = new URLSearchParams(params.toString());
      next.set("id", pick);
      router.replace(`/${moduleKey}?${next.toString()}`);
      return;
    }
    if (!list.length) return;
    if (!["candidates", "clients", "vendors"].includes(moduleKey)) return;
    const next = new URLSearchParams(params.toString());
    next.set("id", String(list[0].id));
    next.set("type", "person");
    router.replace(`/${moduleKey}?${next.toString()}`);
  }, [list, selectedId, moduleKey, params, router, settings, session?.userId, isAdmin]);

  useEffect(() => {
    if (!selectedId || ["settings", "calendar", "dashboard", "reports", "tasks", "communications", "msa-po"].includes(moduleKey)) {
      if (moduleKey === "calendar") setRecord(null);
      return;
    }
    const type = params.get("type") || "person";
    fetch(`/api/record?type=${type}&id=${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setRecord(d.record);
        setTab("Overview");
        const role = ((d.record?.companies as { role?: string }[]) || [])[0]?.role;
        setStarred(role === "Primary" || role === "Decision Maker");
      });
  }, [selectedId, moduleKey, params]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
      const sess = await fetch("/api/session").then((r) => r.json());
      if (sess.session) setSession(sess.session);
      if (selectedId) {
        const type = params.get("type") || (record?.type === "organization" ? "organization" : "person");
        const rec = await fetch(`/api/record?type=${type}&id=${selectedId}`).then((r) => r.json());
        setRecord(rec.record);
      }
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function exportOps() {
    const data = await act({ action: "export_dashboard" });
    if (!data?.csv) return;
    const blob = new Blob([String(data.csv)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = String(data.filename || "talentbridge-ops.csv");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onCall() {
    if (!selectedId) return;
    const data = await act({ action: "call", personId: selectedId });
    if (data) {
      setCallActivityId(data.activityId);
      setWrapPersonId(selectedId);
      setProposed(data.proposedFollowUp || "");
      setDrawer("wrap");
    }
  }

  async function signOut() {
    setMenu("none");
    setSession(null);
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/login?signedOut=1");
      router.refresh();
    }
  }

  async function searchGlobal(q: string) {
    if (q.length < 2) {
      setGlobalHits(null);
      return;
    }
    const res = await fetch(`/api/workspace?global=1&q=${encodeURIComponent(q)}`, {
      headers: { "x-tb-loader": "silent" },
    });
    const data = await res.json();
    setGlobalHits(data.results);
  }

  const clearGlobalHits = useCallback(() => setGlobalHits(null), []);

  const dnc = Boolean(record?.doNotReach);
  const canToggleDnc = ["sales", "operations", "admin"].includes(session?.role || "");
  const canPlayRecording = Boolean(session?.permissions.includes("recording") && session?.recordingPlaybackAllowed);
  const canJnpSync = Boolean(session?.jnpEnabled && session?.jnpUserId);
  const canViewMsa = Boolean(session?.permissions.includes("msa"));
  const canViewPo = Boolean(session?.permissions.includes("po"));
  const pendingOwnership = (
    (record?.ownershipRequests as {
      id: string;
      type: string;
      status?: string;
      note?: string;
      requester?: { name?: string };
    }[]) || []
  ).filter((r) => !r.status || r.status === "pending");
  const blockEmail = dnc || Boolean(record?.doNotEmail);
  const blockSms = dnc || Boolean(record?.doNotSms);
  const callBlocked = dnc || !session?.vioTalkMapped;
  const callWhy = !session?.vioTalkMapped
    ? "No VioTalk agent mapping. Users with no mapping cannot use VioTalk Call."
    : dnc
      ? "Do not reach is on — outbound call disabled."
      : "Call with VioTalk";
  const submitBlocked = blockEmail || !session?.mailbox;
  const submitWhy = !session?.mailbox
    ? "Outlook not connected — Settings → Connect Outlook"
    : blockEmail
      ? "Do not reach / Do Not Email is on — outbound email disabled."
      : "Submit Profile";
  const isCandidate = record?.kind === "candidate";
  const isOrganization = record?.type === "organization";
  const company = ((record?.companies as { id: string; name: string; role?: string; industry?: string; location?: string }[]) || [])[0];
  const peopleOnOrganization = (record?.people as { person: { id: string; name: string; title: string; status?: string }; roleOnOrganization?: string }[]) || [];
  const internalNotes = ((record?.activityEvents as Record<string, unknown>[]) || []).filter((a) => a.kind === "internal_note");
  const files = (record?.files as { name: string; source?: string; kind?: string; previewable?: boolean }[]) || [];
  const upcoming = (record?.upcoming as { id: string; title: string; dueAt?: string }[]) || [];
  const contactTags = ((record?.tags as string[]) || []).filter((t) => t && t !== record?.status);
  const avail = availabilityBadge(record?.availability, record?.status);
  const canSeeRates = Boolean(session?.permissions.includes("submit") || session?.permissions.includes("po"));
  const jnpUrl = buildJnpProfileUrl(record?.portalCandidateId);
  const relatedPeople = (() => {
    const rows: { id?: string; name: string; title: string; badge: string; tone: "blue" | "purple" | "amber" }[] = [];
    for (const s of ((record?.submissions as { clientPerson?: { id?: string; name?: string; title?: string } }[]) || [])) {
      if (s.clientPerson?.name) {
        rows.push({
          id: s.clientPerson.id,
          name: s.clientPerson.name,
          title: s.clientPerson.title || "Hiring Manager",
          badge: "Submitted",
          tone: "purple",
        });
      }
    }
    for (const p of peopleOnOrganization) {
      rows.push({ name: p.person.name, title: p.person.title, badge: p.roleOnOrganization || "Related", tone: "amber", id: p.person.id });
    }
    return rows.filter((row, i, all) => all.findIndex((r) => r.name === row.name) === i).slice(0, 8);
  })();

  const primaryAction =
    moduleKey === "settings" && isAdmin ? (
      <Button onClick={() => setDrawer("create-user")}>
        <Plus className="h-4 w-4" />
        Add user
      </Button>
    ) : moduleKey === "calendar" ? (
      <Button
        onClick={() => setDrawer("meeting")}
        disabled={!session?.mailbox}
        title={session?.mailbox ? "Schedule a Teams meeting" : "Outlook not connected — Settings → Connect Outlook"}
      >
        <CalendarDays className="h-4 w-4" />
        Schedule meeting
      </Button>
    ) : ["candidates", "clients", "vendors"].includes(moduleKey) ? (
      <Button onClick={() => setDrawer("create")}>
        <Plus className="h-4 w-4" />
        Add {moduleKey === "candidates" ? "Candidate" : moduleKey === "vendors" ? "Vendor person" : "Client person"}
      </Button>
    ) : undefined;

  return (
    <>
      <AppShell
        moduleKey={moduleKey}
        session={session}
        badges={badges}
        navCollapsed={navCollapsed}
        onToggleNav={toggleNav}
        menu={menu}
        onMenuChange={(next) => setMenu(next as typeof menu)}
        globalHits={globalHits}
        onSearchGlobal={searchGlobal}
        onClearHits={clearGlobalHits}
        onNavigate={(href) => router.push(href)}
        onSignOut={signOut}
        primaryAction={primaryAction}
      >
        <section className="w-[260px] lg:w-[300px] xl:w-[360px] shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col">
          {moduleKey === "settings" ? (
            <div className="px-3.5 pt-3 pb-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center gap-2 min-h-7">
                <h2 className="font-semibold text-[15px] leading-none text-[var(--color-text)]">
                  {settingsPersonal ? "My account" : "Users"}
                </h2>
                {!settingsPersonal ? (
                  <span className="shrink-0 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                    {((settings?.users as unknown[]) || []).length}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <ListToolbar
              moduleKey={moduleKey}
              total={pageSlice.total}
              filters={filters}
              extraOpen={extraFilters}
              users={users}
              requirements={requirements}
              onToggleExtra={() => setExtraFilters((v) => !v)}
              onFilter={setFilter}
              onClear={clearFilters}
            />
          )}
          <div className="flex-1 overflow-auto">
            {moduleKey === "dashboard" || moduleKey === "reports" ? (
              <DashList dash={dash ? { ...dash, risks: pageSlice.items } : dash} onOpen={(m, id) => router.push(id ? `/${m}?id=${id}` : `/${m}`)} />
            ) : moduleKey === "calendar" ? (
              <CalendarAgenda
                events={pageSlice.items as CalendarItem[]}
                selectedId={selectedId}
                onSelect={(id) => select(id)}
              />
            ) : moduleKey === "tasks" ? (
              pageSlice.items.map((t) => (
                <button key={String(t.id)} onClick={() => t.personId && router.push(`/candidates?id=${t.personId}&type=person`)} className="w-full text-left px-4 py-3 border-b hover:bg-slate-50 cursor-pointer">
                  <div className="text-sm font-medium">{String(t.title)}</div>
                  <div className="text-xs text-slate-500">{t.dueAt ? shortDate(t.dueAt) : "No due date"}</div>
                </button>
              ))
            ) : moduleKey === "communications" ? (
              pageSlice.items.map((row) => {
                const t = row as unknown as CommThread;
                const selected =
                  selectedId === t.id ||
                  (t.person?.id && selectedId === t.person.id) ||
                  t.messages.some((m) => String(m.id) === selectedId);
                const personName = t.person?.name || t.title || "Unknown contact";
                const primaryChannel = t.channels?.[0] || t.kind;
                const ChannelIcon = channelIcon(primaryChannel);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => select(t.id)}
                    className={`w-full text-left px-3 py-3 border-b cursor-pointer transition-colors ${
                      selected
                        ? "bg-blue-50/80 border-l-4 border-l-[var(--color-accent)]"
                        : "hover:bg-[var(--color-surface-muted)] border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex gap-3 items-start">
                      <Avatar name={personName} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className={`text-sm truncate ${t.unread ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>
                            {personName}
                          </div>
                          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)] tabular-nums">
                            {shortDate(t.lastAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
                          <ChannelIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{t.preview || "No preview"}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {t.unread ? (
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" title="Unread" />
                          ) : null}
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {t.messages.length} {t.messages.length === 1 ? "item" : "items"}
                          </span>
                          <span className="text-[11px] text-[var(--color-border-strong)]">·</span>
                          <span
                            className={`text-[11px] ${
                              t.wrapUp ? "text-[var(--color-text-muted)]" : "text-[var(--color-warning)]"
                            }`}
                          >
                            {wrapUpLabel(t.wrapUp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : moduleKey === "settings" ? (
              ((settings?.users as { id: string; name: string; email: string; role?: string; enabled?: boolean; passwordSet?: boolean; inviteStatus?: "not_invited" | "pending" | "expired" | "accepted"; resetPending?: boolean }[]) || []).map((u) => {
                const selected = selectedId === u.id;
                const roleLabel = String(u.role || "").replace(/^\w/, (c) => c.toUpperCase());
                const invite = inviteStatusMeta(u.inviteStatus);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => select(u.id)}
                    className={`w-full text-left px-3 py-3 border-b flex gap-3 items-start cursor-pointer ${
                      selected ? "bg-blue-50 border-l-4 border-l-[var(--color-accent)]" : "hover:bg-[var(--color-surface-muted)] border-l-4 border-l-transparent"
                    }`}
                  >
                    <Avatar name={u.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-600 truncate">{u.email}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Tag tone="slate">{roleLabel}</Tag>
                        <Tag tone={u.enabled === false ? "slate" : "green"}>{u.enabled === false ? "Disabled" : "Enabled"}</Tag>
                        <Tag tone={u.inviteStatus && u.inviteStatus !== "not_invited" ? invite.tone : u.passwordSet ? "green" : "slate"}>
                          {u.inviteStatus && u.inviteStatus !== "not_invited"
                            ? invite.label
                            : u.passwordSet
                              ? "Password set"
                              : "Not invited"}
                        </Tag>
                        {u.resetPending ? <Tag tone="amber">Reset pending</Tag> : null}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              pageSlice.items.map((row) => {
                const rowAvail = availabilityBadge(row.availability, row.status);
                const selected = selectedId === row.id;
                return (
                <div
                  key={String(row.id)}
                  className={`border-b flex items-stretch ${selected ? "bg-blue-50 border-l-4 border-l-[var(--color-accent)]" : "hover:bg-[var(--color-surface-muted)] border-l-4 border-l-transparent"}`}
                >
                <button
                  type="button"
                  onClick={() => select(String(row.id), "person")}
                  className="flex-1 min-w-0 text-left px-3 py-3 flex gap-3 cursor-pointer transition-colors"
                >
                  <Avatar name={String(row.name)} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 items-start">
                      <div className="font-semibold text-sm truncate">{String(row.name)}</div>
                      {moduleKey === "candidates" ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {row.workAuthorization ? <Tag tone="blue">{String(row.workAuthorization)}</Tag> : null}
                          <Tag tone={rowAvail.tone}>{rowAvail.label}</Tag>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 shrink-0">{shortDate(row.lastOutreachAt, true)}</div>
                      )}
                    </div>
                    {row.title || row.companyName ? (
                    <div className="text-xs text-slate-600 truncate">
                      {String(row.title || "")}
                      {row.companyName ? ` | ${String(row.companyName)}` : ""}
                    </div>
                    ) : null}
                    {moduleKey === "candidates" ? (
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1 truncate" title="Owner">
                          <UserRound className="h-3 w-3" />
                          Owner {String(row.ownerName || "")}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <Phone className="h-3 w-3" />
                          {shortDate(row.lastOutreachAt, true) || "—"}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <CalendarDays className="h-3 w-3" />
                          {shortDate(row.nextActionDueAt, true) || shortDate(row.lastOutreachAt, true) || "—"}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-600 truncate">
                        {String(row.ownerName || "")}
                        {row.nextAction ? ` · Next: ${String(row.nextAction)}` : ""}
                      </div>
                    )}
                    {moduleKey !== "candidates" ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {((row.tags as string[]) || []).filter(Boolean).slice(0, 3).map((t) => (
                          <Tag key={t} tone={tagTone(t)}>{t}</Tag>
                        ))}
                      </div>
                    ) : null}
                    {((row.previousSubmissions as { client: string; job: string; stage: string }[]) || []).slice(0, 1).map((s) => (
                      <div key={`${s.client}-${s.job}`} className="mt-1 text-[11px] text-slate-400 truncate">
                        Prior: {s.client} / {s.job} · {s.stage}
                      </div>
                    ))}
                  </div>
                </button>
                {moduleKey === "candidates" ? (
                  <button
                    type="button"
                    title="Open relationships"
                    className="self-end mb-3 mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 cursor-pointer"
                    onClick={() => {
                      select(String(row.id), "person");
                      setTab("Relationships");
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                </div>
              );
              })
            )}
          </div>
          {moduleKey !== "settings" ? (
            <ListPager slice={pageSlice} onPageChange={setPage} onPageSizeChange={setPageSize} />
          ) : null}
        </section>

        <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--color-canvas)]">
          {error ? (
            <div className="m-4 shrink-0">
              <InlineError
                title="Something went wrong"
                reason={error}
                secondaryAction={
                  <Button variant="ghost" onClick={() => setError("")}>
                    Dismiss
                  </Button>
                }
              />
            </div>
          ) : null}
          {moduleKey === "settings" ? (
            <div className="flex-1 min-h-0 overflow-auto">
              <SettingsPane
                data={settings}
                session={session}
                busy={busy}
                selectedUserId={selectedId || null}
                onAction={act}
              />
            </div>
          ) : moduleKey === "calendar" ? (
            <CalendarPane
              events={calendarEvents}
              selectedId={selectedId}
              onSelect={(id) => select(id)}
              onSchedule={() => setDrawer("meeting")}
              onOpenHref={(href) => router.push(href)}
              graphLive={calendarMeta.graphLive}
              mailbox={session?.mailbox || calendarMeta.mailbox}
            />
          ) : moduleKey === "communications" ? (
            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
              <CommunicationDetailPane
                threads={communicationThreads}
                selectedId={selectedId}
                canPlayRecording={canPlayRecording}
                onViewCall={(activityId, kind) => act({ action: "view_call_artifact", activityId, kind })}
                onOpenPerson={(personId) => router.push(`/candidates?id=${personId}&type=person`)}
                onWrapUp={(activityId, personId) => {
                  setCallActivityId(activityId);
                  setWrapPersonId(personId);
                  setProposed("Follow up on this conversation");
                  setDrawer("wrap");
                }}
              />
            </div>
          ) : !record && moduleKey !== "dashboard" && moduleKey !== "reports" ? (
            busy ? (
              <div className="flex-1 min-h-0 overflow-auto p-6">
                <LoadingSkeleton rows={8} />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto p-8">
                <EmptyState
                  title="Select a record"
                  hint="Filters stay when you open, call, or submit. Pick someone from the list to work the next action."
                />
              </div>
            )
          ) : moduleKey === "dashboard" || moduleKey === "reports" ? (
            <div className="flex-1 min-h-0 overflow-auto">
              <DashPane
                dash={dash}
                onOpen={(m, id) => router.push(id ? `/${m}?id=${id}` : `/${m}`)}
                onExport={session?.permissions.includes("export") ? exportOps : undefined}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 bg-[var(--color-surface)]">
                <header className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Avatar name={String(record?.name || "")} size={72} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 flex items-center gap-1">
                            {String(record?.name)}
                            <button
                              type="button"
                              title={starred ? "Primary contact" : "Mark as primary"}
                              className="p-1 rounded hover:bg-amber-50 cursor-pointer"
                              onClick={() => setStarred(!starred)}
                            >
                              <Star className={`h-5 w-5 ${starred ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                            </button>
                          </h1>
                          <p className="text-sm text-slate-600">
                            {String(record?.title || record?.industry || "")}
                            {company?.name ? ` | ${company.name}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          {isCandidate ? (
                            <button type="button" className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 h-8 text-[13px] font-medium text-emerald-800 cursor-pointer hover:bg-emerald-100" title="Availability">
                              {avail.label}
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <Tag tone="green">{String(record?.status || "Active")}</Tag>
                          )}
                          {dnc ? <Tag tone="red">Do not reach</Tag> : null}
                          <Button
                            variant="secondary"
                            className="!bg-transparent !border-[var(--color-accent)] !text-[var(--color-accent)] hover:!bg-blue-50 hover:!text-[var(--color-accent)]"
                            onClick={() => setDrawer("edit")}
                          >
                            Edit
                          </Button>
                          {isCandidate && jnpUrl ? (
                            <Button
                              variant="secondary"
                              className="!bg-transparent !border-[var(--color-accent)] !text-[var(--color-accent)] hover:!bg-blue-50 hover:!text-[var(--color-accent)]"
                              href={jnpUrl}
                              title={jnpUrl}
                            >
                              Open JobsNProfiles
                            </Button>
                          ) : company?.id ? (
                            <Button
                              variant="secondary"
                              className="!bg-transparent !border-[var(--color-accent)] !text-[var(--color-accent)] hover:!bg-blue-50 hover:!text-[var(--color-accent)]"
                              onClick={() => select(company.id, "organization")}
                            >
                              View Company
                            </Button>
                          ) : null}
                          <div className="relative">
                            <IconButton
                              icon={MoreHorizontal}
                              label="More actions"
                              onClick={() => setMenu(menu === "more" ? "none" : "more")}
                              className="!border !border-[var(--color-accent)] !bg-transparent !text-[var(--color-accent)] hover:!bg-blue-50 hover:!text-[var(--color-accent)]"
                            />
                            {menu === "more" ? (
                              <div className="absolute right-0 mt-1 z-30 w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                                <MenuItem icon={Mail} onClick={() => { setMenu("none"); setDrawer("email"); }}>Send Email</MenuItem>
                                <MenuItem icon={Phone} disabled={callBlocked} title={callWhy} onClick={() => { setMenu("none"); onCall(); }}>VioTalk Call</MenuItem>
                                <MenuItem icon={CalendarDays} onClick={() => { setMenu("none"); setDrawer("meeting"); }}>Schedule Meeting</MenuItem>
                                {isCandidate ? <MenuItem icon={CloudUpload} disabled={submitBlocked} title={submitWhy} onClick={() => { setMenu("none"); setDrawer("submit"); }}>Submit Profile</MenuItem> : null}
                                {isCandidate && canJnpSync ? (
                                  <MenuItem
                                    icon={RefreshCw}
                                    onClick={() => { setMenu("none"); setDrawer("jnp"); }}
                                  >
                                    JNP sync
                                  </MenuItem>
                                ) : null}
                                {company?.id && isCandidate ? (
                                  <MenuItem icon={Building2} onClick={() => { setMenu("none"); select(company.id, "organization"); }}>View Company</MenuItem>
                                ) : null}
                                {canToggleDnc && !isOrganization ? (
                                  <MenuItem
                                    icon={Ban}
                                    onClick={() => {
                                      setMenu("none");
                                      void act({ action: "dnc", personId: selectedId, on: !dnc });
                                    }}
                                  >
                                    {dnc ? "Clear Do not reach" : "Mark Do not reach"}
                                  </MenuItem>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
                        {record?.email ? (
                          <IconChip icon={Mail} tone="blue" onClick={() => setDrawer("email")}>{String(record.email)}</IconChip>
                        ) : null}
                        {record?.phone ? (
                          <span className="inline-flex items-center gap-0.5">
                            <IconChip icon={Phone} disabled={callBlocked} title={callWhy} onClick={onCall}>
                              {String(record.phone)}
                            </IconChip>
                            <IconOnly icon={WhatsAppIcon} label="WhatsApp" tone="green" disabled title="WhatsApp channel not live in POC" />
                          </span>
                        ) : null}
                        {record?.location ? (
                          <IconChip icon={MapPin}>{timeZoneHint(record.location)}</IconChip>
                        ) : null}
                        {record?.linkedIn ? (
                          <IconChip
                            icon={LinkedInIcon}
                            tone="blue"
                            href={linkedInHref(record.linkedIn)}
                            title={linkedInHref(record.linkedIn)}
                          >
                            {linkedInLabel(record.linkedIn)}
                          </IconChip>
                        ) : isCandidate ? (
                          <IconOnly icon={LinkedInIcon} label="LinkedIn" tone="blue" disabled title="No LinkedIn on file" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {dnc || blockEmail || blockSms ? (
                    <div className="mt-3 rounded-md bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-800">
                      {dnc
                        ? "Do not reach is on. VioTalk Call, WhatsApp and Send Email are disabled."
                        : [
                            blockEmail ? "Do Not Email" : null,
                            blockSms ? "Do Not SMS" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") + " is on for this contact."}
                    </div>
                  ) : null}
                  {pendingOwnership.length && session?.permissions.includes("ownership_transfer") ? (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-2">
                      {pendingOwnership.map((r) => (
                        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {r.requester?.name || "Someone"} requested {r.type}
                            {r.note ? ` — ${r.note}` : ""}
                          </span>
                          <span className="flex gap-3">
                            <TextLink onClick={() => void act({ action: "ownership_decide", requestId: r.id, accept: true })}>
                              Accept
                            </TextLink>
                            <TextLink onClick={() => void act({ action: "ownership_decide", requestId: r.id, accept: false })}>
                              Dismiss
                            </TextLink>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {record?.isOwnedByOther ? (
                    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                      <div className="font-semibold">Existing relationship — never auto-merge</div>
                      <p>
                        Owner {(record.owner as { name?: string })?.name} · Last outreach {shortDate(record.lastOutreachAt)} · Next action {String(record.nextAction || "—")}
                        {record?.activeRequirements ? ` · Active reqs ${String(record.activeRequirements)}` : ""} · Recent activity {String(((record?.activityEvents as unknown[]) || []).length)}.
                      </p>
                      <div className="mt-2 flex gap-3">
                        <TextLink onClick={() => act({ action: "ownership_request", personId: selectedId, type: "collaboration", note: "Need to collaborate" })}>Request Collaboration</TextLink>
                        <TextLink onClick={() => act({ action: "ownership_request", personId: selectedId, type: "transfer", note: "Need transfer" })}>Request Transfer</TextLink>
                      </div>
                    </div>
                  ) : null}
                </header>

                {isCandidate ? (
                  <div className="px-4 sm:px-5 pb-3">
                    <Candidate360Header record={record} />
                  </div>
                ) : null}

                <Tabs
                  items={
                    isOrganization
                      ? ["Overview", "People", "Requirements", "Candidates Submitted", "Interviews", "Placements", "Communication", "Tasks", "MSA/PO", "Files"]
                      : isCandidate
                        ? ["Overview", "Skills/Profile", "Requirements", "Submissions", "Interviews", "Placements", "Communication", "Tasks", "Notes", "Files", "Relationships", "Activity"]
                        : ["Overview", "Communication", "Notes", "Meetings", "Files", "Relationships", "Activity"]
                  }
                  value={tab}
                  onChange={setTab}
                  getLabel={tabLabel}
                />
              </div>

              <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-5 space-y-4">

                {tab === "Overview" && !isOrganization ? (
                  isCandidate ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="min-w-0 space-y-4">
                        <CandidateDetailsCard
                          record={record}
                          avail={avail}
                          jnpUrl={jnpUrl}
                          canSeeRates={canSeeRates}
                          onEdit={() => setDrawer("edit")}
                          onOpenSubmissions={() => setTab("Submissions")}
                        />
                    </div>
                    <div className="min-w-0 space-y-4">
                      <Card>
                        <CardHeader title="Quick Actions" />
                        <div className="p-2.5 grid grid-cols-4 gap-1.5">
                          <IconBtn disabled={blockEmail || !session?.mailbox} onClick={() => setDrawer("email")} label="Send Email" title={!session?.mailbox ? "Outlook not connected — Settings → Connect Outlook" : blockEmail ? "Do not reach / Do Not Email" : ""} />
                          <IconBtn disabled={callBlocked} title={callWhy} onClick={onCall} label="VioTalk Call" />
                          <IconBtn disabled title="WhatsApp channel not live in POC" label="WhatsApp" />
                          <IconBtn disabled={!session?.mailbox} title={!session?.mailbox ? "Outlook not connected — Settings → Connect Outlook" : ""} onClick={() => setDrawer("meeting")} label="Schedule Meeting" />
                          <IconBtn onClick={() => setDrawer("note")} label="Add Note" />
                          <IconBtn onClick={() => setDrawer("wrap")} label="Add Follow-up" />
                          {session?.permissions.includes("submit") ? (
                            <IconBtn disabled={submitBlocked} title={submitWhy} onClick={() => setDrawer("submit")} label="Submit Profile" />
                          ) : null}
                          <div className="relative">
                            <IconBtn onClick={() => setMenu(menu === "qa-more" ? "none" : "qa-more")} label="More" />
                            {menu === "qa-more" ? (
                              <div className="absolute left-0 bottom-full mb-1 z-30 w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                                {canJnpSync ? (
                                  <MenuItem
                                    icon={RefreshCw}
                                    onClick={() => { setMenu("none"); setDrawer("jnp"); }}
                                  >
                                    JNP sync
                                  </MenuItem>
                                ) : null}
                                <MenuItem icon={CalendarDays} onClick={() => { setMenu("none"); setDrawer("wrap"); }}>Add Follow-up</MenuItem>
                                {company?.id ? <MenuItem icon={Building2} onClick={() => { setMenu("none"); select(company.id, "organization"); }}>View Company</MenuItem> : null}
                                {canToggleDnc ? (
                                  <MenuItem
                                    icon={Ban}
                                    onClick={() => {
                                      setMenu("none");
                                      void act({ action: "dnc", personId: selectedId, on: !dnc });
                                    }}
                                  >
                                    {dnc ? "Clear Do not reach" : "Mark Do not reach"}
                                  </MenuItem>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                      <Card>
                        <CardHeader title="Recent Communication" action={<TextLink onClick={() => setTab("Communication")}>View all</TextLink>} />
                        <div className="px-4 py-3">
                          <Timeline
                            record={record}
                            embedded
                            compact
                            onOpenCommunication={(id) => {
                              setCommFocusId(id);
                              setTab("Communication");
                            }}
                          />
                        </div>
                      </Card>
                    </div>
                    <div className="min-w-0 space-y-4 lg:col-span-2 xl:col-span-1">
                        <Card>
                          <CardHeader title="Upcoming Interviews / Follow-ups" action={<TextLink onClick={() => router.push("/tasks")}>View all</TextLink>} />
                          <div className="px-2 pb-2">
                            {upcoming.map((t) => (
                              <button key={t.id} type="button" className="w-full text-left rounded-md px-2 py-2 hover:bg-slate-50 cursor-pointer flex items-start gap-2" onClick={() => router.push("/calendar")}>
                                <CalendarDays className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                                <div>
                                  <div className="text-sm">{t.title}</div>
                                  <div className="text-xs text-slate-500">{shortDate(t.dueAt)}</div>
                                </div>
                              </button>
                            ))}
                            {!upcoming.length ? <div className="px-2 py-3 text-sm text-slate-400">No upcoming work</div> : null}
                          </div>
                        </Card>
                        <Card>
                          <CardHeader title={`Related people (${relatedPeople.length})`} action={<TextLink onClick={() => setTab("Relationships")}>View all</TextLink>} />
                          <div className="px-2 pb-2">
                            {relatedPeople.map((p) => (
                              <div key={p.name} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5">
                                <Avatar name={p.name} size={28} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium truncate">{p.name}</div>
                                  <div className="text-xs text-slate-500 truncate">{p.title}</div>
                                </div>
                                <Tag tone={p.tone}>{p.badge}</Tag>
                              </div>
                            ))}
                            {!relatedPeople.length ? <div className="px-2 py-3 text-sm text-slate-400">None on file</div> : null}
                          </div>
                        </Card>
                      <Card>
                          <CardHeader title="Internal Notes" action={<TextLink onClick={() => setDrawer("note")}>Edit</TextLink>} />
                        <div className="px-4 py-2">
                          {internalNotes.map((n) => (
                            <div key={String(n.id)} className="text-sm py-2 border-b last:border-0">
                              {String(n.body || n.summary)}
                            </div>
                          ))}
                          {!internalNotes.length ? <div className="py-3 text-sm text-slate-400">Team-only notes appear here</div> : null}
                        </div>
                      </Card>
                    </div>
                  </div>
                  ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="min-w-0 xl:col-span-5 space-y-4">
                      <Card>
                        <CardHeader title="Contact Details" action={<TextLink onClick={() => setDrawer("edit")}>Edit</TextLink>} />
                        <dl className="px-4 py-3 space-y-2 text-sm">
                          {[
                            ["Full Name", record?.name],
                            ["Job Title", record?.title],
                            ["Department", record?.department],
                            ["Company", company?.name],
                            ["Location", timeZoneHint(record?.location)],
                            ["Time Zone", /pst/i.test(timeZoneHint(record?.location)) ? "PST" : /cst/i.test(timeZoneHint(record?.location)) ? "CST" : "—"],
                            ["Contact Type", "Client"],
                            ["Status", record?.status],
                            ["Relationship Tier", contactTags.includes("Strategic") ? "Strategic" : company?.role || "—"],
                            ["Source", record?.source],
                            ["Owner", (record?.owner as { name?: string })?.name],
                            ["Last outreach", shortDate(record?.lastOutreachAt)],
                            ["Next Action", record?.nextAction],
                          ].map(([k, v]) => (
                            <div key={String(k)} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2">
                              <dt className="text-slate-600">{String(k)}</dt>
                              <dd className="sm:col-span-2 break-words text-slate-900">{contactDetailValue(String(k), v)}</dd>
                            </div>
                          ))}
                        </dl>
                      </Card>
                      <Card>
                        <CardHeader title="Tags" action={<TextLink onClick={() => setDrawer("edit")}>+ Add Tag</TextLink>} />
                        <div className="px-4 py-3 flex flex-wrap gap-1">
                          {(contactTags.length ? contactTags : ((record?.skills as string[]) || [])).map((t) => (
                            <Tag key={String(t)} tone={tagTone(String(t))}>{String(t)}</Tag>
                          ))}
                        </div>
                      </Card>
                      {company ? (
                        <button
                          type="button"
                          className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 flex gap-3 items-center hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer"
                          onClick={() => select(company.id, "organization")}
                        >
                          <div className="h-10 w-10 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                            {String(company.name).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{company.name}</div>
                            <div className="text-xs text-slate-500">
                              {[company.industry, company.location].filter(Boolean).join(" · ")}
                            </div>
                            <span className="text-xs text-blue-700">Open Client 360</span>
                          </div>
                        </button>
                      ) : null}
                    </div>
                    <div className="min-w-0 xl:col-span-7 space-y-4">
                      <Card>
                        <CardHeader title="Quick Actions" />
                        <div className="p-2.5 grid grid-cols-4 gap-1.5">
                          <IconBtn disabled={blockEmail || !session?.mailbox} onClick={() => setDrawer("email")} label="Send Email" title={!session?.mailbox ? "Outlook not connected — Settings → Connect Outlook" : blockEmail ? "Do not reach / Do Not Email" : ""} />
                          <IconBtn disabled={callBlocked} title={callWhy} onClick={onCall} label="VioTalk Call" />
                          <IconBtn disabled title="WhatsApp channel not live in POC" label="WhatsApp" />
                          <IconBtn disabled={!session?.mailbox} title={!session?.mailbox ? "Outlook not connected — Settings → Connect Outlook" : ""} onClick={() => setDrawer("meeting")} label="Schedule Meeting" />
                          <IconBtn onClick={() => setDrawer("note")} label="Add Note" />
                          <IconBtn onClick={() => setDrawer("wrap")} label="Add Follow-up" />
                          <div className="relative">
                            <IconBtn onClick={() => setMenu(menu === "qa-more" ? "none" : "qa-more")} label="More" />
                            {menu === "qa-more" ? (
                              <div className="absolute left-0 bottom-full mb-1 z-30 w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                                <MenuItem icon={CalendarDays} onClick={() => { setMenu("none"); setDrawer("wrap"); }}>Add Follow-up</MenuItem>
                                {company?.id ? <MenuItem icon={Building2} onClick={() => { setMenu("none"); select(company.id, "organization"); }}>View Company</MenuItem> : null}
                                {canToggleDnc ? (
                                  <MenuItem
                                    icon={Ban}
                                    onClick={() => {
                                      setMenu("none");
                                      void act({ action: "dnc", personId: selectedId, on: !dnc });
                                    }}
                                  >
                                    {dnc ? "Clear Do not reach" : "Mark Do not reach"}
                                  </MenuItem>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                      <Card>
                        <CardHeader title="Recent Communication" action={<TextLink onClick={() => setTab("Communication")}>View all</TextLink>} />
                        <div className="px-4 py-3">
                          <Timeline
                            record={record}
                            embedded
                            compact
                            onOpenCommunication={(id) => {
                              setCommFocusId(id);
                              setTab("Communication");
                            }}
                          />
                        </div>
                      </Card>
                      <Card>
                        <CardHeader title="Files" action={<TextLink onClick={() => setTab("Files")}>View all</TextLink>} />
                        <ul className="px-2 pb-2">
                          {files.map((d) => (
                            <li key={d.name}>
                              <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-blue-700 hover:bg-blue-50 cursor-pointer" onClick={() => setTab("Files")}>
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="min-w-0 truncate flex-1 text-left">{d.name}</span>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {d.source === "JobsNProfiles" ? "JNP" : "Manual"}
                                </span>
                              </button>
                            </li>
                          ))}
                          {!files.length ? <li className="px-2 py-3 text-slate-400 text-sm">No files</li> : null}
                        </ul>
                      </Card>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader title="Upcoming Interviews / Follow-ups" action={<TextLink onClick={() => router.push("/tasks")}>View all</TextLink>} />
                          <div className="px-2 pb-2">
                            {upcoming.map((t) => (
                              <button key={t.id} type="button" className="w-full text-left rounded-md px-2 py-2 hover:bg-slate-50 cursor-pointer flex items-start gap-2" onClick={() => router.push("/calendar")}>
                                <CalendarDays className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                                <div>
                                  <div className="text-sm">{t.title}</div>
                                  <div className="text-xs text-slate-500">{shortDate(t.dueAt)}</div>
                                </div>
                              </button>
                            ))}
                            {!upcoming.length ? <div className="px-2 py-3 text-sm text-slate-400">No upcoming work</div> : null}
                          </div>
                        </Card>
                        <Card>
                          <CardHeader title={`Related people (${relatedPeople.length})`} action={<TextLink onClick={() => setTab("Relationships")}>View all</TextLink>} />
                          <div className="px-2 pb-2">
                            {relatedPeople.map((p) => (
                              <div key={p.name} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5">
                                <Avatar name={p.name} size={28} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium truncate">{p.name}</div>
                                  <div className="text-xs text-slate-500 truncate">{p.title}</div>
                                </div>
                                <Tag tone={p.tone}>{p.badge}</Tag>
                              </div>
                            ))}
                            {!relatedPeople.length ? <div className="px-2 py-3 text-sm text-slate-400">None on file</div> : null}
                          </div>
                        </Card>
                      </div>
                      <Card>
                          <CardHeader title="Internal Notes" action={<TextLink onClick={() => setDrawer("note")}>Edit</TextLink>} />
                        <div className="px-4 py-2">
                          {internalNotes.map((n) => (
                            <div key={String(n.id)} className="text-sm py-2 border-b last:border-0">
                              {String(n.body || n.summary)}
                            </div>
                          ))}
                          {!internalNotes.length ? <div className="py-3 text-sm text-slate-400">Team-only notes appear here</div> : null}
                        </div>
                      </Card>
                    </div>
                  </div>
                  )
                ) : (
                  <RecordTabs
                    tab={tab}
                    record={record}
                    isOrganization={isOrganization}
                    isCandidate={isCandidate}
                    relatedPeople={relatedPeople}
                    canAddRequirement={Boolean(isOrganization && ["sales", "operations", "admin"].includes(session?.role || ""))}
                    jnpUrl={jnpUrl}
                    canPlayRecording={canPlayRecording}
                    canViewMsa={canViewMsa}
                    canViewPo={canViewPo}
                    commFocusId={commFocusId}
                    onAddRequirement={() => setDrawer("req")}
                    onAddNote={() => setDrawer("note")}
                    onSubmit={() => setDrawer("submit")}
                    onOpenPerson={(id) => router.push(`/clients?id=${id}&type=person`)}
                    onAddFile={async ({ name, kind, file }) => {
                      const fd = new FormData();
                      const recordType = params.get("type") || (record?.type === "organization" ? "organization" : "person");
                      if (recordType === "organization") fd.append("organizationId", selectedId);
                      else fd.append("personId", selectedId);
                      fd.append("name", name);
                      fd.append("kind", kind);
                      fd.append("file", file);
                      setBusy(true);
                      setError("");
                      try {
                        const res = await fetch("/api/files", { method: "POST", body: fd });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error || "Upload failed");
                        await load();
                        const rec = await fetch(`/api/record?type=${recordType}&id=${selectedId}`).then((r) => r.json());
                        setRecord(rec.record);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Upload failed");
                        throw e;
                      } finally {
                        setBusy(false);
                      }
                    }}
                    onDeleteFile={async (fileId) => {
                      setBusy(true);
                      setError("");
                      try {
                        const res = await fetch("/api/actions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "delete_person_file", fileId }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error || "Delete failed");
                        await load();
                        const recordType = params.get("type") || (record?.type === "organization" ? "organization" : "person");
                        const rec = await fetch(`/api/record?type=${recordType}&id=${selectedId}`).then((r) => r.json());
                        setRecord(rec.record);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : "Delete failed";
                        setError(msg);
                        throw e instanceof Error ? e : new Error(msg);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    onViewCall={(activityId, kind) => act({ action: "view_call_artifact", activityId, kind })}
                    onViewCommercial={(kind, id) => act({ action: "view_commercial", kind, id })}
                    onWrapUpActivity={(activityId) => {
                      setCallActivityId(activityId);
                      setWrapPersonId(selectedId);
                      setProposed("Follow up on this conversation");
                      setDrawer("wrap");
                    }}
                    onCommFocusConsumed={() => setCommFocusId(null)}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </AppShell>

      {drawer !== "none" ? (
        <div className="fixed inset-0 z-40 bg-slate-900/30 flex justify-end" onClick={() => setDrawer("none")}>
          <div className="w-[420px] bg-[var(--color-surface)] h-full p-5 overflow-auto border-l border-[var(--color-border)] shadow-[var(--shadow-md)]" onClick={(e) => e.stopPropagation()}>
            {drawer === "wrap" ? (
              <WrapForm
                busy={busy}
                proposed={proposed}
                onClose={() => setDrawer("none")}
                onSave={async (vals) => {
                  await act({
                    action: "wrap_up",
                    personId: wrapPersonId || selectedId,
                    activityId: callActivityId,
                    ...vals,
                  });
                  setDrawer("none");
                  setCallActivityId(null);
                  setWrapPersonId(null);
                }}
              />
            ) : null}
            {drawer === "submit" ? (
              <SubmitForm
                requirements={requirements}
                files={((record?.files as { id?: string; name: string; kind?: string; source?: string }[]) || []).filter((f) => f.name)}
                defaultResumeName={String(record?.lastResume || "resume.pdf")}
                onClose={() => setDrawer("none")}
                onSave={async (vals) => {
                  const data = await act({ action: "submit", candidateId: selectedId, ...vals });
                  if (data) {
                    setCallActivityId(data.activityId);
                    setWrapPersonId(selectedId);
                    setProposed("Follow up on submission with the client");
                    setDrawer("wrap");
                  }
                }}
              />
            ) : null}
            {drawer === "note" ? (
              <NoteForm
                onClose={() => setDrawer("none")}
                onSave={async (body, visibility) => {
                  await act({ action: "note", personId: selectedId, body, visibility });
                  setProposed("Follow up on this note");
                  setWrapPersonId(selectedId);
                  setDrawer("wrap");
                }}
              />
            ) : null}
            {drawer === "email" ? (
              <EmailForm
                to={String(record?.email || "")}
                contactName={String(record?.name || "")}
                mailbox={session?.mailbox || null}
                signatures={session?.emailSignatures || []}
                onClose={() => setDrawer("none")}
                onSaveSignature={async (vals) => {
                  const data = await act({
                    action: "upsert_email_signature",
                    id: vals.id,
                    name: vals.name,
                    body: vals.body,
                    isDefault: vals.isDefault,
                  });
                  return Boolean(data);
                }}
                onSave={async (vals) => {
                  const data = await act({ action: "send_email", personId: selectedId, ...vals });
                  if (data) {
                    setCallActivityId(data.activityId);
                    setWrapPersonId(selectedId);
                    setProposed("Follow up if no reply");
                    setDrawer("wrap");
                  }
                }}
              />
            ) : null}
            {drawer === "meeting" ? (
              <MeetingForm
                people={
                  calendarPeople.length
                    ? calendarPeople
                    : record
                      ? [{ id: selectedId, name: String(record.name || ""), email: String(record.email || ""), kind: String(record.kind || ""), title: String(record.title || "") }]
                      : []
                }
                requirements={requirements}
                defaultPersonId={record?.id ? selectedId : ""}
                mailbox={session?.mailbox || null}
                onClose={() => setDrawer("none")}
                onSave={async (vals) => {
                  const data = await act({ action: "schedule_meeting", ...vals });
                  if (data) {
                    setCallActivityId(data.activityId);
                    setWrapPersonId(String(vals.personId));
                    setProposed("Send confirmation / prepare interview pack");
                    setDrawer("wrap");
                  }
                }}
              />
            ) : null}
            {drawer === "jnp" ? (
              <JnpForm
                mapped={canJnpSync}
                accessCode={
                  !session?.jnpAllowed
                    ? "tenant_not_allowed"
                    : !(session?.jnpEnabled && session?.jnpUserId)
                      ? "not_mapped"
                      : session?.jnpAccessOk
                        ? "ok"
                        : session?.jnpAccessCode || "pending"
                }
                onClose={() => setDrawer("none")}
                onSave={async (portalCandidateId) => {
                  const data = await act({ action: "jnp_sync", portalCandidateId });
                  if (data?.status === "collision") setError("Collision — existing relationship shown. Never auto-merge.");
                  if (data?.personId) select(String(data.personId));
                  setDrawer("none");
                }}
              />
            ) : null}
            {drawer === "req" ? (
              <ReqForm
                users={users}
                onClose={() => setDrawer("none")}
                onSave={async (vals) => {
                  await act({ action: "create_requirement", organizationId: selectedId, ...vals });
                  setDrawer("none");
                }}
              />
            ) : null}
            {drawer === "create" ? (
              <CreateForm
                moduleKey={moduleKey}
                onClose={() => setDrawer("none")}
                onSave={async (vals) => {
                  const resumeFile = vals.resumeFile instanceof File ? vals.resumeFile : null;
                  const { resumeFile: _drop, ...payload } = vals;
                  const data = await act(payload);
                  if (!data?.id) return data;
                  if (resumeFile) {
                    const fd = new FormData();
                    fd.append("personId", String(data.id));
                    fd.append("name", resumeFile.name);
                    fd.append("kind", "resume");
                    fd.append("file", resumeFile);
                    setBusy(true);
                    try {
                      const res = await fetch("/api/files", { method: "POST", body: fd });
                      const uploaded = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setError(
                          uploaded.error ||
                            "Candidate created, but resume upload failed. Open Files and upload again.",
                        );
                      }
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Resume upload failed");
                    } finally {
                      setBusy(false);
                    }
                  }
                  select(String(data.id), "person");
                  setTab("Files");
                  const rec = await fetch(`/api/record?type=person&id=${data.id}`).then((r) => r.json());
                  setRecord(rec.record);
                  await load();
                  setDrawer("none");
                  return data;
                }}
              />
            ) : null}
            {drawer === "create-user" ? (
              <CreateUserForm
                busy={busy}
                onClose={() => setDrawer("none")}
                onAction={act}
                onCreated={(id) => {
                  select(id);
                  setDrawer("none");
                }}
              />
            ) : null}
            {drawer === "edit" ? (
              <EditForm
                record={record}
                onClose={() => setDrawer("none")}
                onSave={async (vals) => {
                  await act({ action: "update_person", personId: selectedId, ...vals });
                  setDrawer("none");
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function tabLabel(tab: string) {
  if (tab === "Skills/Profile") return "Skills / Profile";
  if (tab === "MSA/PO") return "MSA / PO";
  return tab;
}
function fmtDate(v: unknown) {
  if (!v) return "—";
  return new Date(String(v)).toLocaleString();
}

function linkedInHref(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^\/+/, "")}`;
}

function linkedInLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const clean = text.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const match = clean.match(/^(linkedin\.com\/in\/[^/?#]+)/i);
  if (match?.[1]) return match[1];
  return clean.replace(/\/$/, "");
}

function contactLink(kind: "email" | "phone" | "linkedin" | "url", value: unknown, label?: string) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  if (kind === "email") {
    return <TextLink href={`mailto:${text}`}>{text}</TextLink>;
  }
  if (kind === "phone") {
    const tel = text.replace(/[^\d+]/g, "");
    return tel ? <TextLink href={`tel:${tel}`}>{text}</TextLink> : text;
  }
  const href = kind === "linkedin" || kind === "url" ? linkedInHref(text) : "";
  const display = kind === "linkedin" ? label || linkedInLabel(text) : label || text;
  return href ? <TextLink href={href}>{display}</TextLink> : display;
}

function contactDetailValue(label: string, value: unknown) {
  if (label === "Work Email" || label === "Email") return contactLink("email", value);
  if (label === "Phone") return contactLink("phone", value);
  if (label === "LinkedIn") return contactLink("linkedin", value);
  const text = String(value ?? "").trim();
  return text || "—";
}

function CandidateDetailsCard({
  record,
  avail,
  jnpUrl,
  canSeeRates,
  onEdit,
  onOpenSubmissions,
}: {
  record: Record<string, unknown> | null;
  avail: { label: string };
  jnpUrl: string;
  canSeeRates: boolean;
  onEdit: () => void;
  onOpenSubmissions: () => void;
}) {
  const index = (record?.titleIndex as { currentTitle?: string } | null) || null;
  const rate = (value: unknown) =>
    canSeeRates ? (
      String(value || "—")
    ) : (
      <span className="inline-flex items-center gap-1 text-slate-400">
        <Lock className="h-3.5 w-3.5" /> Restricted
      </span>
    );
  const auth = String(record?.workAuthorization || "");
  const visaNia = auth === "US Citizen" || auth === "Green Card" || auth === "Canadian Citizen";
  const rows: [string, React.ReactNode][] = [
    ["Primary title", String(index?.currentTitle || record?.title || "—")],
    ["Secondary title", String(record?.secondaryTitle || "—")],
    ["Experience", record?.experienceYears ? `${record.experienceYears} years` : "—"],
    ["Current location", timeZoneHint(record?.location) || "—"],
    ["Time zone", String(record?.timezone || "—")],
    ["Citizenship", String(record?.citizenship || "—")],
    ["Work authorization", auth ? <Tag tone="blue">{auth}</Tag> : "—"],
    ["Visa / EAD expiry", record?.visaExpiry ? shortDate(record.visaExpiry) : visaNia ? "N/A" : "—"],
    ["Willing to relocate", String(record?.willingToRelocate || "—")],
    ["Preferred location", String(record?.preferredLocation || "—")],
    ["Availability", <span key="avail" className="text-emerald-700 font-medium">{avail.label}</span>],
    ["Notice period", String(record?.noticePeriod || record?.availability || "—")],
    ["Employment type", String(record?.employmentType || "—")],
    ["Current rate", rate(record?.currentRate)],
    ["Expected rate", rate(record?.expectedRate)],
    ["Recruiter", (record?.owner as { name?: string })?.name || "—"],
    [
      "Active submissions",
      <TextLink key="subs" onClick={onOpenSubmissions}>
        {String((record?.submissions as unknown[] | undefined)?.length ?? 0)}
      </TextLink>,
    ],
  ];
  if (jnpUrl) {
    rows.push(["JobsNProfiles", <TextLink key="jnp" href={jnpUrl}>View full profile</TextLink>]);
  }
  return (
    <Card>
      <CardHeader title="Contact Details" action={<TextLink onClick={onEdit}>Edit</TextLink>} />
      <dl className="px-4 py-3 space-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={String(k)} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2">
            <dt className="text-slate-600">{k}</dt>
            <dd className="sm:col-span-2 min-w-0 break-words text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Candidate360Header({ record }: { record: Record<string, unknown> | null }) {
  const items = [
    ["Owner", (record?.owner as { name?: string } | undefined)?.name || "—"],
    ["Last outreach", shortDate(record?.lastOutreachAt) || "—"],
    ["Next action", String(record?.nextAction || "—")],
    ["Status", String(record?.availability || record?.status || "—")],
    ["Active reqs", String(record?.activeRequirements ?? 0)],
    ["Submissions", String((record?.submissions as unknown[] | undefined)?.length ?? 0)],
    ["Interviews", String((record?.interviews as unknown[] | undefined)?.length ?? 0)],
    ["Source", String(record?.source || "—")],
    ["Last resume", String(record?.lastResume || "—")],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="min-w-0 rounded-[var(--radius-md)] border border-blue-100 bg-blue-50/50 px-3 py-2"
        >
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
          <div className="text-[13px] font-semibold text-[var(--color-text)] truncate" title={value}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
function RecordTabs({
  tab,
  record,
  isOrganization,
  isCandidate,
  relatedPeople,
  canAddRequirement,
  jnpUrl,
  canPlayRecording,
  canViewMsa,
  canViewPo,
  commFocusId,
  onAddRequirement,
  onAddNote,
  onSubmit,
  onOpenPerson,
  onAddFile,
  onDeleteFile,
  onViewCall,
  onViewCommercial,
  onWrapUpActivity,
  onCommFocusConsumed,
}: {
  tab: string;
  record: Record<string, unknown> | null;
  isOrganization: boolean;
  isCandidate: boolean;
  relatedPeople: { id?: string; name: string; title: string; badge: string; tone: "blue" | "purple" | "amber" }[];
  canAddRequirement: boolean;
  jnpUrl: string;
  canPlayRecording?: boolean;
  canViewMsa?: boolean;
  canViewPo?: boolean;
  commFocusId?: string | null;
  onAddRequirement: () => void;
  onAddNote: () => void;
  onSubmit: () => void;
  onOpenPerson: (id: string) => void;
  onAddFile: (v: { name: string; kind: string; file: File }) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
  onViewCall?: (activityId: string, kind: "recording" | "transcript") => Promise<unknown>;
  onViewCommercial?: (kind: "msa" | "po", id: string) => Promise<unknown>;
  onWrapUpActivity?: (activityId: string) => void;
  onCommFocusConsumed?: () => void;
}) {
  if (tab === "Overview" && isOrganization) {
    return (
      <Card>
        <CardHeader title="Overview" />
        <div className="p-4">
          <AccountOverview record={record} />
        </div>
      </Card>
    );
  }
  if (tab === "Skills/Profile") {
    return <SkillsProfilePane record={record} jnpUrl={jnpUrl} />;
  }
  if (tab === "Requirements") {
    return (
      <RequirementsPane
        record={record}
        isOrganization={isOrganization}
        canAdd={canAddRequirement}
        onAdd={onAddRequirement}
      />
    );
  }
  if (tab === "Submissions" || tab === "Candidates Submitted") {
    return <SubmissionsPane record={record} isCandidate={isCandidate} onSubmit={isCandidate ? onSubmit : undefined} />;
  }
  if (tab === "Interviews" || tab === "Meetings") {
    return <InterviewsPane record={record} />;
  }
  if (tab === "Placements") {
    return <PlacementsPane record={record} />;
  }
  if (tab === "Communication") {
    return (
      <Timeline
        record={record}
        mode="communication"
        canPlayRecording={canPlayRecording}
        onViewCall={onViewCall}
        onWrapUp={onWrapUpActivity}
        focusId={commFocusId}
        onFocusConsumed={onCommFocusConsumed}
      />
    );
  }
  if (tab === "Activity") {
    return <Timeline record={record} mode="activity" canPlayRecording={canPlayRecording} onViewCall={onViewCall} />;
  }
  if (tab === "Tasks") {
    return <TasksPane record={record} />;
  }
  if (tab === "Notes") {
    return <Timeline record={record} mode="notes" onAddNote={onAddNote} canPlayRecording={canPlayRecording} onViewCall={onViewCall} />;
  }
  if (tab === "Files") {
    return <FilesPane record={record} onAddFile={onAddFile} onDeleteFile={onDeleteFile} />;
  }
  if (tab === "Relationships" || tab === "People") {
    return <RelationshipsPane record={record} relatedPeople={relatedPeople} onOpen={onOpenPerson} />;
  }
  if (tab === "MSA/PO") {
    return (
      <Card>
        <CardHeader title="MSA & Purchase Orders" />
        <div className="p-4">
          <Commercial record={record} canViewMsa={canViewMsa} canViewPo={canViewPo} onView={onViewCommercial} />
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <EmptyState title="Nothing on this tab yet" hint="Open another tab or select a different record." />
    </Card>
  );
}

function SkillsProfilePane({ record, jnpUrl }: { record: Record<string, unknown> | null; jnpUrl: string }) {
  const index = (record?.titleIndex as { currentTitle?: string; previousTitles?: string[]; resumeTitles?: string[]; skills?: string[] } | null) || null;
  const skills = (record?.skills as string[]) || index?.skills || [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="Profile" action={jnpUrl ? <TextLink href={jnpUrl}>Open JobsNProfiles</TextLink> : undefined} />
        <dl className="px-4 py-3 space-y-2.5 text-sm">
          {[
            ["Current title", index?.currentTitle || record?.title],
            ["Secondary title", record?.secondaryTitle],
            ["Experience", record?.experienceYears ? `${record.experienceYears} years` : "—"],
            ["Availability", record?.availability],
            ["Location", record?.location],
            ["Time zone", record?.timezone],
            ["Citizenship", record?.citizenship],
            ["Work authorization", record?.workAuthorization],
            ["Visa / EAD expiry", record?.visaExpiry ? shortDate(record.visaExpiry) : ""],
            ["Willing to relocate", record?.willingToRelocate],
            ["Preferred location", record?.preferredLocation],
            ["Notice period", record?.noticePeriod],
            ["Employment type", record?.employmentType],
            ["Source", record?.source],
            ["Last resume", record?.lastResume],
            ["JNP ID", record?.portalCandidateId],
          ].map(([k, v]) => (
            <div key={String(k)} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2">
              <dt className="text-slate-600">{String(k)}</dt>
              <dd className="sm:col-span-2 text-slate-900">{String(v || "—")}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardHeader title="Title index" />
        <div className="px-4 py-3 space-y-3 text-sm">
          <Field label="Previous titles" value={index?.previousTitles?.join(", ") || "—"} />
          <Field label="Titles in resume" value={index?.resumeTitles?.join(", ") || "—"} />
          <div>
            <div className="text-xs text-slate-500 mb-1">Skills</div>
            <div className="flex flex-wrap gap-1">
              {skills.length ? skills.map((s) => <Tag key={s} tone="blue">{s}</Tag>) : <span className="text-slate-400">None on file</span>}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RequirementsPane({
  record,
  isOrganization,
  canAdd,
  onAdd,
}: {
  record: Record<string, unknown> | null;
  isOrganization: boolean;
  canAdd: boolean;
  onAdd: () => void;
}) {
  const organizationReqs = (record?.requirements as { id: string; title: string; status?: string; location?: string; openedAt?: string; hiringManager?: { name?: string } }[]) || [];
  const fromSubs = ((record?.submissions as { id: string; stage?: string; organization?: { name?: string }; requirement?: { id?: string; title?: string; status?: string; location?: string } }[]) || []).map((s) => ({
    id: s.requirement?.id || s.id,
    title: s.requirement?.title || "Requirement",
    client: s.organization?.name || "—",
    status: s.requirement?.status || "open",
    location: s.requirement?.location || "",
    stage: s.stage || "Submitted",
  }));
  const rows = isOrganization
    ? organizationReqs.map((r) => ({
        id: r.id,
        title: r.title,
        client: String(record?.name || ""),
        status: r.status || "open",
        location: r.location || "",
        stage: r.hiringManager?.name ? `HM ${r.hiringManager.name}` : "",
      }))
    : fromSubs.filter((row, i, all) => all.findIndex((r) => r.id === row.id) === i);
  return (
    <Card>
      <CardHeader
        title={isOrganization ? "Requirements" : "Requirements this candidate is on"}
        action={canAdd ? <TextLink onClick={onAdd}>+ Add Requirement</TextLink> : undefined}
      />
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-xs text-slate-500">
                  {[r.client, r.location].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.stage ? <Tag tone="purple">{r.stage}</Tag> : null}
                <Tag tone={r.status === "open" ? "green" : "slate"}>{r.status}</Tag>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No requirements yet"
          hint={isOrganization ? "Add a Requirement on this Client. Jobs are not a left-nav module." : "Submit Profile against a Client job to attach a requirement here."}
        />
      )}
    </Card>
  );
}

function SubmissionsPane({
  record,
  isCandidate,
  onSubmit,
}: {
  record: Record<string, unknown> | null;
  isCandidate: boolean;
  onSubmit?: () => void;
}) {
  const subs = (record?.submissions as {
    id: string;
    stage?: string;
    sentAt?: string;
    resumeVersion?: string;
    source?: string;
    candidate?: { name?: string };
    requirement?: { title?: string };
    organization?: { name?: string };
    clientPerson?: { name?: string };
  }[]) || [];
  return (
    <Card>
      <CardHeader
        title="Submissions"
        action={onSubmit ? <TextLink onClick={onSubmit}>Submit Profile</TextLink> : undefined}
      />
      {subs.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b">
              <tr>
                {!isCandidate ? <th className="px-4 py-2 font-medium">Candidate</th> : null}
                <th className="px-4 py-2 font-medium">Client / job</th>
                <th className="px-4 py-2 font-medium">Hiring manager</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2 font-medium">Sent</th>
                <th className="px-4 py-2 font-medium">Resume</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subs.map((s) => (
                <tr key={s.id} className="align-top">
                  {!isCandidate ? <td className="px-4 py-3">{s.candidate?.name || "—"}</td> : null}
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.organization?.name || "—"}</div>
                    <div className="text-xs text-slate-500">{s.requirement?.title || "—"}</div>
                  </td>
                  <td className="px-4 py-3">{s.clientPerson?.name || "—"}</td>
                  <td className="px-4 py-3"><Tag tone="purple">{s.stage || "Submitted"}</Tag></td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{shortDate(s.sentAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{s.resumeVersion || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No submissions" hint={isCandidate ? "Submit Profile from Quick Actions. This creates a TalentBridge Submission ID — it is not a JNP ATS write-back." : "No candidates submitted to this Client yet."} />
      )}
    </Card>
  );
}

function InterviewsPane({ record }: { record: Record<string, unknown> | null }) {
  const rows = (record?.interviews as {
    id: string;
    scheduledAt?: string;
    endsAt?: string;
    outcome?: string;
    teamsJoinUrl?: string;
    location?: string;
    candidate?: { name?: string };
    organization?: { name?: string };
    requirement?: { title?: string };
  }[]) || [];
  const meetings = (record?.meetings as {
    id: string;
    title?: string;
    startsAt?: string;
    teamsJoinUrl?: string;
    location?: string;
    kind?: string;
  }[]) || [];
  return (
    <Card>
      <CardHeader title="Interviews / Meetings" />
      {rows.length || meetings.length ? (
        <ul className="divide-y">
          {rows.map((i) => (
            <li key={i.id} className="px-4 py-3 flex items-start gap-3">
              <CalendarDays className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{i.requirement?.title || "Interview"}</div>
                <div className="text-xs text-slate-500">
                  {[i.candidate?.name, i.organization?.name, shortDate(i.scheduledAt), i.location].filter(Boolean).join(" · ")}
                </div>
                {i.teamsJoinUrl ? (
                  <a href={i.teamsJoinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">
                    Join Teams
                  </a>
                ) : null}
              </div>
              <Tag tone={i.outcome === "pending" ? "amber" : i.outcome === "passed" ? "green" : "slate"}>{i.outcome || "pending"}</Tag>
            </li>
          ))}
          {meetings.filter((m) => !rows.some((i) => i.id === m.id)).map((m) => (
            <li key={m.id} className="px-4 py-3 flex items-start gap-3">
              <CalendarDays className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.title || "Meeting"}</div>
                <div className="text-xs text-slate-500">{[shortDate(m.startsAt), m.location].filter(Boolean).join(" · ")}</div>
                {m.teamsJoinUrl ? (
                  <a href={m.teamsJoinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">
                    Join Teams
                  </a>
                ) : null}
              </div>
              <Tag tone="blue">{m.kind || "meeting"}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No interviews scheduled" hint="Use Schedule Meeting to create a Teams call on the calendar. Interviews attach to a Submission and Requirement on this record." />
      )}
    </Card>
  );
}

function PlacementsPane({ record }: { record: Record<string, unknown> | null }) {
  const rows = (record?.placements as {
    id: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    followUp?: string;
    candidate?: { name?: string };
    organization?: { name?: string };
    requirement?: { title?: string };
  }[]) || [];
  return (
    <Card>
      <CardHeader title="Placements" />
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((p) => (
            <li key={p.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{p.candidate?.name || p.requirement?.title || "Placement"}</div>
                <div className="text-xs text-slate-500">
                  {[p.organization?.name, p.requirement?.title, p.followUp].filter(Boolean).join(" · ")}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {shortDate(p.startDate)}
                  {p.endDate ? ` – ${shortDate(p.endDate)}` : ""}
                </div>
              </div>
              <Tag tone={p.status === "active" ? "green" : "slate"}>{p.status || "active"}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No placements" hint="A placement is a TalentBridge work object on the candidate and the Client job." />
      )}
    </Card>
  );
}

function TasksPane({ record }: { record: Record<string, unknown> | null }) {
  const tasks = ((record?.tasks as Record<string, unknown>[]) || (record?.upcoming as Record<string, unknown>[]) || []) as {
    id: string;
    title: string;
    status?: string;
    dueAt?: string;
    owner?: { name?: string };
  }[];
  return (
    <Card>
      <CardHeader title="Tasks" />
      {tasks.length ? (
        <ul className="divide-y">
          {tasks.map((t) => (
            <li key={t.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-xs text-slate-500">
                  {[t.owner?.name, t.dueAt ? shortDate(t.dueAt) : "No due date"].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Tag tone={t.status === "open" ? "amber" : "green"}>{t.status || "open"}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No tasks" hint="Wrap-up Next Action creates a task on this record." />
      )}
    </Card>
  );
}

function FilesPane({
  record,
  onAddFile,
  onDeleteFile,
}: {
  record: Record<string, unknown> | null;
  onAddFile: (v: { name: string; kind: string; file: File }) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
}) {
  const files = (record?.files as {
    id?: string;
    name: string;
    kind?: string;
    source?: string;
    externalId?: string | null;
    previewable?: boolean;
    createdAt?: string;
  }[]) || [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("resume");
  const [picked, setPicked] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const rows = [...files].sort((a, b) => {
    const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bT - aT;
  });

  async function saveFile() {
    const trimmed = name.trim() || picked?.name || "";
    if (!picked || !trimmed || saving) return;
    setSaving(true);
    setFormError("");
    try {
      await onAddFile({ name: trimmed, kind, file: picked });
      setName("");
      setKind("resume");
      setPicked(null);
      setAdding(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !onDeleteFile || deleting) return;
    if (deleteConfirm.trim().toLowerCase() !== "delete") {
      setDeleteError('Type "delete" to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteFile(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirm("");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Files"
        action={
          <TextLink
            onClick={() => {
              setAdding((v) => !v);
              setFormError("");
              setDeleteTarget(null);
              setDeleteConfirm("");
              setDeleteError("");
            }}
          >
            {adding ? "Cancel" : "Add file"}
          </TextLink>
        }
      />
      {adding ? (
        <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-2 bg-[var(--color-surface-muted)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Upload a PDF to open in the browser (Word/text download on Preview). Max 10 MB.
          </p>
          {formError ? <p className="text-xs text-red-600">{formError}</p> : null}
          <label className="block text-sm">
            File
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf"
              className="mt-1 block w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setPicked(file);
                if (file?.name && !name.trim()) setName(file.name);
              }}
            />
          </label>
          <label className="block text-sm">
            Document name
            <input
              className="mt-1 w-full border border-[var(--color-border)] rounded-[var(--radius-md)] px-2 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane_Doe_Java.pdf"
              required
            />
          </label>
          <label className="block text-sm">
            Type
            <FieldSelect wrapClassName="mt-1" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="resume">Resume</option>
              <option value="other">Other document</option>
            </FieldSelect>
          </label>
          <button
            type="button"
            className={btnPrimary}
            disabled={!picked || !(name.trim() || picked.name) || saving}
            onClick={() => void saveFile()}
          >
            {saving ? "Uploading…" : "Save document"}
          </button>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="px-4 py-3 border-b border-red-200 bg-red-50 space-y-2">
          <p className="text-sm font-medium text-red-800">Delete this file permanently?</p>
          <p className="text-xs text-red-700">
            <span className="font-medium">{deleteTarget.name}</span> will be removed from this record. This cannot be
            undone. Type <span className="font-semibold">delete</span> below to confirm.
          </p>
          {deleteError ? <p className="text-xs text-red-600">{deleteError}</p> : null}
          <label className="block text-sm text-red-900">
            Confirmation
            <input
              className="mt-1 w-full border border-red-300 rounded-[var(--radius-md)] px-2 py-2 text-sm bg-white"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='Type "delete"'
              autoComplete="off"
              disabled={deleting}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-[var(--radius-md)] bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={deleting || deleteConfirm.trim().toLowerCase() !== "delete"}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete file"}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={deleting}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirm("");
                setDeleteError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((d) => {
            const fromJnp = d.source === "JobsNProfiles";
            const canPreview = Boolean(d.previewable && d.id);
            const canDelete = Boolean(onDeleteFile && d.id && !fromJnp);
            return (
              <li key={d.id || d.name} className="px-4 py-3 flex items-center gap-3">
                <FileText className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" title={d.name}>
                    {d.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="capitalize">{d.kind || "file"}</span>
                    <Tag tone={fromJnp ? "blue" : "slate"}>{fromJnp ? "JobsNProfiles" : "Manual"}</Tag>
                    {d.createdAt ? <span>· {shortDate(d.createdAt)}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {canPreview ? (
                    <a
                      href={`/api/files/preview?fileId=${encodeURIComponent(String(d.id))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-medium text-[var(--color-accent)] hover:underline"
                    >
                      Preview
                    </a>
                  ) : (
                    <span
                      className="text-[11px] text-[var(--color-text-muted)]"
                      title="Only the file name was saved. Use Add file and upload the PDF again to Preview it."
                    >
                      Name only — re-upload
                    </span>
                  )}
                  {canDelete ? (
                    <button
                      type="button"
                      className="text-[12px] font-medium text-red-600 hover:underline cursor-pointer"
                      onClick={() => {
                        setAdding(false);
                        setDeleteTarget({ id: String(d.id), name: d.name });
                        setDeleteConfirm("");
                        setDeleteError("");
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No files"
          hint="Upload a resume or other document to keep it on this record."
        />
      )}
    </Card>
  );
}

function RelationshipsPane({
  record,
  relatedPeople,
  onOpen,
}: {
  record: Record<string, unknown> | null;
  relatedPeople: { id?: string; name: string; title: string; badge: string; tone: "blue" | "purple" | "amber" }[];
  onOpen: (id: string) => void;
}) {
  const people = (record?.people as { person: { id: string; name: string; title: string }; roleOnOrganization?: string }[]) || [];
  const rows = relatedPeople.length
    ? relatedPeople
    : people.map((p) => ({
        id: p.person.id,
        name: p.person.name,
        title: p.person.title,
        badge: p.roleOnOrganization || "Related",
        tone: "amber" as const,
      }));
  return (
    <Card>
      <CardHeader title="Relationships" />
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((p) => (
            <li key={`${p.name}-${p.badge}`} className="px-4 py-3 flex items-center gap-3">
              <Avatar name={p.name} size={32} />
              <div className="min-w-0 flex-1">
                {p.id ? (
                  <button type="button" className="text-sm font-medium text-left hover:text-blue-700 cursor-pointer" onClick={() => onOpen(p.id!)}>
                    {p.name}
                  </button>
                ) : (
                  <div className="text-sm font-medium">{p.name}</div>
                )}
                <div className="text-xs text-slate-500 truncate">{p.title}</div>
              </div>
              <Tag tone={p.tone}>{p.badge}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No related people" hint="Hiring managers and other people linked through submissions show here. Staff users are not people records." />
      )}
    </Card>
  );
}

function AccountOverview({ record }: { record: Record<string, unknown> | null }) {
  const intel = (record?.intelligence as Record<string, unknown>) || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Object.entries(intel).map(([k, v]) => (
        <Field key={k} label={k} value={String(v ?? "—")} />
      ))}
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}
function channelLabel(kind: unknown): string {
  switch (String(kind || "")) {
    case "email":
      return "Email";
    case "call":
      return "Call";
    case "meeting":
      return "Meeting";
    case "whatsapp":
      return "WhatsApp";
    case "note":
    case "internal_note":
      return "Note";
    case "conversation":
      return "All";
    default:
      return String(kind || "Activity");
  }
}

function teamsJoinUrlFromBody(body: unknown): string | null {
  const text = String(body || "");
  const fromMarker = text.split("Teams: ").pop()?.trim();
  if (fromMarker && fromMarker.startsWith("http")) return fromMarker.split(/\s+/)[0] || null;
  const match = text.match(/https:\/\/teams\.microsoft\.com[^\s]+/i);
  return match?.[0] || null;
}

function isInboundMessage(item: Record<string, unknown>) {
  const kind = String(item.kind || "");
  if (kind === "email") {
    if (typeof item.emailIsRead === "boolean") return true;
    return /^Reply:/i.test(String(item.summary || ""));
  }
  if (kind === "whatsapp") return /inbound|received|from/i.test(String(item.summary || ""));
  return false;
}

function cleanEmailSummary(summary: unknown) {
  return String(summary || "")
    .replace(/^Reply:\s*/i, "")
    .replace(/^Email:\s*/i, "")
    .replace(/^(Re:\s*)+/gi, "")
    .replace(/\s·\s*(un)?read$/i, "")
    .trim();
}

type CommThread = {
  id: string;
  kind: string;
  title: string;
  preview: string;
  lastAt: string;
  unread: boolean;
  wrapUp: string | null;
  messages: Record<string, unknown>[];
  person?: { id?: string; name?: string };
  organization?: { name?: string };
  channels?: string[];
};

function personIdOf(item: Record<string, unknown>) {
  return String(item.personId || (item.person as { id?: string } | undefined)?.id || "").trim();
}

function emailThreadGroupKey(item: Record<string, unknown>) {
  const cid = String(item.conversationId || "").trim();
  if (cid) return `thread:${cid}`;
  const personId = personIdOf(item);
  const subject = cleanEmailSummary(item.summary).toLowerCase();
  if (personId && subject) return `thread:person:${personId}:subj:${subject}`;
  return `item:${String(item.id)}`;
}

/** One tile per contact — all emails, calls, meetings, WhatsApp, notes in one chat. */
function buildPersonCommunicationThreads(items: Record<string, unknown>[]): CommThread[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const item of items) {
    const personId = personIdOf(item);
    const key = personId ? `person:${personId}` : `item:${String(item.id)}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const threads: CommThread[] = [];
  for (const [key, msgs] of groups) {
    const chronological = [...msgs].sort(
      (a, b) => new Date(String(a.createdAt || 0)).getTime() - new Date(String(b.createdAt || 0)).getTime(),
    );
    const latest = chronological[chronological.length - 1];
    const withPerson = [...chronological].reverse().find((m) => personIdOf(m));
    const withOrg = [...chronological].reverse().find((m) => (m.organization as { name?: string } | undefined)?.name);
    const person = withPerson?.person as { id?: string; name?: string } | undefined;
    const channels = [...new Set(chronological.map((m) => String(m.kind || "")).filter(Boolean))];
    const pending = chronological.some((m) => !m.wrapUp);
    const latestWrap = latest.wrapUp != null ? String(latest.wrapUp) : null;
    threads.push({
      id: key,
      kind: channels.length === 1 ? channels[0] : "conversation",
      title: person?.name || "Unknown contact",
      preview: (() => {
        const summary = cleanEmailSummary(latest.summary) || String(latest.summary || "");
        const body = String(latest.body || "").trim();
        if (String(latest.kind) === "email") return summary || body.slice(0, 120);
        return summary || body.slice(0, 120) || String(latest.aiSummary || "");
      })(),
      lastAt: String(latest.createdAt || ""),
      unread: chronological.some((m) => m.kind === "email" && m.emailIsRead === false),
      wrapUp: pending ? null : latestWrap,
      messages: chronological,
      person,
      organization: withOrg?.organization as { name?: string } | undefined,
      channels,
    });
  }

  return threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

/** Email subject threads (used on a person record Communication tab when browsing by channel). */
function buildCommunicationThreads(items: Record<string, unknown>[]): CommThread[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const item of items) {
    const kind = String(item.kind || "");
    const key = kind === "email" ? emailThreadGroupKey(item) : `item:${String(item.id)}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const threads: CommThread[] = [];
  for (const [key, msgs] of groups) {
    const chronological = [...msgs].sort(
      (a, b) => new Date(String(a.createdAt || 0)).getTime() - new Date(String(b.createdAt || 0)).getTime(),
    );
    const latest = chronological[chronological.length - 1];
    const kind = String(latest.kind || "");
    const outbound = chronological.find((m) => !isInboundMessage(m));
    const titleSource = kind === "email" ? outbound || latest : latest;
    const title =
      kind === "email"
        ? cleanEmailSummary(titleSource.summary) || "Email thread"
        : String(latest.summary || channelLabel(kind));
    const bodyPreview = String(latest.body || "").trim();
    const withPerson = [...chronological].reverse().find((m) => personIdOf(m));
    const withOrg = [...chronological].reverse().find((m) => (m.organization as { name?: string } | undefined)?.name);
    threads.push({
      id: key,
      kind,
      title,
      preview: bodyPreview || String(latest.aiSummary || latest.summary || ""),
      lastAt: String(latest.createdAt || ""),
      unread: chronological.some((m) => m.kind === "email" && m.emailIsRead === false),
      wrapUp: latest.wrapUp != null ? String(latest.wrapUp) : null,
      messages: chronological,
      person: withPerson?.person as { id?: string; name?: string } | undefined,
      organization: withOrg?.organization as { name?: string } | undefined,
      channels: [kind],
    });
  }

  return threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

function wrapUpLabel(wrapUp: unknown) {
  const v = String(wrapUp || "").trim();
  if (!v) return "Needs wrap-up";
  if (v === "next_action") return "Next action set";
  if (v === "no_action" || v === "no_action_required") return "No action required";
  if (v === "closed") return "Closed";
  return v.replace(/_/g, " ");
}

function channelIcon(kind: unknown) {
  switch (String(kind || "")) {
    case "email":
      return Mail;
    case "call":
      return Phone;
    case "meeting":
      return Video;
    case "whatsapp":
      return MessageCircle;
    case "note":
    case "internal_note":
      return StickyNote;
    default:
      return MessageCircle;
  }
}

function formatCommTime(v: unknown) {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCommDay(v: unknown) {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function CommunicationChatView({
  thread,
  canPlayRecording,
  onViewCall,
  onWrapUp,
  showPersonHeader = true,
}: {
  thread: CommThread;
  canPlayRecording?: boolean;
  onViewCall?: (activityId: string, kind: "recording" | "transcript") => Promise<unknown>;
  onWrapUp?: (activityId: string) => void;
  showPersonHeader?: boolean;
}) {
  const [artifactNotice, setArtifactNotice] = useState("");
  const pending = thread.messages.find((m) => !m.wrapUp);
  const channelSummary = (thread.channels || [thread.kind])
    .map(channelLabel)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" · ");

  const messageRows = thread.messages.map((item, index) => {
    const day = formatCommDay(item.createdAt);
    const prevDay = index > 0 ? formatCommDay(thread.messages[index - 1].createdAt) : "";
    return { item, day, showDay: Boolean(day && day !== prevDay) };
  });

  return (
    <div className="flex flex-col h-full min-h-[360px]">
      {showPersonHeader ? (
        <div className="shrink-0 flex items-start gap-3 pb-4 mb-1 border-b border-[var(--color-border)]">
          <Avatar name={thread.person?.name || thread.title} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold text-[var(--color-text)] truncate">
                {thread.person?.name || thread.title}
              </h3>
              {thread.unread ? (
                <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--color-warning-bg)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-warning)]">
                  Unread
                </span>
              ) : null}
            </div>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              {thread.messages.length} {thread.messages.length === 1 ? "item" : "items"}
              {channelSummary ? ` · ${channelSummary}` : ""}
              {" · "}
              {wrapUpLabel(thread.wrapUp)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-auto space-y-4 py-3 px-0.5">
        {messageRows.map(({ item, day, showDay }) => {
          const kind = String(item.kind || "");
          const inbound = isInboundMessage(item);
          const actor = item.actor as { name?: string } | undefined;
          const teamsUrl = kind === "meeting" ? teamsJoinUrlFromBody(item.body) : null;
          const bodyText = String(item.body || "").trim();
          const bodyWithoutTeams =
            kind === "meeting" && teamsUrl ? bodyText.replace(`Teams: ${teamsUrl}`, "").trim() : bodyText;
          const who = inbound
            ? thread.person?.name || "Contact"
            : actor?.name || "You";
          const Icon = channelIcon(kind);
          const subject =
            kind === "email" ? cleanEmailSummary(item.summary) || String(item.summary || "Email") : null;
          const body =
            bodyWithoutTeams ||
            (kind === "call"
              ? String(item.aiSummary || "Call logged — no notes yet.")
              : kind === "meeting"
                ? "Meeting scheduled."
                : kind === "note" || kind === "internal_note"
                  ? String(item.summary || item.body || "Note")
                  : String(item.summary || "—"));

          return (
            <div key={String(item.id)}>
              {showDay ? (
                <div className="flex items-center gap-3 my-3">
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    {day}
                  </span>
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                </div>
              ) : null}
              <div className={`flex gap-2.5 ${inbound ? "" : "flex-row-reverse"}`}>
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    inbound ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-[var(--color-accent)]"
                  }`}
                  title={channelLabel(kind)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className={`min-w-0 max-w-[min(100%,36rem)] ${inbound ? "" : "items-end"}`}>
                  <div
                    className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1 text-[11px] ${
                      inbound ? "" : "justify-end"
                    }`}
                  >
                    <span className="font-medium text-[var(--color-text-secondary)]">{who}</span>
                    <span className="text-[var(--color-text-muted)]">{channelLabel(kind)}</span>
                    <span className="text-[var(--color-text-muted)]">{formatCommTime(item.createdAt)}</span>
                    {kind === "email" && item.emailIsRead === false ? (
                      <span className="font-medium text-[var(--color-warning)]">Unread</span>
                    ) : null}
                  </div>
                  <div
                    className={`rounded-[var(--radius-lg)] border px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      inbound
                        ? "border-[var(--color-border)] bg-white text-[var(--color-text)]"
                        : "border-blue-100 bg-blue-50/80 text-[var(--color-text)]"
                    }`}
                  >
                    {subject ? (
                      <div className="text-[12px] font-semibold text-[var(--color-text)] mb-1.5">{subject}</div>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words text-[var(--color-text-secondary)]">{body}</div>
                    {item.aiSummary && String(item.aiSummary) !== bodyText && String(item.aiSummary) !== body ? (
                      <div className="mt-2 rounded-[var(--radius-md)] bg-white/70 border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] text-[var(--color-text-muted)]">
                        <span className="font-medium text-[var(--color-text-secondary)]">Summary · </span>
                        {String(item.aiSummary)}
                      </div>
                    ) : null}
                    {kind === "meeting" && teamsUrl ? (
                      <a
                        href={teamsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-[12px] font-medium text-[var(--color-accent)] hover:underline"
                      >
                        Join Teams meeting
                      </a>
                    ) : null}
                    {kind === "call" &&
                    ((item.recordingRef && String(item.recordingRef) !== "[hidden]") ||
                      (item.transcriptRef && String(item.transcriptRef) !== "[hidden]")) ? (
                      <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                        {item.recordingRef && canPlayRecording && onViewCall && String(item.recordingRef) !== "[hidden]" ? (
                          <button
                            type="button"
                            className="font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
                            onClick={async () => {
                              const result = await onViewCall(String(item.id), "recording");
                              setArtifactNotice(
                                result
                                  ? "Recording reference viewed — playback follows tenant policy."
                                  : "Could not open recording reference.",
                              );
                            }}
                          >
                            Recording
                          </button>
                        ) : null}
                        {item.transcriptRef && canPlayRecording && onViewCall && String(item.transcriptRef) !== "[hidden]" ? (
                          <button
                            type="button"
                            className="font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
                            onClick={async () => {
                              const result = await onViewCall(String(item.id), "transcript");
                              setArtifactNotice(
                                result
                                  ? "Transcript reference viewed — content stays in VioTalk for POC."
                                  : "Could not open transcript reference.",
                              );
                            }}
                          >
                            Transcript
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {artifactNotice ? <p className="text-[12px] text-[var(--color-text-muted)] mt-2">{artifactNotice}</p> : null}

      {onWrapUp && pending ? (
        <div className="shrink-0 pt-3 mt-1 border-t border-[var(--color-border)] flex items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--color-text-muted)]">This conversation still needs a wrap-up.</p>
          <button type="button" className={btnPrimary} onClick={() => onWrapUp(String(pending.id))}>
            Wrap up
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CommunicationDetailContent({
  item,
  canPlayRecording,
  onViewCall,
  onWrapUp,
  onOpenPerson,
}: {
  item: Record<string, unknown>;
  canPlayRecording?: boolean;
  onViewCall?: (activityId: string, kind: "recording" | "transcript") => Promise<unknown>;
  onWrapUp?: (activityId: string, personId?: string) => void;
  onOpenPerson?: (personId: string) => void;
}) {
  const thread: CommThread = {
    id: String(item.id),
    kind: String(item.kind || ""),
    title: cleanEmailSummary(item.summary) || String(item.summary || channelLabel(item.kind)),
    preview: String(item.body || ""),
    lastAt: String(item.createdAt || ""),
    unread: item.kind === "email" && item.emailIsRead === false,
    wrapUp: item.wrapUp != null ? String(item.wrapUp) : null,
    messages: [item],
  };
  return (
    <div className="space-y-3">
      <CommunicationChatView
        thread={thread}
        canPlayRecording={canPlayRecording}
        onViewCall={onViewCall}
        onWrapUp={
          onWrapUp
            ? (activityId) => {
                const person = item.person as { id?: string } | undefined;
                onWrapUp(activityId, person?.id ? String(person.id) : undefined);
              }
            : undefined
        }
      />
      {onOpenPerson && (item.person as { id?: string } | undefined)?.id ? (
        <button
          type="button"
          className={btnGhost}
          onClick={() => onOpenPerson(String((item.person as { id: string }).id))}
        >
          Open profile
        </button>
      ) : null}
    </div>
  );
}

function CommunicationDetailPane({
  threads,
  selectedId,
  onOpenPerson,
  onWrapUp,
  canPlayRecording,
  onViewCall,
}: {
  threads: CommThread[];
  selectedId: string;
  onOpenPerson?: (personId: string) => void;
  onWrapUp?: (activityId: string, personId: string) => void;
  canPlayRecording?: boolean;
  onViewCall?: (activityId: string, kind: "recording" | "transcript") => Promise<unknown>;
}) {
  const selected =
    threads.find((t) => t.id === selectedId) ||
    threads.find((t) => t.messages.some((m) => String(m.id) === selectedId)) ||
    null;
  if (!selected) {
    return (
      <EmptyState
        title="Select a conversation"
        hint="Pick an email, call, WhatsApp message, meeting, or note from the left list."
      />
    );
  }
  const person = selected.person;
  const pending = selected.messages.find((m) => !m.wrapUp);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Conversation
          </div>
          <div className="text-sm font-semibold text-[var(--color-text)] truncate">
            {person?.name || selected.title}
          </div>
        </div>
        {person?.id ? (
          <TextLink onClick={() => onOpenPerson?.(String(person.id))}>Open profile</TextLink>
        ) : null}
      </div>
      <div className="px-4 py-3 bg-[var(--color-surface-muted)]/50">
        <CommunicationChatView
          thread={selected}
          showPersonHeader={false}
          canPlayRecording={canPlayRecording}
          onViewCall={onViewCall}
          onWrapUp={
            onWrapUp && pending && person?.id
              ? (activityId) => onWrapUp(activityId, String(person.id))
              : onWrapUp && pending
                ? (activityId) => {
                    const msg = selected.messages.find((m) => String(m.id) === activityId);
                    const pid = (msg?.person as { id?: string } | undefined)?.id || person?.id;
                    if (pid) onWrapUp(activityId, String(pid));
                  }
                : undefined
          }
        />
      </div>
    </Card>
  );
}

function Timeline({
  record,
  mode = "communication",
  onAddNote,
  embedded,
  compact,
  canPlayRecording,
  onViewCall,
  onWrapUp,
  onOpenCommunication,
  focusId,
  onFocusConsumed,
}: {
  record: Record<string, unknown> | null;
  mode?: "communication" | "activity" | "notes";
  onAddNote?: () => void;
  embedded?: boolean;
  compact?: boolean;
  canPlayRecording?: boolean;
  onViewCall?: (activityId: string, kind: "recording" | "transcript") => Promise<unknown>;
  onWrapUp?: (activityId: string) => void;
  onOpenCommunication?: (activityId: string) => void;
  focusId?: string | null;
  onFocusConsumed?: () => void;
}) {
  const [channel, setChannel] = useState("All");
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [viewed, setViewed] = useState<Record<string, string>>({});
  const items = ((record?.activityEvents as Record<string, unknown>[]) || []).filter((a) => {
    const kind = String(a.kind);
    if (mode === "notes") return kind === "note" || kind === "internal_note";
    if (mode === "communication") {
      const comm = ["email", "call", "meeting", "whatsapp", "note", "internal_note"].includes(kind);
      if (!comm) return false;
      if (channel === "Emails") return kind === "email";
      if (channel === "Calls") return kind === "call";
      if (channel === "Meetings") return kind === "meeting";
      if (channel === "Messages") return kind === "whatsapp";
      if (channel === "Notes") return kind === "note" || kind === "internal_note";
      return true;
    }
    return true;
  });

  const threads = useMemo(() => {
    if (mode !== "communication") return [];
    // On a person/org record: one conversation stream (all channels) for this contact.
    if (!items.length) return [];
    const chronological = [...items].sort(
      (a, b) => new Date(String(a.createdAt || 0)).getTime() - new Date(String(b.createdAt || 0)).getTime(),
    );
    const latest = chronological[chronological.length - 1];
    const channels = [...new Set(chronological.map((m) => String(m.kind || "")).filter(Boolean))];
    const pending = chronological.some((m) => !m.wrapUp);
    return [
      {
        id: "contact-stream",
        kind: channels.length === 1 ? channels[0] : "conversation",
        title: String((record as { name?: string } | null)?.name || "Conversation"),
        preview: String(latest.summary || latest.body || ""),
        lastAt: String(latest.createdAt || ""),
        unread: chronological.some((m) => m.kind === "email" && m.emailIsRead === false),
        wrapUp: pending ? null : latest.wrapUp != null ? String(latest.wrapUp) : null,
        messages: chronological,
        person: { id: String((record as { id?: string } | null)?.id || ""), name: String((record as { name?: string } | null)?.name || "") },
        channels,
      } satisfies CommThread,
    ];
  }, [items, mode, record]);

  useEffect(() => {
    if (mode !== "communication") return;
    if (!threads.length) {
      setSelectedThreadId("");
      return;
    }
    if (focusId) {
      const match = threads.find(
        (t) => t.id === focusId || t.messages.some((m) => String(m.id) === focusId),
      );
      if (match) {
        setSelectedThreadId(match.id);
        onFocusConsumed?.();
        return;
      }
    }
    setSelectedThreadId(threads[0].id);
  }, [threads, focusId, mode, onFocusConsumed]);

  const title = mode === "notes" ? "Notes" : mode === "activity" ? "Activity" : "Communication";
  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  if (mode === "communication" && compact) {
    const recent = items.slice(0, 8);
    return (
      <div>
        <div className="flex flex-wrap gap-1 mb-3 border-b border-[var(--color-border)] pb-2">
          {["All", "Emails", "Calls", "Meetings", "Notes"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`px-2.5 py-1 text-[12px] cursor-pointer transition-colors border-b-2 -mb-2 ${
                channel === c
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {recent.map((a) => {
            const Icon = channelIcon(a.kind);
            return (
              <li key={String(a.id)}>
                <button
                  type="button"
                  className="w-full text-left py-2.5 cursor-pointer hover:bg-[var(--color-surface-muted)]/80 px-1 rounded-[var(--radius-md)]"
                  onClick={() => onOpenCommunication?.(String(a.id))}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className={`text-[13px] truncate ${a.kind === "email" && a.emailIsRead === false ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>
                          {String(a.kind) === "email" ? cleanEmailSummary(a.summary) || String(a.summary) : String(a.summary)}
                        </div>
                        <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{shortDate(a.createdAt)}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {(a.actor as { name?: string } | undefined)?.name || String(a.source || "system")}
                        {" · "}
                        {wrapUpLabel(a.wrapUp)}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {!recent.length ? <li className="py-3 text-sm text-[var(--color-text-muted)]">No communication yet</li> : null}
        </ul>
      </div>
    );
  }

  if (mode === "communication") {
    const body = (
      <div className={embedded ? "" : "px-0"}>
        <div className="flex flex-wrap gap-1 px-4 pt-2 border-b border-[var(--color-border)]">
          {["All", "Emails", "Calls", "Meetings", "Messages", "Notes"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`px-2.5 py-2 text-[12px] cursor-pointer transition-colors border-b-2 -mb-px ${
                channel === c
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {!selectedThread ? (
          <div className="px-4 pb-4 pt-4">
            <EmptyState
              title="No communication yet"
              hint="Emails, calls, meetings, WhatsApp, and notes for this contact appear here in one timeline."
            />
          </div>
        ) : (
          <div className="p-4 min-h-[360px] bg-[var(--color-surface-muted)]/40">
            <CommunicationChatView
              thread={selectedThread}
              showPersonHeader={false}
              canPlayRecording={canPlayRecording}
              onViewCall={onViewCall}
              onWrapUp={onWrapUp}
            />
          </div>
        )}
      </div>
    );
    if (embedded) return body;
    return (
      <Card>
        <CardHeader title={title} />
        {body}
      </Card>
    );
  }

  const body = (
      <div className={embedded ? "" : "px-4 py-3"}>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={String(a.id)} className="border-l-2 border-blue-600 pl-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm">{String(a.summary)}</div>
              <Tag tone="slate">{channelLabel(a.kind)}</Tag>
            </div>
            <div className="text-xs text-slate-500">
              {(a.actor as { name?: string } | undefined)?.name || String(a.source || "system")} · {fmtDate(a.createdAt)} · wrap-up {String(a.wrapUp || "pending")}
            </div>
            {a.body && mode === "notes" ? <div className="text-sm mt-1 text-slate-700">{String(a.body)}</div> : null}
            {a.aiSummary ? <div className="text-xs mt-1 text-slate-600">{String(a.aiSummary)}</div> : null}
            {a.kind === "meeting" && teamsJoinUrlFromBody(a.body) ? (
              <a
                href={teamsJoinUrlFromBody(a.body) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-700 hover:underline"
              >
                Join Teams
              </a>
            ) : null}
            {a.kind === "call" ? (
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                {a.recordingRef ? (
                  canPlayRecording && onViewCall && String(a.recordingRef) !== "[hidden]" ? (
                    <button
                      type="button"
                      className="text-blue-700 hover:underline cursor-pointer"
                      onClick={async () => {
                        const result = await onViewCall(String(a.id), "recording");
                        setViewed((prev) => ({ ...prev, [`${a.id}-recording`]: JSON.stringify(result) }));
                      }}
                    >
                      View recording ref
                    </button>
                  ) : (
                    <span className="text-slate-500">Recording ref stored</span>
                  )
                ) : null}
                {a.transcriptRef ? (
                  canPlayRecording && onViewCall && String(a.transcriptRef) !== "[hidden]" ? (
                    <button
                      type="button"
                      className="text-blue-700 hover:underline cursor-pointer"
                      onClick={async () => {
                        const result = await onViewCall(String(a.id), "transcript");
                        setViewed((prev) => ({ ...prev, [`${a.id}-transcript`]: JSON.stringify(result) }));
                      }}
                    >
                      View transcript ref
                    </button>
                  ) : (
                    <span className="text-slate-500">Transcript ref stored</span>
                  )
                ) : null}
                {viewed[`${a.id}-recording`] ? (
                  <div className="w-full text-[11px] text-slate-600 break-all">{viewed[`${a.id}-recording`]}</div>
                ) : null}
                {viewed[`${a.id}-transcript`] ? (
                  <div className="w-full text-[11px] text-slate-600 break-all">{viewed[`${a.id}-transcript`]}</div>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
        {!items.length ? <li className="text-sm text-slate-400">Nothing logged yet</li> : null}
      </ul>
      {mode === "notes" && onAddNote ? (
        <button type="button" className={`${btnGhost} mt-3`} onClick={onAddNote}>
          Add note
        </button>
      ) : null}
    </div>
  );
  if (embedded) return body;
  return (
    <Card>
      <CardHeader title={title} action={mode === "notes" && onAddNote ? <TextLink onClick={onAddNote}>Add</TextLink> : undefined} />
      {body}
    </Card>
  );
}
function Commercial({
  record,
  canViewMsa,
  canViewPo,
  onView,
}: {
  record: Record<string, unknown> | null;
  canViewMsa?: boolean;
  canViewPo?: boolean;
  onView?: (kind: "msa" | "po", id: string) => Promise<unknown>;
}) {
  const [notice, setNotice] = useState<Record<string, string>>({});
  const pos = (record?.purchaseOrders as Record<string, unknown>[]) || [];
  const msas = (record?.msaDocuments as Record<string, unknown>[]) || [];
  return (
    <div className="space-y-3 text-sm">
      <div>
        <h3 className="font-semibold">MSA</h3>
        {msas.map((m) => (
          <div key={String(m.id)} className="flex flex-wrap items-center gap-2 py-1">
            <span>
              {String(m.number)} · {String(m.status)} · expires {fmtDate(m.expiresAt)}
            </span>
            {canViewMsa && onView ? (
              <button
                type="button"
                className="text-xs text-blue-700 hover:underline cursor-pointer"
                onClick={async () => {
                  const data = await onView("msa", String(m.id));
                  if (data) {
                    setNotice((prev) => ({
                      ...prev,
                      [String(m.id)]: "View recorded — file download is not available in POC",
                    }));
                  }
                }}
              >
                View
              </button>
            ) : null}
            {notice[String(m.id)] ? <span className="w-full text-xs text-slate-500">{notice[String(m.id)]}</span> : null}
          </div>
        ))}
        {!msas.length ? <div className="text-slate-400">None on file</div> : null}
      </div>
      <div>
        <h3 className="font-semibold">PO</h3>
        {pos.map((p) => (
          <div key={String(p.id)} className="flex flex-wrap items-center gap-2 py-1">
            <span>
              {String(p.number)} · {p.ceiling == null ? "amount hidden" : `$${p.utilized} / $${p.ceiling}`}
            </span>
            {canViewPo && onView ? (
              <button
                type="button"
                className="text-xs text-blue-700 hover:underline cursor-pointer"
                onClick={async () => {
                  const data = await onView("po", String(p.id));
                  if (data) {
                    setNotice((prev) => ({
                      ...prev,
                      [String(p.id)]: "View recorded — file download is not available in POC",
                    }));
                  }
                }}
              >
                View
              </button>
            ) : null}
            {notice[String(p.id)] ? <span className="w-full text-xs text-slate-500">{notice[String(p.id)]}</span> : null}
          </div>
        ))}
        {!pos.length ? <div className="text-slate-400">None on file</div> : null}
      </div>
    </div>
  );
}
function WrapForm({
  proposed,
  busy,
  onClose,
  onSave,
}: {
  proposed: string;
  busy: boolean;
  onClose: () => void;
  onSave: (v: { outcome: string; nextActionTitle?: string; dueAt?: string }) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState("next_action");
  const [title, setTitle] = useState(proposed);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ outcome, nextActionTitle: title, dueAt: new Date(Date.now() + 86400000).toISOString() });
      }}
    >
      <h2 className="text-lg font-semibold">Wrap-up</h2>
      <p className="text-sm text-slate-600">Every call, email, meeting, interview or waiting submission resolves here.</p>
      {["next_action", "no_action_required", "closed"].map((o) => (
        <label key={o} className="block">
          <input type="radio" name="o" checked={outcome === o} onChange={() => setOutcome(o)} /> {o.replaceAll("_", " ")}
        </label>
      ))}
      {outcome === "next_action" ? (
        <input className="w-full border rounded px-2 py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Next action" />
      ) : null}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={busy}>
          Save
        </button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function SubmitForm({
  requirements,
  files,
  defaultResumeName,
  onClose,
  onSave,
}: {
  requirements: Record<string, unknown>[];
  files: { id?: string; name: string; kind?: string; source?: string }[];
  defaultResumeName: string;
  onClose: () => void;
  onSave: (v: { requirementId: string; clientPersonId: string; message: string; resumeName: string }) => Promise<void>;
}) {
  const resumeOptions = [...files].sort((a, b) => {
    const aResume = a.kind === "resume" ? 0 : 1;
    const bResume = b.kind === "resume" ? 0 : 1;
    if (aResume !== bResume) return aResume - bResume;
    return String(a.name).localeCompare(String(b.name));
  });
  const initial =
    resumeOptions.find((f) => f.kind === "resume")?.name ||
    resumeOptions[0]?.name ||
    defaultResumeName ||
    "resume.pdf";
  const [requirementId, setRequirementId] = useState(String(requirements[0]?.id || ""));
  const selectedReq = requirements.find((r) => String(r.id) === requirementId);
  const hiringManager = selectedReq?.hiringManager as { id?: string; name?: string } | undefined;
  const [clientPersonId, setClientPersonId] = useState(String(hiringManager?.id || ""));
  const [resumeName, setResumeName] = useState(initial);
  const [customResume, setCustomResume] = useState(!resumeOptions.some((f) => f.name === initial));
  const [message, setMessage] = useState("Please find the attached profile for your open requirement.");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          requirementId,
          clientPersonId: clientPersonId || String(hiringManager?.id || ""),
          message,
          resumeName: resumeName.trim() || "resume.pdf",
        });
      }}
    >
      <h2 className="text-lg font-semibold">Submit Profile</h2>
      <p className="text-xs text-slate-500">Select a Client job + Client person. Compose here. Send via Outlook. No template catalog. Creates a Submission ID.</p>
      <label className="block text-sm">
        Requirement
        <FieldSelect
          wrapClassName="mt-1"
          value={requirementId}
          onChange={(e) => {
            setRequirementId(e.target.value);
            const next = requirements.find((r) => String(r.id) === e.target.value);
            const hm = next?.hiringManager as { id?: string } | undefined;
            setClientPersonId(String(hm?.id || ""));
          }}
          required
        >
          {requirements.map((r) => (
            <option key={String(r.id)} value={String(r.id)}>
              {String((r.organization as { name?: string } | undefined)?.name || "")} — {String(r.title)}
            </option>
          ))}
        </FieldSelect>
      </label>
      <label className="block text-sm">
        Client person
        <FieldSelect wrapClassName="mt-1" value={clientPersonId} onChange={(e) => setClientPersonId(e.target.value)} required>
          {hiringManager?.id ? <option value={hiringManager.id}>{hiringManager.name || "Hiring manager"}</option> : <option value="">No hiring manager on this job</option>}
        </FieldSelect>
      </label>
      <label className="block text-sm">
        Resume / document name
        {resumeOptions.length && !customResume ? (
          <FieldSelect
            wrapClassName="mt-1"
            value={resumeName}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setCustomResume(true);
                return;
              }
              setResumeName(e.target.value);
            }}
            required
          >
            {resumeOptions.map((f) => (
              <option key={f.id || f.name} value={f.name}>
                {f.name}
                {f.kind === "resume" ? " (resume)" : ""}
                {f.source === "JobsNProfiles" ? " · JNP" : " · Manual"}
              </option>
            ))}
            <option value="__custom__">Other name…</option>
          </FieldSelect>
        ) : (
          <input
            className="mt-1 w-full border rounded px-2 py-2"
            value={resumeName}
            onChange={(e) => setResumeName(e.target.value)}
            required
          />
        )}
      </label>
      {customResume && resumeOptions.length ? (
        <button type="button" className="text-xs text-blue-700 cursor-pointer" onClick={() => setCustomResume(false)}>
          Choose from Files list
        </button>
      ) : null}
      <p className="text-xs text-slate-500">Attachment label for Outlook: {resumeName.trim() || "resume.pdf"}</p>
      <textarea className="w-full border rounded px-2 py-2 h-28" value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex gap-2">
        <button className={btnPrimary}>Send</button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function CreateForm({
  moduleKey,
  onClose,
  onSave,
}: {
  moduleKey: string;
  onClose: () => void;
  onSave: (vals: Record<string, unknown>) => Promise<{ id?: string } | null | void>;
}) {
  const kind =
    moduleKey === "vendors" ? "vendor_person" : moduleKey === "clients" ? "client_person" : "candidate";
  const isCandidate = kind === "candidate";
  const label =
    kind === "vendor_person" ? "Vendor person" : kind === "client_person" ? "Client person" : "Candidate";
  const [busy, setBusy] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [vals, setVals] = useState({
    name: "",
    title: "",
    secondaryTitle: "",
    email: "",
    phone: "",
    location: "",
    linkedIn: "",
    timezone: "",
    availability: "",
    experienceYears: "",
    skills: "",
    citizenship: "",
    workAuthorization: "",
    visaExpiry: "",
    willingToRelocate: "",
    preferredLocation: "",
    noticePeriod: "",
    employmentType: "",
    currentRate: "",
    expectedRate: "",
    resumeName: "",
  });
  const set = (key: keyof typeof vals) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setVals((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({
            action: "create_person",
            kind,
            ...vals,
            preferredLocation: vals.preferredLocation || vals.location,
            resumeName: resumeFile?.name || vals.resumeName || "",
            resumeFile,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Add {label}</h2>
      <Label>Name</Label>
      <FieldInput value={vals.name} onChange={set("name")} required />
      <Label>Title</Label>
      <FieldInput value={vals.title} onChange={set("title")} placeholder={isCandidate ? "Primary title" : "Role"} />
      {isCandidate ? (
        <>
          <Label>Secondary title</Label>
          <FieldInput value={vals.secondaryTitle} onChange={set("secondaryTitle")} />
        </>
      ) : null}
      <Label>Email</Label>
      <FieldInput type="email" value={vals.email} onChange={set("email")} />
      <Label>Phone</Label>
      <FieldInput value={vals.phone} onChange={set("phone")} />
      <Label>Current location</Label>
      <FieldInput value={vals.location} onChange={set("location")} placeholder="City, ST" />
      {isCandidate ? (
        <>
          <Label>Skills</Label>
          <FieldInput value={vals.skills} onChange={set("skills")} placeholder="Java, Spring Boot, AWS" />
          <Label>Experience (years)</Label>
          <FieldInput type="number" min={0} value={vals.experienceYears} onChange={set("experienceYears")} />
          <Label>Time zone</Label>
          <FieldInput value={vals.timezone} onChange={set("timezone")} placeholder="PT / CT / ET" />
          <Label>Citizenship</Label>
          <FieldInput value={vals.citizenship} onChange={set("citizenship")} placeholder="United States, India, …" />
          <Label>Work authorization</Label>
          <FieldSelect className="w-full" value={vals.workAuthorization} onChange={set("workAuthorization")}>
            <option value="">Select</option>
            {WORK_AUTH_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </FieldSelect>
          <Label>Visa / EAD expiry</Label>
          <FieldInput type="date" value={vals.visaExpiry} onChange={set("visaExpiry")} />
          <Label>Willing to relocate</Label>
          <FieldSelect className="w-full" value={vals.willingToRelocate} onChange={set("willingToRelocate")}>
            <option value="">Select</option>
            {RELOCATE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </FieldSelect>
          <Label>Preferred location</Label>
          <FieldInput value={vals.preferredLocation} onChange={set("preferredLocation")} />
          <Label>Availability</Label>
          <FieldInput value={vals.availability} onChange={set("availability")} placeholder="Available / Immediate" />
          <Label>Notice period</Label>
          <FieldInput value={vals.noticePeriod} onChange={set("noticePeriod")} placeholder="2 weeks" />
          <Label>Employment type</Label>
          <FieldSelect className="w-full" value={vals.employmentType} onChange={set("employmentType")}>
            <option value="">Select</option>
            {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </FieldSelect>
          <Label>Current rate</Label>
          <FieldInput value={vals.currentRate} onChange={set("currentRate")} placeholder="$75/hr" />
          <Label>Expected rate</Label>
          <FieldInput value={vals.expectedRate} onChange={set("expectedRate")} placeholder="$85/hr" />
          <Label>LinkedIn</Label>
          <FieldInput value={vals.linkedIn} onChange={set("linkedIn")} />
          <Label>Resume</Label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setResumeFile(file);
              setVals((prev) => ({ ...prev, resumeName: file?.name || "" }));
            }}
          />
          {resumeFile ? (
            <p className="text-xs text-slate-500">
              Will upload <span className="font-medium text-slate-700">{resumeFile.name}</span> so you can Preview it on
              Files.
            </p>
          ) : (
            <p className="text-xs text-slate-500">Optional. Upload a PDF resume to store and preview on this candidate.</p>
          )}
        </>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button className={btnPrimary} disabled={busy}>{busy ? "Creating…" : "Create"}</button>
        <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function EditForm({
  record,
  onClose,
  onSave,
}: {
  record: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (vals: Record<string, string>) => Promise<void>;
}) {
  const isCandidate = record?.kind === "candidate";
  const [vals, setVals] = useState({
    name: String(record?.name || ""),
    title: String(record?.title || ""),
    secondaryTitle: String(record?.secondaryTitle || ""),
    email: String(record?.email || ""),
    phone: String(record?.phone || ""),
    location: String(record?.location || ""),
    linkedIn: String(record?.linkedIn || ""),
    timezone: String(record?.timezone || ""),
    availability: String(record?.availability || ""),
    experienceYears: String(record?.experienceYears || ""),
    skills: Array.isArray(record?.skills) ? (record?.skills as string[]).join(", ") : String(record?.skills || ""),
    citizenship: String(record?.citizenship || ""),
    workAuthorization: String(record?.workAuthorization || ""),
    visaExpiry: record?.visaExpiry ? new Date(String(record.visaExpiry)).toISOString().slice(0, 10) : "",
    willingToRelocate: String(record?.willingToRelocate || ""),
    preferredLocation: String(record?.preferredLocation || ""),
    noticePeriod: String(record?.noticePeriod || ""),
    employmentType: String(record?.employmentType || ""),
    currentRate: String(record?.currentRate || ""),
    expectedRate: String(record?.expectedRate || ""),
  });
  const set = (key: keyof typeof vals) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setVals((prev) => ({ ...prev, [key]: e.target.value }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(vals);
      }}
    >
      <h2 className="text-lg font-semibold">Edit contact</h2>
      <Label>Name</Label>
      <FieldInput value={vals.name} onChange={set("name")} required />
      <Label>Title</Label>
      <FieldInput value={vals.title} onChange={set("title")} />
      {isCandidate ? (
        <>
          <Label>Secondary title</Label>
          <FieldInput value={vals.secondaryTitle} onChange={set("secondaryTitle")} />
          <Label>Skills</Label>
          <FieldInput value={vals.skills} onChange={set("skills")} placeholder="Java, Spring Boot, AWS" />
          <Label>Experience (years)</Label>
          <FieldInput type="number" min={0} value={vals.experienceYears} onChange={set("experienceYears")} />
        </>
      ) : null}
      <Label>Email</Label>
      <FieldInput type="email" value={vals.email} onChange={set("email")} />
      <Label>Phone</Label>
      <FieldInput value={vals.phone} onChange={set("phone")} />
      <Label>Current location</Label>
      <FieldInput value={vals.location} onChange={set("location")} placeholder="City, ST" />
      {isCandidate ? (
        <>
          <Label>Time zone</Label>
          <FieldInput value={vals.timezone} onChange={set("timezone")} placeholder="PT / CT / ET" />
          <Label>Citizenship</Label>
          <FieldInput value={vals.citizenship} onChange={set("citizenship")} placeholder="United States, India, …" />
          <Label>Work authorization</Label>
          <FieldSelect className="w-full" value={vals.workAuthorization} onChange={set("workAuthorization")}>
            <option value="">Select</option>
            {WORK_AUTH_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </FieldSelect>
          <Label>Visa / EAD expiry</Label>
          <FieldInput type="date" value={vals.visaExpiry} onChange={set("visaExpiry")} />
          <Label>Willing to relocate</Label>
          <FieldSelect className="w-full" value={vals.willingToRelocate} onChange={set("willingToRelocate")}>
            <option value="">Select</option>
            {RELOCATE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </FieldSelect>
          <Label>Preferred location</Label>
          <FieldInput value={vals.preferredLocation} onChange={set("preferredLocation")} />
          <Label>Availability / notice</Label>
          <FieldInput value={vals.availability} onChange={set("availability")} />
          <Label>Notice period</Label>
          <FieldInput value={vals.noticePeriod} onChange={set("noticePeriod")} />
          <Label>Employment type</Label>
          <FieldSelect className="w-full" value={vals.employmentType} onChange={set("employmentType")}>
            <option value="">Select</option>
            {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </FieldSelect>
          <Label>Current rate</Label>
          <FieldInput value={vals.currentRate} onChange={set("currentRate")} placeholder="$75/hr" />
          <Label>Expected rate</Label>
          <FieldInput value={vals.expectedRate} onChange={set("expectedRate")} placeholder="$85/hr" />
          <Label>LinkedIn</Label>
          <FieldInput value={vals.linkedIn} onChange={set("linkedIn")} />
        </>
      ) : null}
      <div className="flex gap-2">
        <button className={btnPrimary}>Save</button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EmailForm({
  to,
  contactName,
  mailbox,
  signatures,
  onClose,
  onSave,
  onSaveSignature,
}: {
  to: string;
  contactName?: string;
  mailbox: string | null;
  signatures: { id: string; name: string; body: string; isDefault: boolean }[];
  onClose: () => void;
  onSave: (v: {
    to: string;
    cc: string;
    subject: string;
    body: string;
    includeSignature: boolean;
    signatureId?: string;
  }) => Promise<void>;
  onSaveSignature: (v: {
    id?: string;
    name: string;
    body: string;
    isDefault: boolean;
  }) => Promise<boolean>;
}) {
  const defaultSig = signatures.find((s) => s.isDefault) || signatures[0] || null;
  const [dest, setDest] = useState(to);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedSigId, setSelectedSigId] = useState(defaultSig?.id || "");
  const [includeSignature, setIncludeSignature] = useState(Boolean(defaultSig?.body?.trim()));
  const [editingSignature, setEditingSignature] = useState(false);
  const [creatingSignature, setCreatingSignature] = useState(false);
  const [sigName, setSigName] = useState(defaultSig?.name || "Default");
  const [sigBody, setSigBody] = useState(defaultSig?.body || "");
  const [sigDefault, setSigDefault] = useState(true);
  const [sigBusy, setSigBusy] = useState(false);
  const [sigNotice, setSigNotice] = useState("");

  useEffect(() => {
    const nextDefault = signatures.find((s) => s.isDefault) || signatures[0] || null;
    const stillSelected = signatures.find((s) => s.id === selectedSigId);
    const pick = stillSelected || nextDefault;
    setSelectedSigId(pick?.id || "");
    setIncludeSignature(Boolean(pick?.body?.trim()));
    if (!editingSignature && !creatingSignature) {
      setSigName(pick?.name || "Default");
      setSigBody(pick?.body || "");
      setSigDefault(Boolean(pick?.isDefault || !signatures.length));
    }
    // Sync when parent refreshes signatures only — don't reset mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedSigId / edit flags are intentional guards, not triggers
  }, [signatures]);

  const activeSig = signatures.find((s) => s.id === selectedSigId) || defaultSig;
  const previewSignature =
    includeSignature && (editingSignature || creatingSignature ? sigBody : activeSig?.body || "").trim()
      ? (editingSignature || creatingSignature ? sigBody : activeSig?.body || "").trim()
      : "";
  const canSend = Boolean(mailbox && dest.trim() && subject.trim() && body.trim());

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          to: dest,
          cc,
          subject,
          body,
          includeSignature,
          signatureId: selectedSigId || undefined,
        });
      }}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Send Email</h2>
        <p className="mt-1 text-xs text-slate-500">
          Compose in TalentBridge and send as the signed-in Outlook mailbox. Signatures are personal identity footers —
          not a template catalog.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">From</span>
          <span className="font-medium text-slate-900">{mailbox || "Outlook not connected"}</span>
          {contactName ? (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600">Regarding {contactName}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>To</Label>
          <FieldInput
            type="email"
            required
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="recipient@company.com"
          />
        </div>
        <div>
          <Label>Cc</Label>
          <FieldInput
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="optional@company.com, another@company.com"
          />
        </div>
        <div>
          <Label>Subject</Label>
          <FieldInput
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label>Message</Label>
            <span className="text-[11px] text-slate-500">{body.length} characters</span>
          </div>
          <textarea
            className="h-40 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <label className="flex items-center gap-2 text-[13px] text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
              checked={includeSignature}
              disabled={!activeSig?.body?.trim() && !sigBody.trim()}
              onChange={(e) => setIncludeSignature(e.target.checked)}
            />
            Attach signature
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {signatures.length > 1 ? (
              <select
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-800"
                value={selectedSigId}
                onChange={(e) => {
                  setSelectedSigId(e.target.value);
                  setIncludeSignature(true);
                  setEditingSignature(false);
                  setCreatingSignature(false);
                }}
              >
                {signatures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            ) : activeSig ? (
              <span className="text-[13px] text-slate-500">({activeSig.name})</span>
            ) : null}
            <button
              type="button"
              className="text-[13px] font-medium text-blue-700 hover:underline cursor-pointer"
              onClick={() => {
                if (creatingSignature) {
                  setCreatingSignature(false);
                  return;
                }
                setCreatingSignature(true);
                setEditingSignature(false);
                setSigName("New signature");
                setSigBody("");
                setSigDefault(!signatures.length);
                setSigNotice("");
              }}
            >
              {creatingSignature ? "Cancel new" : "New"}
            </button>
            {activeSig ? (
              <button
                type="button"
                className="text-[13px] font-medium text-blue-700 hover:underline cursor-pointer"
                onClick={() => {
                  setEditingSignature((v) => !v);
                  setCreatingSignature(false);
                  setSigName(activeSig.name);
                  setSigBody(activeSig.body);
                  setSigDefault(activeSig.isDefault);
                  setSigNotice("");
                }}
              >
                {editingSignature ? "Close editor" : "Edit"}
              </button>
            ) : null}
          </div>
        </div>

        {editingSignature || creatingSignature ? (
          <div className="space-y-3 p-3">
            <p className="text-xs text-slate-500">
              Saved to your TalentBridge profile. Manage all signatures in Settings → Email signature.
            </p>
            <div>
              <Label>Signature name</Label>
              <FieldInput value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder="Default" />
            </div>
            <div>
              <Label>Signature body</Label>
              <textarea
                className="mt-1 h-40 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                value={sigBody}
                onChange={(e) => setSigBody(e.target.value)}
                placeholder={"Paste Outlook HTML, or plain text:\nRegards,\nYour Name\nTitle | Company"}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {sigBody.length}/{MAX_EMAIL_SIGNATURE_CHARS} · HTML is sent to Outlook as HTML, not escaped as text.
              </p>
              {sigBody.trim() ? (
                <div className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      How it looks in Outlook
                    </p>
                  </div>
                  <SignaturePreview body={sigBody} />
                </div>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                checked={sigDefault}
                onChange={(e) => setSigDefault(e.target.checked)}
              />
              Set as default signature
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={sigBusy}
                onClick={async () => {
                  setSigBusy(true);
                  setSigNotice("");
                  try {
                    const ok = await onSaveSignature({
                      id: creatingSignature ? undefined : activeSig?.id,
                      name: sigName || "Default",
                      body: sigBody,
                      isDefault: sigDefault,
                    });
                    if (ok) {
                      setSigNotice("Signature saved.");
                      setIncludeSignature(Boolean(sigBody.trim()));
                      setEditingSignature(false);
                      setCreatingSignature(false);
                    }
                  } finally {
                    setSigBusy(false);
                  }
                }}
              >
                {sigBusy ? "Saving…" : creatingSignature ? "Create signature" : "Save signature"}
              </button>
              <button
                type="button"
                className={btnGhost}
                disabled={sigBusy}
                onClick={() => {
                  setEditingSignature(false);
                  setCreatingSignature(false);
                }}
              >
                Cancel
              </button>
            </div>
            {sigNotice ? <p className="text-xs text-emerald-700">{sigNotice}</p> : null}
          </div>
        ) : previewSignature ? (
          <div className="overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                How it looks in Outlook
              </p>
            </div>
            <SignaturePreview body={previewSignature} />
          </div>
        ) : (
          <p className="px-3 py-2 text-xs text-slate-500">
            No signature saved yet. Create one here or in Settings → Email signature.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button className={btnPrimary} disabled={!canSend}>
          Send via Outlook
        </button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MeetingForm({
  people,
  requirements,
  defaultPersonId,
  mailbox,
  onClose,
  onSave,
}: {
  people: { id: string; name: string; email: string; kind: string; title: string }[];
  requirements: Record<string, unknown>[];
  defaultPersonId: string;
  mailbox: string | null;
  onClose: () => void;
  onSave: (v: {
    personId: string;
    title: string;
    startsAt: string;
    endsAt: string;
    body: string;
    extraAttendees: string;
    teams: boolean;
    requirementId?: string;
    asInterview: boolean;
  }) => Promise<void>;
}) {
  const startDefault = (() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  })();
  const [personId, setPersonId] = useState(defaultPersonId || people[0]?.id || "");
  const selected = people.find((p) => p.id === personId);
  const [title, setTitle] = useState(selected ? `Meeting with ${selected.name}` : "");
  const [start, setStart] = useState(toLocalInput(startDefault));
  const [duration, setDuration] = useState("30");
  const [body, setBody] = useState("");
  const [extra, setExtra] = useState("");
  const [teams, setTeams] = useState(true);
  const [asInterview, setAsInterview] = useState(selected?.kind === "candidate");
  const [requirementId, setRequirementId] = useState(String(requirements[0]?.id || ""));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const startsAt = new Date(start);
        const endsAt = new Date(startsAt.getTime() + Number(duration) * 60000);
        onSave({
          personId,
          title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          body,
          extraAttendees: extra,
          teams,
          requirementId: asInterview ? requirementId : undefined,
          asInterview,
        });
      }}
    >
      <h2 className="text-lg font-semibold">Schedule meeting</h2>
      <p className="text-xs text-slate-500">
        Creates a Microsoft Teams meeting on the mapped Outlook calendar and a TalentBridge calendar item. Wrap-up is required after scheduling.
        {mailbox ? ` Organizer mailbox ${mailbox}.` : " Map a mailbox in Settings first."}
      </p>
      <label className="block text-sm">
        With
        <FieldSelect wrapClassName="mt-1" value={personId} onChange={(e) => {
          const next = e.target.value;
          setPersonId(next);
          const p = people.find((x) => x.id === next);
          if (p) {
            setTitle((current) => (current.startsWith("Meeting with") || current.startsWith("Interview") ? `Meeting with ${p.name}` : current));
            setAsInterview(p.kind === "candidate");
          }
        }} required>
          <option value="">Select a person</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.email ? `· ${p.email}` : ""} {p.kind === "candidate" ? "(candidate)" : p.kind === "client_person" ? "(client)" : ""}
            </option>
          ))}
        </FieldSelect>
      </label>
      <Label>Title</Label>
      <FieldInput required value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label>Start</Label>
      <FieldInput type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
      <label className="block text-sm">
        Duration
        <FieldSelect wrapClassName="mt-1" value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
        </FieldSelect>
      </label>
      <Label>Extra attendees</Label>
      <FieldInput value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="other@client.com" />
      <textarea className="w-full border rounded px-2 py-2 h-24" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Agenda" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={teams} onChange={(e) => setTeams(e.target.checked)} />
        Create Microsoft Teams meeting
      </label>
      {selected?.kind === "candidate" && requirements.length ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asInterview} onChange={(e) => setAsInterview(e.target.checked)} />
            Also create an Interview on the selected job
          </label>
          {asInterview ? (
            <label className="block text-sm">
              Requirement
              <FieldSelect wrapClassName="mt-1" value={requirementId} onChange={(e) => setRequirementId(e.target.value)} required>
                {requirements.map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {String((r.organization as { name?: string } | undefined)?.name || "")} — {String(r.title)}
                  </option>
                ))}
              </FieldSelect>
            </label>
          ) : null}
        </>
      ) : null}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={!mailbox || !personId}>
          Schedule
        </button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NoteForm({ onClose, onSave }: { onClose: () => void; onSave: (body: string, vis: "shared" | "internal") => Promise<void> }) {
  const [body, setBody] = useState("");
  const [vis, setVis] = useState<"shared" | "internal">("shared");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(body, vis);
      }}
    >
      <h2 className="text-lg font-semibold">Note</h2>
      <textarea className="w-full border rounded h-32 p-2" value={body} onChange={(e) => setBody(e.target.value)} />
      <FieldSelect value={vis} onChange={(e) => setVis(e.target.value as "shared" | "internal")}>
        <option value="shared">Shared (timeline)</option>
        <option value="internal">Internal (team only)</option>
      </FieldSelect>
      <div className="flex gap-2">
        <button className={btnPrimary}>Save</button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function JnpForm({
  onClose,
  onSave,
  mapped,
  accessCode,
}: {
  onClose: () => void;
  onSave: (id: string) => Promise<void>;
  mapped?: boolean;
  accessCode?: string;
}) {
  const [id, setId] = useState("JNP-104582");
  const denied =
    accessCode === "requester_disabled"
      ? "Your JobsNProfiles user is disabled. Re-enable it in JobsNProfiles, then sign in again."
      : accessCode === "subscription_inactive"
        ? "JobsNProfiles subscription is missing or expired. Renew it, then sign in again."
        : accessCode === "requester_unknown"
          ? "Mapped JobsNProfiles user was not found. Ask an administrator to re-authenticate the JNP map."
          : accessCode === "tenant_not_allowed"
            ? "JobsNProfiles is not allowed for this organization. A platform administrator must enable it on the tenant."
            : accessCode === "pending" || accessCode === "error"
              ? "JobsNProfiles access is still confirming from sign-in. You can try Pull; the first request will refresh access if needed."
              : accessCode && accessCode !== "ok" && accessCode !== "not_mapped"
                ? "JobsNProfiles access was not confirmed. Sign in again, or ask an administrator to Authenticate in Settings → JNP map."
                : "";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mapped) return;
        onSave(id);
      }}
    >
      <h2 className="text-lg font-semibold">Sync candidate from JobsNProfiles</h2>
      <p className="text-xs">One-way candidate pull. Never writes back. Collision goes to the duplicate queue.</p>
      <p className="text-xs text-slate-600">
        Entitlement refreshes in the background at sign-in and again if the snapshot is older than 2 hours. Sync and preview are rate-limited per user and organization.
      </p>
      {!mapped && accessCode === "not_mapped" ? (
        <p className="text-xs text-red-700">
          No JobsNProfiles recruiter mapped for you, and this tenant has no JNP account id. Ask an administrator to map one in Settings → JNP map.
        </p>
      ) : null}
      {!mapped && denied && accessCode !== "not_mapped" ? <p className="text-xs text-red-700">{denied}</p> : null}
      {mapped && denied ? <p className="text-xs text-amber-800">{denied}</p> : null}
      <input className="w-full border rounded px-2 py-2" value={id} onChange={(e) => setId(e.target.value)} disabled={!mapped} />
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={!mapped}>
          Pull
        </button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function ReqForm({
  users,
  onClose,
  onSave,
}: {
  users: Record<string, unknown>[];
  onClose: () => void;
  onSave: (v: { title: string; skills: string; location: string; assignedRecruiterIds: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const recruiter = users.find((u) => (u.memberships as { role: string }[] | undefined)?.[0]?.role === "recruiter");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title,
          skills: "Java, AWS",
          location: "Remote",
          assignedRecruiterIds: recruiter ? [String(recruiter.id)] : [],
        });
      }}
    >
      <h2 className="text-lg font-semibold">Requirement</h2>
      <input className="w-full border rounded px-2 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="flex gap-2">
        <button className={btnPrimary}>Create</button>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
