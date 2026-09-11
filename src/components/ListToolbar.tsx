"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { cn, FieldSelect, FilterChip, moduleLabel } from "./workspace-ui";
import { LOCATION_OPTIONS, WORK_AUTH_OPTIONS } from "@/lib/candidate-fields";

export type ListFilters = {
  q: string;
  title: string;
  skills: string;
  location: string;
  experience: string;
  owner: string;
  source: string;
  availability: string;
  lastOutreach: string;
  excludeRequirementId: string;
  workAuthorization: string;
  sort: string;
};

const FILTER_KEYS = [
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
] as const;

const CHIP_LABEL: Record<(typeof FILTER_KEYS)[number], string> = {
  q: "Search",
  title: "Title",
  skills: "Skills",
  location: "Location",
  experience: "Experience",
  owner: "Recruiter",
  source: "Source",
  availability: "Availability",
  lastOutreach: "Last outreach",
  excludeRequirementId: "Exclude submitted",
  workAuthorization: "Work auth",
};

const textControl =
  "h-8 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-text)] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus-ring)]";

const selectControl = "h-8 text-[12px] text-[var(--color-text)]";

export function sortRecords<T extends Record<string, unknown>>(rows: T[], sort: string): T[] {
  const copy = [...rows];
  const time = (v: unknown) => {
    if (!v) return 0;
    const t = new Date(String(v)).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  if (sort === "name") {
    copy.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  } else if (sort === "followup") {
    copy.sort((a, b) => {
      const aT = time(a.nextActionDueAt);
      const bT = time(b.nextActionDueAt);
      if (!aT && !bT) return 0;
      if (!aT) return 1;
      if (!bT) return -1;
      return aT - bT;
    });
  } else {
    copy.sort((a, b) => time(b.lastOutreachAt) - time(a.lastOutreachAt));
  }
  return copy;
}

export function ListToolbar({
  moduleKey,
  total,
  filters,
  extraOpen,
  users,
  requirements,
  onToggleExtra,
  onFilter,
  onClear,
}: {
  moduleKey: string;
  total: number;
  filters: ListFilters;
  extraOpen: boolean;
  users: Record<string, unknown>[];
  requirements: Record<string, unknown>[];
  onToggleExtra: () => void;
  onFilter: (key: string, value: string) => void;
  onClear: () => void;
}) {
  const isContacts = ["candidates", "clients", "vendors"].includes(moduleKey);
  const isCandidates = moduleKey === "candidates";
  const active = FILTER_KEYS.filter((key) => Boolean(filters[key]));
  const extraCount = (["title", "experience", "source", "lastOutreach", "excludeRequirementId"] as const).filter(
    (key) => Boolean(filters[key]),
  ).length;

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-3.5 pt-3 pb-3 space-y-2.5">
        <div className="flex items-center gap-2 min-h-7">
          <h2 className="font-semibold text-[15px] leading-none text-[var(--color-text)]">{moduleLabel(moduleKey)}</h2>
          {moduleKey !== "settings" ? (
            <span className="shrink-0 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-text-muted)]">
              {total}
            </span>
          ) : null}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)] pointer-events-none" />
          <DebouncedText
            id="list-search"
            className="w-full h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-8 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            placeholder={searchPlaceholder(moduleKey)}
            value={filters.q}
            onCommit={(v) => onFilter("q", v)}
          />
          {filters.q ? (
            <button
              type="button"
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
              onClick={() => onFilter("q", "")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {isContacts ? (
          <div className="grid grid-cols-2 gap-x-2 gap-y-2">
            {isCandidates ? (
              <>
                <FilterField label="Skills" className="col-span-2">
                  <DebouncedText
                    className={textControl}
                    placeholder="Java, Spring"
                    value={filters.skills}
                    onCommit={(v) => onFilter("skills", v)}
                  />
                </FilterField>
                <FilterField label="Location">
                  <FieldSelect className={selectControl} value={filters.location} onChange={(e) => onFilter("location", e.target.value)}>
                    <option value="">All</option>
                    {LOCATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </FieldSelect>
                </FilterField>
                <FilterField label="Work authorization">
                  <FieldSelect
                    className={selectControl}
                    value={filters.workAuthorization}
                    onChange={(e) => onFilter("workAuthorization", e.target.value)}
                  >
                    <option value="">All</option>
                    {WORK_AUTH_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </FieldSelect>
                </FilterField>
                <FilterField label="Recruiter">
                  <FieldSelect className={selectControl} value={filters.owner} onChange={(e) => onFilter("owner", e.target.value)}>
                    <option value="">All</option>
                    {users
                      .filter((u) => {
                        const role = String(
                          u.role ||
                            (Array.isArray(u.memberships)
                              ? (u.memberships as { role?: string }[])[0]?.role
                              : "") ||
                            "",
                        );
                        return role && role !== "admin";
                      })
                      .map((u) => (
                      <option key={String(u.id)} value={String(u.id)}>
                        {String(u.name)}
                      </option>
                    ))}
                  </FieldSelect>
                </FilterField>
                <FilterField label="Availability">
                  <FieldSelect
                    className={selectControl}
                    value={filters.availability}
                    onChange={(e) => onFilter("availability", e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="Immediate">Immediate</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="30 days">30 days</option>
                  </FieldSelect>
                </FilterField>
              </>
            ) : (
              <FilterField label="Location" className="col-span-2">
                <FieldSelect className={selectControl} value={filters.location} onChange={(e) => onFilter("location", e.target.value)}>
                  <option value="">All locations</option>
                  {LOCATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </FieldSelect>
              </FilterField>
            )}
          </div>
        ) : null}

        {isContacts ? (
          <div className="flex items-center gap-2 min-w-0">
            {isCandidates ? (
              <button
                type="button"
                onClick={onToggleExtra}
                className={cn(
                  "inline-flex items-center gap-1 h-8 px-2 rounded-[var(--radius-md)] text-[12px] font-medium border transition-colors cursor-pointer shrink-0",
                  extraOpen || extraCount
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                More filters
                {extraCount ? (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-[var(--color-accent)] text-[10px] leading-4 text-white text-center">
                    {extraCount}
                  </span>
                ) : null}
                <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform", extraOpen && "rotate-180")} />
              </button>
            ) : null}
            <FieldSelect
              aria-label="Sort list"
              wrapClassName="min-w-0 flex-1"
              className="h-8 text-[12px] pl-2"
              value={filters.sort || "recent"}
              onChange={(e) => onFilter("sort", e.target.value === "recent" ? "" : e.target.value)}
            >
              <option value="recent">Most recent</option>
              <option value="name">Name A–Z</option>
              <option value="followup">Next follow-up</option>
            </FieldSelect>
            {active.length > 0 ? (
              <button type="button" className="text-[12px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] cursor-pointer shrink-0" onClick={onClear}>
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {isCandidates && extraOpen ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2.5 grid grid-cols-2 gap-x-2 gap-y-2">
            <FilterField label="Title" className="col-span-2">
              <DebouncedText
                className={textControl}
                placeholder="Current or previous title"
                value={filters.title}
                onCommit={(v) => onFilter("title", v)}
              />
            </FilterField>
            <FilterField label="Experience">
              <FieldSelect className={selectControl} value={filters.experience} onChange={(e) => onFilter("experience", e.target.value)}>
                <option value="">Any</option>
                <option value="3">3+ years</option>
                <option value="5">5+ years</option>
                <option value="8">8+ years</option>
              </FieldSelect>
            </FilterField>
            <FilterField label="Source">
              <FieldSelect className={selectControl} value={filters.source} onChange={(e) => onFilter("source", e.target.value)}>
                <option value="">All</option>
                <option value="JobsNProfiles">JobsNProfiles</option>
                <option value="manual">Manual</option>
              </FieldSelect>
            </FilterField>
            <FilterField label="Last outreach" className="col-span-2">
              <FieldSelect className={selectControl} value={filters.lastOutreach} onChange={(e) => onFilter("lastOutreach", e.target.value)}>
                <option value="">Any time</option>
                <option value="7">7+ days ago</option>
                <option value="14">14+ days ago</option>
                <option value="21">21+ days ago</option>
              </FieldSelect>
            </FilterField>
            <FilterField label="Exclude already submitted" className="col-span-2">
              <FieldSelect
                className={selectControl}
                value={filters.excludeRequirementId}
                onChange={(e) => onFilter("excludeRequirementId", e.target.value)}
              >
                <option value="">None</option>
                {requirements.map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {String((r as { organization?: { name?: string } }).organization?.name || "")} —{" "}
                    {String((r as { title?: string }).title)}
                  </option>
                ))}
              </FieldSelect>
            </FilterField>
          </div>
        ) : null}

        {isContacts && active.some((key) => key !== "q") ? (
          <div className="flex flex-wrap gap-1">
            {active
              .filter((key) => key !== "q")
              .map((key) => (
                <FilterChip
                  key={key}
                  label={`${CHIP_LABEL[key]}: ${chipValue(key, filters, users, requirements)}`}
                  onRemove={() => onFilter(key, "")}
                />
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}

function DebouncedText({
  id,
  value,
  onCommit,
  className,
  placeholder,
}: {
  id?: string;
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <input
      id={id}
      className={className}
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(local);
      }}
    />
  );
}

function searchPlaceholder(moduleKey: string) {
  if (moduleKey === "clients") return "Search client people...";
  if (moduleKey === "candidates") return "Search candidates...";
  if (moduleKey === "vendors") return "Search vendor people...";
  if (moduleKey === "dashboard" || moduleKey === "reports") return "Filter risks...";
  return "Search...";
}

function chipValue(
  key: (typeof FILTER_KEYS)[number],
  filters: ListFilters,
  users: Record<string, unknown>[],
  requirements: Record<string, unknown>[],
) {
  const raw = filters[key];
  if (key === "owner") {
    return String(users.find((u) => String(u.id) === raw)?.name || raw);
  }
  if (key === "excludeRequirementId") {
    const req = requirements.find((r) => String(r.id) === raw);
    return String((req as { title?: string } | undefined)?.title || "Requirement");
  }
  if (key === "experience") return `${raw}+ yrs`;
  if (key === "lastOutreach") return `${raw}+ days`;
  return raw;
}
