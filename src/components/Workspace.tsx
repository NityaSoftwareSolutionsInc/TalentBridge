"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { availabilityBadge, Avatar, btnGhost, btnPrimary, Button, Card, CardHeader, cn, EmptyState, FieldInput, FieldSelect, IconBtn, IconButton, IconChip, IconOnly, InlineError, Label, LinkedInIcon, LoadingSkeleton, MenuItem, shortDate, Tag, tagTone, Tabs, TextLink, timeZoneHint, WhatsAppIcon } from "./workspace-ui";
import { AppShell } from "./AppShell";
import { SettingsPane, CreateUserForm, inviteStatusMeta } from "./SettingsPane";
import { DashList, DashPane } from "./DashboardPane";
import { ListPager } from "./ListPager";
import { ListToolbar, sortRecords } from "./ListToolbar";
import { paginate, parsePageSize, readStoredPageSize, storePageSize } from "@/lib/paging";
import { EMPLOYMENT_TYPE_OPTIONS, RELOCATE_OPTIONS, WORK_AUTH_OPTIONS } from "@/lib/candidate-fields";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  CloudUpload,
  ExternalLink,
  FileText,
  Hash,
  Lock,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  Star,
  UserRound,
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
  recordingPlaybackAllowed?: boolean;
};

type Drawer = "none" | "call" | "wrap" | "submit" | "note" | "jnp" | "req" | "create" | "create-user" | "edit";

export function Workspace({ moduleKey }: { moduleKey: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id") || "";
  const [session, setSession] = useState<Session | null>(null);
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [activityEvents, setActivityEvents] = useState<Record<string, unknown>[]>([]);
  const [requirements, setRequirements] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [globalHits, setGlobalHits] = useState<Record<string, { id: string; name: string; module?: string; personId?: string; type?: string }[]> | null>(null);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<Drawer>("none");
  const [tab, setTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [callActivityId, setCallActivityId] = useState<string | null>(null);
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
  const listSource =
    moduleKey === "tasks" || moduleKey === "calendar"
      ? tasks
      : moduleKey === "communications"
        ? activityEvents
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
    next.set("id", id);
    if (type) next.set("type", type);
    else next.delete("type");
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
    if (data.activityEvents) setActivityEvents(data.activityEvents);
    if (data.requirements) setRequirements(data.requirements);
    if (data.users) setUsers(data.users);
    if (data.settings || data.maps || data.forbidden) setSettings(data);
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

  useEffect(() => {
    if (selectedId) return;
    if (!list.length) return;
    if (!["candidates", "clients", "vendors"].includes(moduleKey)) return;
    const next = new URLSearchParams(params.toString());
    next.set("id", String(list[0].id));
    next.set("type", "person");
    router.replace(`/${moduleKey}?${next.toString()}`);
  }, [list, selectedId, moduleKey, params, router]);

  useEffect(() => {
    if (!selectedId || moduleKey === "settings") {
      if (!selectedId || moduleKey === "settings") setRecord(null);
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

  async function onCall() {
    if (!selectedId) return;
    const data = await act({ action: "call", personId: selectedId });
    if (data) {
      setCallActivityId(data.activityId);
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
    const res = await fetch(`/api/workspace?global=1&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setGlobalHits(data.results);
  }

  const dnc = Boolean(record?.doNotReach);
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
    ? "No mailbox mapped for Outlook send"
    : blockEmail
      ? "Do not reach / Do Not Email is on — outbound email disabled."
      : "Submit Profile";
  const isCandidate = record?.kind === "candidate";
  const isOrganization = record?.type === "organization";
  const company = ((record?.companies as { id: string; name: string; role?: string; industry?: string; location?: string }[]) || [])[0];
  const peopleOnOrganization = (record?.people as { person: { id: string; name: string; title: string; status?: string }; roleOnOrganization?: string }[]) || [];
  const internalNotes = ((record?.activityEvents as Record<string, unknown>[]) || []).filter((a) => a.kind === "internal_note");
  const files = (record?.files as { name: string }[]) || [];
  const upcoming = (record?.upcoming as { id: string; title: string; dueAt?: string }[]) || [];
  const contactTags = ((record?.tags as string[]) || []).filter((t) => t && t !== record?.status);
  const avail = availabilityBadge(record?.availability, record?.status);
  const canSeeRates = Boolean(session?.permissions.includes("submit") || session?.permissions.includes("po"));
  const jnpUrl = record?.portalCandidateId ? `https://jobs.nprofiles.example/candidates/${String(record.portalCandidateId)}` : "";
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
    moduleKey === "settings" ? (
      <Button onClick={() => setDrawer("create-user")}>
        <Plus className="h-4 w-4" />
        Add user
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
        onClearHits={() => setGlobalHits(null)}
        onNavigate={(href) => router.push(href)}
        onSignOut={signOut}
        primaryAction={primaryAction}
      >
        <section className="w-[260px] lg:w-[300px] xl:w-[360px] shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col">
          {moduleKey === "settings" ? (
            <div className="px-3.5 pt-3 pb-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center gap-2 min-h-7">
                <h2 className="font-semibold text-[15px] leading-none text-[var(--color-text)]">Users</h2>
                <span className="shrink-0 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                  {((settings?.users as unknown[]) || []).length}
                </span>
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
            ) : moduleKey === "tasks" || moduleKey === "calendar" ? (
              pageSlice.items.map((t) => (
                <button key={String(t.id)} onClick={() => t.personId && router.push(`/candidates?id=${t.personId}&type=person`)} className="w-full text-left px-4 py-3 border-b hover:bg-slate-50 cursor-pointer">
                  <div className="text-sm font-medium">{String(t.title)}</div>
                  <div className="text-xs text-slate-500">{t.dueAt ? shortDate(t.dueAt) : "No due date"}</div>
                </button>
              ))
            ) : moduleKey === "communications" ? (
              pageSlice.items.map((a) => (
                <button key={String(a.id)} onClick={() => a.personId && router.push(`/candidates?id=${a.personId}&type=person`)} className="w-full text-left px-4 py-3 border-b hover:bg-slate-50 cursor-pointer">
                  <div className="text-sm font-medium">{String(a.summary)}</div>
                  <div className="text-xs text-slate-500">Unworked · wrap-up required</div>
                </button>
              ))
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

        <section className="flex-1 overflow-auto bg-[var(--color-canvas)]">
          {error ? (
            <div className="m-4">
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
            <SettingsPane
              data={settings}
              session={session}
              busy={busy}
              selectedUserId={selectedId || null}
              onAction={act}
            />
          ) : !record && moduleKey !== "dashboard" && moduleKey !== "reports" ? (
            busy ? (
              <div className="p-6">
                <LoadingSkeleton rows={8} />
              </div>
            ) : (
              <div className="p-8">
                <EmptyState
                  title="Select a record"
                  hint="Filters stay when you open, call, or submit. Pick someone from the list to work the next action."
                />
              </div>
            )
          ) : moduleKey === "dashboard" || moduleKey === "reports" ? (
            <DashPane dash={dash} onOpen={(m, id) => router.push(id ? `/${m}?id=${id}` : `/${m}`)} />
          ) : (
            <div className="min-h-full">
              <div className="bg-[var(--color-surface)]">
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
                          <Button variant="secondary" onClick={() => setDrawer("edit")}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {isCandidate && jnpUrl ? (
                            <Button variant="secondary" onClick={() => window.open(jnpUrl, "_blank", "noopener")}>
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open JobsNProfiles
                            </Button>
                          ) : company?.id ? (
                            <Button variant="secondary" onClick={() => select(company.id, "organization")}>
                              <Building2 className="h-3.5 w-3.5" />
                              View Company
                            </Button>
                          ) : null}
                          <div className="relative">
                            <IconButton icon={MoreHorizontal} label="More actions" onClick={() => setMenu(menu === "more" ? "none" : "more")} />
                            {menu === "more" ? (
                              <div className="absolute right-0 mt-1 z-30 w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                                <MenuItem icon={Mail} onClick={() => { setMenu("none"); setDrawer("note"); }}>Send Email</MenuItem>
                                <MenuItem icon={Phone} disabled={callBlocked} title={callWhy} onClick={() => { setMenu("none"); onCall(); }}>VioTalk Call</MenuItem>
                                <MenuItem icon={CalendarDays} onClick={() => { setMenu("none"); setDrawer("wrap"); }}>Add Follow-up</MenuItem>
                                {isCandidate ? <MenuItem icon={CloudUpload} disabled={submitBlocked} title={submitWhy} onClick={() => { setMenu("none"); setDrawer("submit"); }}>Submit Profile</MenuItem> : null}
                                {isCandidate ? <MenuItem icon={RefreshCw} onClick={() => { setMenu("none"); setDrawer("jnp"); }}>JNP sync</MenuItem> : null}
                                {company?.id && isCandidate ? (
                                  <MenuItem icon={Building2} onClick={() => { setMenu("none"); select(company.id, "organization"); }}>View Company</MenuItem>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                          {record?.email ? (
                            <IconChip icon={Mail} tone="blue" onClick={() => setDrawer("note")}>{String(record.email)}</IconChip>
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
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                          {record?.linkedIn ? (
                            <IconOnly
                              icon={LinkedInIcon}
                              label="LinkedIn"
                              tone="blue"
                              href={`https://${String(record.linkedIn).replace(/^https?:\/\//, "")}`}
                              title={String(record.linkedIn)}
                            />
                          ) : isCandidate ? (
                            <IconOnly icon={LinkedInIcon} label="LinkedIn" tone="blue" disabled title="No LinkedIn on file" />
                          ) : null}
                          {record?.portalCandidateId ? (
                            <IconChip icon={Hash} tone="blue" href={jnpUrl || undefined} title="JobsNProfiles ID">
                              {String(record.portalCandidateId)}
                            </IconChip>
                          ) : null}
                          {isCandidate ? (
                            <IconChip icon={Phone} tone="blue" disabled={callBlocked} onClick={onCall} title={callWhy}>
                              {shortDate(record?.lastOutreachAt, true) || "Call"}
                            </IconChip>
                          ) : null}
                          <IconChip icon={CalendarDays} onClick={() => setDrawer("wrap")} title={String(record?.nextAction || "Follow-up")}>
                            {shortDate(record?.nextActionDueAt, true) || "Follow-up"}
                          </IconChip>
                        </div>
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

              <div className="p-4 sm:p-5 space-y-4">

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
                          <IconBtn disabled={blockEmail} onClick={() => setDrawer("note")} label="Send Email" title={blockEmail ? "Do not reach / Do Not Email" : ""} />
                          <IconBtn disabled={callBlocked} title={callWhy} onClick={onCall} label="VioTalk Call" />
                          <IconBtn disabled title="WhatsApp channel not live in POC" label="WhatsApp" />
                          <IconBtn onClick={() => setDrawer("wrap")} label="Schedule Meeting" />
                          <IconBtn onClick={() => setDrawer("note")} label="Add Note" />
                          <IconBtn onClick={() => setDrawer("wrap")} label="Add Follow-up" />
                          {session?.permissions.includes("submit") ? (
                            <IconBtn disabled={submitBlocked} title={submitWhy} onClick={() => setDrawer("submit")} label="Submit Profile" />
                          ) : null}
                          <div className="relative">
                            <IconBtn onClick={() => setMenu(menu === "qa-more" ? "none" : "qa-more")} label="More" />
                            {menu === "qa-more" ? (
                              <div className="absolute left-0 bottom-full mb-1 z-30 w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                                <MenuItem icon={RefreshCw} onClick={() => { setMenu("none"); setDrawer("jnp"); }}>JNP sync</MenuItem>
                                <MenuItem icon={CalendarDays} onClick={() => { setMenu("none"); setDrawer("wrap"); }}>Add Follow-up</MenuItem>
                                {company?.id ? <MenuItem icon={Building2} onClick={() => { setMenu("none"); select(company.id, "organization"); }}>View Company</MenuItem> : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                      <Card>
                        <CardHeader title="Recent Communication" action={<TextLink onClick={() => setTab("Communication")}>View all</TextLink>} />
                        <div className="px-4 py-3">
                          <Timeline record={record} embedded />
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
                            ["Work Email", record?.email],
                            ["Phone", record?.phone],
                            ["Location", timeZoneHint(record?.location)],
                            ["Time Zone", /pst/i.test(timeZoneHint(record?.location)) ? "PST" : /cst/i.test(timeZoneHint(record?.location)) ? "CST" : "—"],
                            ["LinkedIn", record?.linkedIn],
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
                          <IconBtn disabled={blockEmail} onClick={() => setDrawer("note")} label="Send Email" title={blockEmail ? "Do not reach / Do Not Email" : ""} />
                          <IconBtn disabled={callBlocked} title={callWhy} onClick={onCall} label="VioTalk Call" />
                          <IconBtn disabled title="WhatsApp channel not live in POC" label="WhatsApp" />
                          <IconBtn onClick={() => setDrawer("wrap")} label="Schedule Meeting" />
                          <IconBtn onClick={() => setDrawer("note")} label="Add Note" />
                          <IconBtn onClick={() => setDrawer("wrap")} label="Add Follow-up" />
                          <div className="relative">
                            <IconBtn onClick={() => setMenu(menu === "qa-more" ? "none" : "qa-more")} label="More" />
                            {menu === "qa-more" ? (
                              <div className="absolute left-0 bottom-full mb-1 z-30 w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                                <MenuItem icon={CalendarDays} onClick={() => { setMenu("none"); setDrawer("wrap"); }}>Add Follow-up</MenuItem>
                                {company?.id ? <MenuItem icon={Building2} onClick={() => { setMenu("none"); select(company.id, "organization"); }}>View Company</MenuItem> : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                      <Card>
                        <CardHeader title="Recent Communication" action={<TextLink onClick={() => setTab("Communication")}>View all</TextLink>} />
                        <div className="px-4 py-3">
                          <Timeline record={record} embedded />
                        </div>
                      </Card>
                      <Card>
                        <CardHeader title="Files" action={<TextLink onClick={() => setTab("Files")}>View all</TextLink>} />
                        <ul className="px-2 pb-2">
                          {files.map((d) => (
                            <li key={d.name}>
                              <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-blue-700 hover:bg-blue-50 cursor-pointer" onClick={() => setTab("Files")}>
                                <FileText className="h-4 w-4" />
                                {d.name}
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
                    onAddRequirement={() => setDrawer("req")}
                    onAddNote={() => setDrawer("note")}
                    onSubmit={() => setDrawer("submit")}
                    onOpenPerson={(id) => router.push(`/clients?id=${id}&type=person`)}
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
                    personId: selectedId,
                    activityId: callActivityId,
                    ...vals,
                  });
                  setDrawer("none");
                  setCallActivityId(null);
                }}
              />
            ) : null}
            {drawer === "submit" ? (
              <SubmitForm
                requirements={requirements}
                onClose={() => setDrawer("none")}
                onSave={async (vals) => {
                  const data = await act({ action: "submit", candidateId: selectedId, ...vals });
                  if (data) {
                    setCallActivityId(data.activityId);
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
                  setDrawer("wrap");
                }}
              />
            ) : null}
            {drawer === "jnp" ? (
              <JnpForm
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
                  const data = await act(vals);
                  if (data?.id) {
                    select(String(data.id), "person");
                  }
                  setDrawer("none");
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
  const href =
    kind === "linkedin" || kind === "url"
      ? /^https?:\/\//i.test(text)
        ? text
        : `https://${text.replace(/^\/+/, "")}`
      : "";
  return href ? <TextLink href={href}>{label || text}</TextLink> : text;
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
    [
      "Skills",
      <span key="skills" className="flex flex-wrap gap-1">
        {((record?.skills as string[]) || []).map((s) => (
          <Tag key={s} tone="slate">{s}</Tag>
        ))}
      </span>,
    ],
    ["Experience", record?.experienceYears ? `${record.experienceYears} years` : "—"],
    ["Email", contactLink("email", record?.email)],
    ["Phone", contactLink("phone", record?.phone)],
    ["LinkedIn", contactLink("linkedin", record?.linkedIn)],
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
        <div key={label} className="rounded-lg bg-[#e6f4f1] border border-emerald-100 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
          <div className="text-[13px] font-semibold text-slate-900 truncate" title={value}>{value}</div>
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
  onAddRequirement,
  onAddNote,
  onSubmit,
  onOpenPerson,
}: {
  tab: string;
  record: Record<string, unknown> | null;
  isOrganization: boolean;
  isCandidate: boolean;
  relatedPeople: { id?: string; name: string; title: string; badge: string; tone: "blue" | "purple" | "amber" }[];
  canAddRequirement: boolean;
  jnpUrl: string;
  onAddRequirement: () => void;
  onAddNote: () => void;
  onSubmit: () => void;
  onOpenPerson: (id: string) => void;
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
    return <Timeline record={record} mode="communication" />;
  }
  if (tab === "Activity") {
    return <Timeline record={record} mode="activity" />;
  }
  if (tab === "Tasks") {
    return <TasksPane record={record} />;
  }
  if (tab === "Notes") {
    return <Timeline record={record} mode="notes" onAddNote={onAddNote} />;
  }
  if (tab === "Files") {
    return <FilesPane record={record} />;
  }
  if (tab === "Relationships" || tab === "People") {
    return <RelationshipsPane record={record} relatedPeople={relatedPeople} onOpen={onOpenPerson} />;
  }
  if (tab === "MSA/PO") {
    return (
      <Card>
        <CardHeader title="MSA & Purchase Orders" />
        <div className="p-4">
          <Commercial record={record} />
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
    outcome?: string;
    candidate?: { name?: string };
    organization?: { name?: string };
    requirement?: { title?: string };
  }[]) || [];
  return (
    <Card>
      <CardHeader title="Interviews" />
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((i) => (
            <li key={i.id} className="px-4 py-3 flex items-start gap-3">
              <CalendarDays className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{i.requirement?.title || "Interview"}</div>
                <div className="text-xs text-slate-500">
                  {[i.candidate?.name, i.organization?.name, shortDate(i.scheduledAt)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Tag tone={i.outcome === "pending" ? "amber" : i.outcome === "passed" ? "green" : "slate"}>{i.outcome || "pending"}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No interviews scheduled" hint="Interviews attach to a Submission and Requirement on this record." />
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

function FilesPane({ record }: { record: Record<string, unknown> | null }) {
  const files = (record?.files as { id?: string; name: string; kind?: string; createdAt?: string }[]) || [];
  const resume = String(record?.lastResume || "");
  const rows = files.length
    ? files
    : resume
      ? [{ name: resume, kind: "resume" }]
      : [];
  return (
    <Card>
      <CardHeader title="Files" />
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((d) => (
            <li key={d.id || d.name} className="px-4 py-3 flex items-center gap-3">
              <FileText className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{d.name}</div>
                <div className="text-xs text-slate-500">{d.kind || "file"}{d.createdAt ? ` · ${shortDate(d.createdAt)}` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No files" hint="Resumes and files on this record appear here. JobsNProfiles remains the profile source." />
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
function Timeline({
  record,
  mode = "communication",
  onAddNote,
  embedded,
}: {
  record: Record<string, unknown> | null;
  mode?: "communication" | "activity" | "notes";
  onAddNote?: () => void;
  embedded?: boolean;
}) {
  const [channel, setChannel] = useState("All");
  const items = ((record?.activityEvents as Record<string, unknown>[]) || []).filter((a) => {
    const kind = String(a.kind);
    if (mode === "notes") return kind === "note" || kind === "internal_note";
    if (mode === "communication") {
      const comm = ["email", "call", "meeting", "whatsapp", "note"].includes(kind);
      if (!comm) return false;
      if (channel === "Emails") return kind === "email";
      if (channel === "Calls") return kind === "call";
      if (channel === "Notes") return kind === "note" || kind === "internal_note";
      return true;
    }
    return true;
  });
  const title = mode === "notes" ? "Notes" : mode === "activity" ? "Activity" : "Communication";
  const body = (
      <div className={embedded ? "" : "px-4 py-3"}>
      {mode === "communication" ? (
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          {["All", "Emails", "Calls", "Notes"].map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`rounded-full px-2.5 py-1 cursor-pointer transition-colors ${channel === c ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={String(a.id)} className="border-l-2 border-blue-600 pl-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm">{String(a.summary)}</div>
              <Tag tone="slate">{String(a.kind)}</Tag>
            </div>
            <div className="text-xs text-slate-500">
              {(a.actor as { name?: string } | undefined)?.name || String(a.source || "system")} · {fmtDate(a.createdAt)} · wrap-up {String(a.wrapUp || "pending")}
            </div>
            {a.body && mode === "notes" ? <div className="text-sm mt-1 text-slate-700">{String(a.body)}</div> : null}
            {a.aiSummary ? <div className="text-xs mt-1 text-slate-600">{String(a.aiSummary)}</div> : null}
            {a.kind === "call" ? (
              <div className="mt-1 flex gap-3 text-xs">
                {a.recordingRef ? <span className="text-slate-500">Recording {String(a.recordingRef)}</span> : null}
                {a.transcriptRef ? <span className="text-slate-500">Transcript {String(a.transcriptRef)}</span> : null}
              </div>
            ) : null}
          </li>
        ))}
        {!items.length ? (
          <li className="text-sm text-slate-400">
            {mode === "notes" ? "No notes yet" : mode === "activity" ? "No activity yet" : "No communication yet"}
          </li>
        ) : null}
      </ul>
      </div>
  );
  if (embedded) return body;
  return (
    <Card>
      <CardHeader title={title} action={mode === "notes" && onAddNote ? <TextLink onClick={onAddNote}>+ Add Note</TextLink> : undefined} />
      {body}
    </Card>
  );
}
function Commercial({ record }: { record: Record<string, unknown> | null }) {
  const pos = (record?.purchaseOrders as Record<string, unknown>[]) || [];
  const msas = (record?.msaDocuments as Record<string, unknown>[]) || [];
  return (
    <div className="space-y-3 text-sm">
      <div>
        <h3 className="font-semibold">MSA</h3>
        {msas.map((m) => (
          <div key={String(m.id)}>
            {String(m.number)} · {String(m.status)} · expires {fmtDate(m.expiresAt)}
          </div>
        ))}
        {!msas.length ? <div className="text-slate-400">None on file</div> : null}
      </div>
      <div>
        <h3 className="font-semibold">PO</h3>
        {pos.map((p) => (
          <div key={String(p.id)}>
            {String(p.number)} · {p.ceiling == null ? "amount hidden" : `$${p.utilized} / $${p.ceiling}`}
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
  onClose,
  onSave,
}: {
  requirements: Record<string, unknown>[];
  onClose: () => void;
  onSave: (v: { requirementId: string; clientPersonId: string; message: string; resumeName: string }) => Promise<void>;
}) {
  const [requirementId, setRequirementId] = useState(String(requirements[0]?.id || ""));
  const selectedReq = requirements.find((r) => String(r.id) === requirementId);
  const hiringManager = selectedReq?.hiringManager as { id?: string; name?: string } | undefined;
  const [clientPersonId, setClientPersonId] = useState(String(hiringManager?.id || ""));
  const [resumeName, setResumeName] = useState("resume.pdf");
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
          resumeName,
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
        Resume
        <input className="w-full border rounded px-2 py-2" value={resumeName} onChange={(e) => setResumeName(e.target.value)} />
      </label>
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
  onSave: (vals: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const kind =
    moduleKey === "vendors" ? "vendor_person" : moduleKey === "clients" ? "client_person" : "candidate";
  const label =
    kind === "vendor_person" ? "Vendor person" : kind === "client_person" ? "Client person" : "Candidate";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ action: "create_person", name, kind });
      }}
    >
      <h2 className="text-lg font-semibold">Add {label}</h2>
      <input className="w-full border rounded px-2 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="flex gap-2">
        <button className={btnPrimary}>Create</button>
        <button type="button" className={btnGhost} onClick={onClose}>
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
function JnpForm({ onClose, onSave }: { onClose: () => void; onSave: (id: string) => Promise<void> }) {
  const [id, setId] = useState("JNP-104582");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(id);
      }}
    >
      <h2 className="text-lg font-semibold">JobsNProfiles one-way sync</h2>
      <p className="text-xs">Never writes back. Collision goes to duplicate queue.</p>
      <input className="w-full border rounded px-2 py-2" value={id} onChange={(e) => setId(e.target.value)} />
      <div className="flex gap-2">
        <button className={btnPrimary}>Pull</button>
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
