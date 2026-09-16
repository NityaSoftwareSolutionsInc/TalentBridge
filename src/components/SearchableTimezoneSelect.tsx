"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./workspace-ui";

/** Curated IANA zones for staffing / tech outreach (US·Canada, IST, EU, APAC hubs). */
export const TECH_TIMEZONES: { value: string; label: string; region: string; aliases: string }[] = [
  // United States & Canada — show EST/CST/MST/PST (and daylight variants) for staffing UX
  {
    value: "America/New_York",
    label: "Eastern — EST / EDT (ET)",
    region: "US / Canada",
    aliases: "est edt et eastern new york toronto montreal ottawa boston atlanta miami",
  },
  {
    value: "America/Chicago",
    label: "Central — CST / CDT (CT)",
    region: "US / Canada",
    aliases: "cst cdt ct central chicago houston dallas mexico minneapolis",
  },
  {
    value: "America/Denver",
    label: "Mountain — MST / MDT (MT)",
    region: "US / Canada",
    aliases: "mst mdt mt mountain denver calgary edmonton salt lake",
  },
  {
    value: "America/Phoenix",
    label: "Arizona — MST (no daylight saving)",
    region: "US / Canada",
    aliases: "mst arizona phoenix no dst",
  },
  {
    value: "America/Los_Angeles",
    label: "Pacific — PST / PDT (PT)",
    region: "US / Canada",
    aliases: "pst pdt pt pacific los angeles seattle vancouver san francisco bay area portland",
  },
  {
    value: "America/Anchorage",
    label: "Alaska — AKST / AKDT (AKT)",
    region: "US / Canada",
    aliases: "akst akdt akt alaska anchorage",
  },
  {
    value: "Pacific/Honolulu",
    label: "Hawaii — HST (no daylight saving)",
    region: "US / Canada",
    aliases: "hst hawaii honolulu",
  },
  {
    value: "America/Halifax",
    label: "Atlantic — AST / ADT (AT)",
    region: "US / Canada",
    aliases: "ast adt at atlantic halifax canada",
  },
  {
    value: "America/St_Johns",
    label: "Newfoundland — NST / NDT (NT)",
    region: "US / Canada",
    aliases: "nst ndt nt newfoundland st johns",
  },
  // South Asia — critical for tech delivery / India IT
  {
    value: "Asia/Kolkata",
    label: "India — IST (UTC+5:30)",
    region: "South Asia",
    aliases: "ist india mumbai bangalore bengaluru hyderabad chennai pune delhi kolkata",
  },
  {
    value: "Asia/Colombo",
    label: "Sri Lanka Time",
    region: "South Asia",
    aliases: "colombo sri lanka",
  },
  {
    value: "Asia/Dhaka",
    label: "Bangladesh — BST",
    region: "South Asia",
    aliases: "dhaka bangladesh bst",
  },
  {
    value: "Asia/Karachi",
    label: "Pakistan — PKT",
    region: "South Asia",
    aliases: "karachi pakistan pkt",
  },
  // Europe / UK
  {
    value: "Europe/London",
    label: "UK — GMT / BST",
    region: "Europe",
    aliases: "gmt bst london uk ireland",
  },
  {
    value: "Europe/Dublin",
    label: "Ireland — GMT / IST",
    region: "Europe",
    aliases: "dublin ireland ist",
  },
  {
    value: "Europe/Berlin",
    label: "Central Europe — CET / CEST",
    region: "Europe",
    aliases: "cet cest berlin amsterdam madrid rome frankfurt germany netherlands",
  },
  {
    value: "Europe/Paris",
    label: "Paris — CET / CEST",
    region: "Europe",
    aliases: "paris france cet cest",
  },
  {
    value: "Europe/Amsterdam",
    label: "Amsterdam — CET / CEST",
    region: "Europe",
    aliases: "amsterdam netherlands cet cest",
  },
  {
    value: "Europe/Warsaw",
    label: "Warsaw — CET / CEST",
    region: "Europe",
    aliases: "warsaw poland cet cest",
  },
  {
    value: "Europe/Bucharest",
    label: "Bucharest — EET / EEST",
    region: "Europe",
    aliases: "bucharest romania eet eest",
  },
  // Middle East
  {
    value: "Asia/Dubai",
    label: "Gulf / Dubai — GST",
    region: "Middle East",
    aliases: "dubai uae gst abu dhabi",
  },
  {
    value: "Asia/Riyadh",
    label: "Saudi Arabia — AST",
    region: "Middle East",
    aliases: "riyadh saudi ast",
  },
  {
    value: "Asia/Jerusalem",
    label: "Israel — IST / IDT",
    region: "Middle East",
    aliases: "israel jerusalem tel aviv ist idt",
  },
  // East / SE Asia & ANZ — common tech hubs
  {
    value: "Asia/Singapore",
    label: "Singapore — SGT",
    region: "APAC",
    aliases: "singapore sgt",
  },
  {
    value: "Asia/Kuala_Lumpur",
    label: "Malaysia — MYT",
    region: "APAC",
    aliases: "kuala lumpur malaysia myt",
  },
  {
    value: "Asia/Jakarta",
    label: "Jakarta — WIB",
    region: "APAC",
    aliases: "jakarta indonesia wib",
  },
  {
    value: "Asia/Bangkok",
    label: "Bangkok — ICT",
    region: "APAC",
    aliases: "bangkok thailand vietnam ho chi minh ict",
  },
  {
    value: "Asia/Hong_Kong",
    label: "Hong Kong — HKT",
    region: "APAC",
    aliases: "hong kong hkt",
  },
  {
    value: "Asia/Shanghai",
    label: "China — CST",
    region: "APAC",
    aliases: "shanghai beijing china cst",
  },
  {
    value: "Asia/Tokyo",
    label: "Japan — JST",
    region: "APAC",
    aliases: "tokyo japan jst",
  },
  {
    value: "Asia/Seoul",
    label: "Korea — KST",
    region: "APAC",
    aliases: "seoul korea kst",
  },
  {
    value: "Asia/Manila",
    label: "Philippines — PHT",
    region: "APAC",
    aliases: "manila philippines pht",
  },
  {
    value: "Australia/Sydney",
    label: "Sydney — AEST / AEDT",
    region: "APAC",
    aliases: "sydney melbourne australia aest aedt",
  },
  {
    value: "Australia/Perth",
    label: "Perth — AWST",
    region: "APAC",
    aliases: "perth australia awst",
  },
  {
    value: "Pacific/Auckland",
    label: "New Zealand — NZST / NZDT",
    region: "APAC",
    aliases: "auckland wellington new zealand nzst nzdt",
  },
  // Latin America (common client hubs)
  {
    value: "America/Mexico_City",
    label: "Mexico City — CST / CDT",
    region: "LatAm",
    aliases: "mexico city cst cdt",
  },
  {
    value: "America/Sao_Paulo",
    label: "São Paulo — BRT",
    region: "LatAm",
    aliases: "sao paulo brazil brt",
  },
  {
    value: "America/Bogota",
    label: "Colombia — COT",
    region: "LatAm",
    aliases: "bogota colombia cot",
  },
  {
    value: "America/Argentina/Buenos_Aires",
    label: "Buenos Aires — ART",
    region: "LatAm",
    aliases: "buenos aires argentina art",
  },
  // Reference
  {
    value: "UTC",
    label: "UTC (Coordinated Universal Time)",
    region: "Reference",
    aliases: "utc gmt zulu universal",
  },
];

function haystack(z: (typeof TECH_TIMEZONES)[number]) {
  return `${z.value} ${z.label} ${z.region} ${z.aliases}`.toLowerCase();
}

export function SearchableTimezoneSelect({
  value,
  onChange,
  placeholder = "Search PST, MST, IST, EST…",
}: {
  value: string;
  onChange: (iana: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = TECH_TIMEZONES.find((z) => z.value === value);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return TECH_TIMEZONES;
    return TECH_TIMEZONES.filter((z) => haystack(z).includes(needle));
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm",
          "hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100",
        )}
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
        aria-expanded={open}
      >
        {selected ? (
          <span>
            <span className="font-medium text-slate-900">{selected.label}</span>
            <span className="block text-[11px] text-slate-500">{selected.region} · {selected.value}</span>
          </span>
        ) : (
          <span className="text-slate-400">Select timezone…</span>
        )}
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-300"
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                No timezone
              </button>
            </li>
            {filtered.map((z) => (
              <li key={z.value}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm cursor-pointer hover:bg-slate-50",
                    z.value === value ? "bg-slate-50" : "",
                  )}
                  onClick={() => {
                    onChange(z.value);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-slate-900">{z.label}</span>
                  <span className="block text-[11px] text-slate-500">
                    {z.region} · {z.value}
                  </span>
                </button>
              </li>
            ))}
            {!filtered.length ? (
              <li className="px-3 py-3 text-xs text-slate-500">No match — try PST, MST, EST, CST, IST…</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
