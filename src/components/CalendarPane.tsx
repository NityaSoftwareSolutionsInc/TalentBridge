"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { Button, EmptyState, Tag, TextLink, cn, shortDate } from "./workspace-ui";

export type CalendarItem = {
  id: string;
  kind: "meeting" | "interview" | "follow_up" | "msa_review" | "po_renewal" | string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  location?: string;
  teamsJoinUrl?: string;
  personId?: string | null;
  personName?: string;
  organizationName?: string;
  requirementTitle?: string;
  organizerName?: string;
  attendees?: string[];
  body?: string;
  href?: string;
};

const KIND_META: Record<string, { label: string; chip: string; tag: "blue" | "purple" | "amber" | "slate" | "red" }> = {
  meeting: { label: "Teams meeting", chip: "bg-blue-600", tag: "blue" },
  interview: { label: "Interview", chip: "bg-indigo-600", tag: "purple" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_PX = 52;
const DAY_VIEWS = ["month", "week", "day"] as const;
type CalendarView = (typeof DAY_VIEWS)[number];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function mondayOf(d: Date) {
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, offset));
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = mondayOf(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function formatTime(iso: string, allDay?: boolean) {
  if (allDay) return "All day";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatRange(item: CalendarItem) {
  if (item.allDay) return shortDate(item.startsAt);
  const start = new Date(item.startsAt);
  const end = new Date(item.endsAt);
  if (Number.isNaN(start.getTime())) return "";
  const date = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const from = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const to = Number.isNaN(end.getTime()) ? "" : end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return to ? `${date} · ${from} – ${to}` : `${date} · ${from}`;
}

function kindMeta(kind: string) {
  return KIND_META[kind] || KIND_META.meeting;
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function layoutDayEvents(items: CalendarItem[], day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const timed = items
    .filter((event) => !event.allDay)
    .map((event) => {
      const startMs = new Date(event.startsAt).getTime();
      const rawEnd = new Date(event.endsAt).getTime();
      const endMs = Number.isNaN(rawEnd) || rawEnd <= startMs ? startMs + 30 * 60000 : rawEnd;
      const from = Math.max(startMs, dayStart);
      const to = Math.min(endMs, dayEnd);
      const startMin = (from - dayStart) / 60000;
      const endMin = Math.max(startMin + 15, (to - dayStart) / 60000);
      return {
        event,
        startMin,
        endMin,
        top: (startMin / 60) * HOUR_PX,
        height: Math.max(((endMin - startMin) / 60) * HOUR_PX, 22),
        col: 0,
        cols: 1,
      };
    })
    .filter((row) => row.endMin > 0 && row.startMin < 24 * 60)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const active: typeof timed = [];
  for (const row of timed) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= row.startMin) active.splice(i, 1);
    }
    const used = new Set(active.map((r) => r.col));
    let col = 0;
    while (used.has(col)) col += 1;
    row.col = col;
    active.push(row);
    const cols = active.length;
    for (const open of active) open.cols = Math.max(open.cols, cols);
  }
  return timed;
}

export function CalendarPane({
  events,
  selectedId,
  onSelect,
  onSchedule,
  onOpenHref,
  graphLive,
  mailbox,
}: {
  events: CalendarItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onSchedule: () => void;
  onOpenHref?: (href: string) => void;
  graphLive?: boolean;
  mailbox?: string | null;
}) {
  const today = startOfDay(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [focusDay, setFocusDay] = useState(() => startOfDay(new Date()));
  const dayScrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => (view === "month" ? monthGrid(cursor) : Array.from({ length: 7 }, (_, i) => addDays(mondayOf(cursor), i))), [cursor, view]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const event of events) {
      const key = startOfDay(new Date(event.startsAt)).toDateString();
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const selected = events.find((e) => e.id === selectedId) || null;
  const dayEvents = byDay.get(focusDay.toDateString()) || [];
  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const dayLayout = useMemo(() => layoutDayEvents(dayEvents, focusDay), [dayEvents, focusDay]);
  const heading =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
        ? `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : focusDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function shift(delta: number) {
    if (view === "day") {
      setFocusDay((current) => startOfDay(addDays(current, delta)));
      setCursor((current) => startOfDay(addDays(current, delta)));
      onSelect("");
      return;
    }
    setCursor((current) => {
      const next = new Date(current);
      if (view === "month") next.setMonth(next.getMonth() + delta);
      else next.setDate(next.getDate() + delta * 7);
      return startOfDay(next);
    });
  }

  function goToToday() {
    const next = startOfDay(new Date());
    setView("day");
    setCursor(next);
    setFocusDay(new Date(next.getTime()));
    const items = byDay.get(next.toDateString()) || [];
    onSelect(items[0]?.id || "");
  }

  function openDay(day: Date, eventId?: string) {
    const next = startOfDay(day);
    setView("day");
    setCursor(next);
    setFocusDay(next);
    onSelect(eventId || "");
  }

  const nowMinutes = sameDay(focusDay, today) ? new Date().getHours() * 60 + new Date().getMinutes() : null;

  useEffect(() => {
    if (view !== "day" || !dayScrollRef.current) return;
    const now = new Date();
    const minutes = sameDay(focusDay, startOfDay(now)) ? now.getHours() * 60 + now.getMinutes() : 8 * 60;
    const top = Math.max(0, (minutes / 60) * HOUR_PX - 96);
    dayScrollRef.current.scrollTo({ top, behavior: "smooth" });
  }, [view, focusDay]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className="h-8 w-8 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] cursor-pointer" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="h-8 w-8 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] cursor-pointer" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-[15px] font-semibold text-[var(--color-text)] min-w-[12rem]">{heading}</h2>
        {view === "day" ? (
          <p className="text-[11px] font-medium tabular-nums text-[var(--color-text-muted)]">00:00 – 23:59</p>
        ) : (
          <p className="text-[11px] text-[var(--color-text-muted)] hidden lg:block">Created in TalentBridge only</p>
        )}
        <Button variant="secondary" onClick={goToToday}>
          Today
        </Button>
        <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
          {DAY_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-3 h-8 text-[12px] font-medium capitalize cursor-pointer",
                view === v ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tag tone={graphLive ? "green" : "slate"}>{graphLive ? "Graph live" : "Graph stub"}</Tag>
          <Button onClick={onSchedule} disabled={!mailbox} title={mailbox ? "Schedule a Teams meeting from TalentBridge" : "No mailbox mapped for Outlook / Teams"}>
            Schedule meeting
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
        <div className={cn("min-h-0 p-3 sm:p-4", view === "day" ? "flex flex-col overflow-hidden" : "overflow-auto")}>
          {view === "day" ? (
            <DayTimeline
              scrollRef={dayScrollRef}
              day={focusDay}
              isToday={sameDay(focusDay, today)}
              nowMinutes={nowMinutes}
              allDayEvents={allDayEvents}
              layout={dayLayout}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ) : (
            <>
          <div className="grid grid-cols-7 gap-px bg-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-[var(--color-surface-muted)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const inMonth = day.getMonth() === cursor.getMonth() || view === "week";
              const items = byDay.get(day.toDateString()) || [];
              const max = view === "week" ? 8 : 3;
              const extra = items.length - max;
              const focused = sameDay(day, focusDay);
              const isToday = sameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => openDay(day, items[0]?.id)}
                  className={cn(
                    "min-h-[7.5rem] text-left p-1.5 bg-[var(--color-surface)] hover:bg-blue-50/60 cursor-pointer align-top",
                    view === "week" && "min-h-[14rem]",
                    !inMonth && "bg-slate-50 text-slate-400",
                    focused && "ring-2 ring-inset ring-[var(--color-focus)]",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                        isToday ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {items.length ? <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{items.length}</span> : null}
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, max).map((event) => {
                      const meta = kindMeta(event.kind);
                      return (
                        <div
                          key={event.id}
                          role="presentation"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDay(day, event.id);
                          }}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[11px] leading-4 text-white",
                            meta.chip,
                            selectedId === event.id && "ring-2 ring-offset-1 ring-slate-900",
                          )}
                          title={event.title}
                        >
                          {event.allDay ? event.title : `${formatTime(event.startsAt)} ${event.title}`}
                        </div>
                      );
                    })}
                    {extra > 0 ? <div className="text-[10px] text-[var(--color-text-muted)] px-1">+{extra} more</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-muted)]">
            {Object.entries(KIND_META).map(([key, meta]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", meta.chip)} />
                {meta.label}
              </span>
            ))}
          </div>
            </>
          )}
        </div>

        <aside className="border-t xl:border-t-0 xl:border-l border-[var(--color-border)] bg-[var(--color-surface)] min-h-0 overflow-auto">
          {selected ? (
            <div className="p-4 space-y-3">
              <Tag tone={kindMeta(selected.kind).tag}>{kindMeta(selected.kind).label}</Tag>
              <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{selected.title}</h3>
              <p className="text-[13px] text-[var(--color-text-secondary)]">{formatRange(selected)}</p>
              {selected.location ? <p className="text-[12px] text-[var(--color-text-muted)]">{selected.location}</p> : null}
              {selected.personName ? (
                <p className="text-[13px]">
                  With{" "}
                  {selected.href && onOpenHref ? (
                    <TextLink onClick={() => onOpenHref(selected.href!)}>{selected.personName}</TextLink>
                  ) : (
                    selected.personName
                  )}
                  {selected.organizationName ? ` · ${selected.organizationName}` : ""}
                </p>
              ) : selected.organizationName && selected.href && onOpenHref ? (
                <TextLink onClick={() => onOpenHref(selected.href!)}>{selected.organizationName}</TextLink>
              ) : selected.organizationName ? (
                <p className="text-[13px]">{selected.organizationName}</p>
              ) : null}
              {selected.requirementTitle ? <p className="text-[12px] text-[var(--color-text-muted)]">{selected.requirementTitle}</p> : null}
              {selected.organizerName ? <p className="text-[12px] text-[var(--color-text-muted)]">Organizer {selected.organizerName}</p> : null}
              {selected.teamsJoinUrl ? (
                <Button href={selected.teamsJoinUrl} className="w-full justify-center">
                  <Video className="h-4 w-4" />
                  Join Teams
                </Button>
              ) : null}
              {selected.body ? <p className="text-[13px] text-[var(--color-text-secondary)] whitespace-pre-wrap">{selected.body}</p> : null}
            </div>
          ) : (
            <div className="p-4">
              <h3 className="text-[13px] font-semibold mb-2">{focusDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
              {dayEvents.length ? (
                <ul className="space-y-2">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <button type="button" className="w-full text-left rounded-[var(--radius-md)] px-2 py-2 hover:bg-[var(--color-surface-muted)] cursor-pointer" onClick={() => onSelect(event.id)}>
                        <div className="text-[13px] font-medium">{event.title}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">{formatTime(event.startsAt, event.allDay)}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nothing scheduled this day" hint="Only Teams meetings and interviews created from TalentBridge appear here — not the rest of Outlook." />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DayTimeline({
  scrollRef,
  day,
  isToday,
  nowMinutes,
  allDayEvents,
  layout,
  selectedId,
  onSelect,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  day: Date;
  isToday: boolean;
  nowMinutes: number | null;
  allDayEvents: CalendarItem[];
  layout: ReturnType<typeof layoutDayEvents>;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="shrink-0 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] flex items-center justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold text-[var(--color-text)]">
            {day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
            {isToday ? "Today · " : ""}
            00:00 – 23:59
          </div>
        </div>
        <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
          {layout.length + allDayEvents.length
            ? `${layout.length + allDayEvents.length} TalentBridge meeting${layout.length + allDayEvents.length === 1 ? "" : "s"}`
            : "No meetings this day"}
        </span>
      </div>
      {allDayEvents.length ? (
        <div className="shrink-0 px-3 py-2 border-b border-[var(--color-border)] space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">All day</div>
          {allDayEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event.id)}
              className={cn(
                "w-full text-left truncate rounded px-2 py-1 text-[12px] text-white cursor-pointer",
                kindMeta(event.kind).chip,
                selectedId === event.id && "ring-2 ring-offset-1 ring-slate-900",
              )}
            >
              {event.title}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div className="relative min-w-[20rem]" style={{ height: 24 * HOUR_PX }}>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-[var(--color-border)]"
              style={{ top: hour * HOUR_PX, height: HOUR_PX }}
            >
              <div className="sticky left-0 w-14 -mt-2 pl-2 text-[11px] tabular-nums text-[var(--color-text-muted)] bg-[var(--color-surface)]">
                {hourLabel(hour)}
              </div>
            </div>
          ))}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[var(--color-border-strong)] pointer-events-none"
            style={{ top: 24 * HOUR_PX }}
          >
            <div className="w-14 -mt-2 pl-2 text-[11px] tabular-nums text-[var(--color-text-muted)]">23:59</div>
          </div>
          {nowMinutes != null ? (
            <div
              className="absolute left-12 right-2 z-20 pointer-events-none flex items-center"
              style={{ top: (nowMinutes / 60) * HOUR_PX }}
            >
              <span className="h-2 w-2 rounded-full bg-[var(--color-danger)] -ml-1" />
              <span className="flex-1 border-t-2 border-[var(--color-danger)]" />
            </div>
          ) : null}
          {layout.map((row) => {
            const meta = kindMeta(row.event.kind);
            const left = `calc(3.5rem + (100% - 4rem) * ${row.col / row.cols})`;
            const width = `calc((100% - 4rem) / ${row.cols} - 4px)`;
            return (
              <button
                key={row.event.id}
                type="button"
                onClick={() => onSelect(row.event.id)}
                title={`${formatTime(row.event.startsAt)} – ${formatTime(row.event.endsAt)} ${row.event.title}`}
                className={cn(
                  "absolute z-10 overflow-hidden rounded-[var(--radius-md)] px-2 py-1 text-left text-white cursor-pointer shadow-[var(--shadow-sm)]",
                  meta.chip,
                  selectedId === row.event.id && "ring-2 ring-offset-1 ring-slate-900",
                )}
                style={{ top: row.top, height: row.height, left, width }}
              >
                <div className="text-[11px] font-semibold leading-4 truncate">{row.event.title}</div>
                <div className="text-[10px] leading-3 opacity-90 tabular-nums">
                  {formatTime(row.event.startsAt)} – {formatTime(row.event.endsAt)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarAgenda({
  events,
  selectedId,
  onSelect,
}: {
  events: CalendarItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (!events.length) {
    return <div className="px-4 py-8 text-sm text-slate-400">No TalentBridge meetings yet. Use Schedule meeting.</div>;
  }
  return (
    <>
      {events.map((event) => {
        const meta = kindMeta(event.kind);
        const selected = selectedId === event.id;
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event.id)}
            className={cn(
              "w-full text-left px-4 py-3 border-b cursor-pointer flex items-start gap-3",
              selected ? "bg-blue-50 border-l-4 border-l-[var(--color-accent)]" : "hover:bg-slate-50 border-l-4 border-l-transparent",
            )}
          >
            <CalendarDays className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{event.title}</div>
              <div className="text-xs text-slate-500">{formatRange(event)}</div>
              <div className="mt-1">
                <Tag tone={meta.tag}>{meta.label}</Tag>
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}
