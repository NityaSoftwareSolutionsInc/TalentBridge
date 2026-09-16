"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./workspace-ui";

type Country = { code: string; name: string; aliases: string; cities: string[] };

/**
 * Curated staffing / tech hubs — not a world gazetteer.
 * City values are fixed labels (no free-text commas / casing drift).
 */
export const LOCATION_COUNTRIES: Country[] = [
  {
    code: "US",
    name: "United States",
    aliases: "usa america us",
    cities: [
      "Atlanta, GA",
      "Austin, TX",
      "Boston, MA",
      "Charlotte, NC",
      "Chicago, IL",
      "Dallas, TX",
      "Denver, CO",
      "Detroit, MI",
      "Houston, TX",
      "Los Angeles, CA",
      "Miami, FL",
      "Minneapolis, MN",
      "Nashville, TN",
      "New York, NY",
      "Philadelphia, PA",
      "Phoenix, AZ",
      "Portland, OR",
      "Raleigh, NC",
      "Remote — US",
      "Salt Lake City, UT",
      "San Diego, CA",
      "San Francisco Bay Area, CA",
      "Seattle, WA",
      "Tampa, FL",
      "Washington, DC",
    ],
  },
  {
    code: "CA",
    name: "Canada",
    aliases: "canada ca",
    cities: [
      "Calgary, AB",
      "Edmonton, AB",
      "Halifax, NS",
      "Montreal, QC",
      "Ottawa, ON",
      "Remote — Canada",
      "Toronto, ON",
      "Vancouver, BC",
      "Waterloo, ON",
    ],
  },
  {
    code: "IN",
    name: "India",
    aliases: "india bharat in",
    cities: [
      "Ahmedabad",
      "Bengaluru",
      "Chennai",
      "Coimbatore",
      "Delhi NCR",
      "Gurgaon",
      "Hyderabad",
      "Indore",
      "Jaipur",
      "Kochi",
      "Kolkata",
      "Mumbai",
      "Noida",
      "Pune",
      "Remote — India",
      "Thiruvananthapuram",
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    aliases: "uk britain england scotland wales gb",
    cities: ["Belfast", "Birmingham", "Edinburgh", "Glasgow", "Leeds", "London", "Manchester", "Remote — UK"],
  },
  {
    code: "IE",
    name: "Ireland",
    aliases: "ireland eire",
    cities: ["Cork", "Dublin", "Galway", "Limerick", "Remote — Ireland"],
  },
  {
    code: "DE",
    name: "Germany",
    aliases: "germany deutschland",
    cities: ["Berlin", "Frankfurt", "Hamburg", "Munich", "Remote — Germany", "Stuttgart"],
  },
  {
    code: "NL",
    name: "Netherlands",
    aliases: "netherlands holland dutch",
    cities: ["Amsterdam", "Eindhoven", "Remote — Netherlands", "Rotterdam", "The Hague", "Utrecht"],
  },
  {
    code: "PL",
    name: "Poland",
    aliases: "poland",
    cities: ["Kraków", "Remote — Poland", "Warsaw", "Wrocław"],
  },
  {
    code: "RO",
    name: "Romania",
    aliases: "romania",
    cities: ["Bucharest", "Cluj-Napoca", "Remote — Romania", "Timișoara"],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    aliases: "uae dubai abu dhabi",
    cities: ["Abu Dhabi", "Dubai", "Remote — UAE", "Sharjah"],
  },
  {
    code: "SG",
    name: "Singapore",
    aliases: "singapore sg",
    cities: ["Remote — Singapore", "Singapore"],
  },
  {
    code: "AU",
    name: "Australia",
    aliases: "australia au",
    cities: ["Brisbane", "Melbourne", "Perth", "Remote — Australia", "Sydney"],
  },
  {
    code: "PH",
    name: "Philippines",
    aliases: "philippines ph",
    cities: ["Cebu", "Manila", "Remote — Philippines"],
  },
  {
    code: "MX",
    name: "Mexico",
    aliases: "mexico mx",
    cities: ["Guadalajara", "Mexico City", "Monterrey", "Remote — Mexico"],
  },
  {
    code: "BR",
    name: "Brazil",
    aliases: "brazil brasil",
    cities: ["Remote — Brazil", "Rio de Janeiro", "São Paulo"],
  },
  {
    code: "OTHER",
    name: "Other / Multi-country",
    aliases: "other global multi",
    cities: ["Global / Multi-site", "Remote — Global"],
  },
];

export function countryByCode(code: string) {
  return LOCATION_COUNTRIES.find((c) => c.code === code) || null;
}

/** Stable display: "City · Country" — avoids free-text comma / casing drift. */
export function composeOrgLocation(countryCode: string, city: string) {
  const country = countryByCode(countryCode);
  const c = String(city || "").trim();
  if (!country || !c) return "";
  if (!country.cities.includes(c)) return "";
  return `${c} · ${country.name}`;
}

/** Reverse of composeOrgLocation (and loose match on city / "City, ST" legacy strings). */
export function parseLocationToCountryCity(location: string): { countryCode: string; city: string } {
  const raw = String(location || "").trim();
  if (!raw) return { countryCode: "", city: "" };
  const composed = raw.match(/^(.+?)\s*·\s*(.+)$/);
  if (composed) {
    const city = composed[1].trim();
    const countryName = composed[2].trim().toLowerCase();
    const country = LOCATION_COUNTRIES.find(
      (c) => c.name.toLowerCase() === countryName || c.code.toLowerCase() === countryName,
    );
    if (country && country.cities.includes(city)) return { countryCode: country.code, city };
  }
  for (const country of LOCATION_COUNTRIES) {
    if (country.cities.includes(raw)) return { countryCode: country.code, city: raw };
    const hit = country.cities.find((c) => c.toLowerCase() === raw.toLowerCase());
    if (hit) return { countryCode: country.code, city: hit };
  }
  return { countryCode: "", city: "" };
}

function SearchablePick({
  value,
  display,
  placeholder,
  options,
  onChange,
  disabled,
}: {
  value: string;
  display: string;
  placeholder: string;
  options: { value: string; label: string; sub?: string; hay: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.hay.includes(needle));
  }, [options, q]);

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
        disabled={disabled}
        className={cn(
          "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm",
          "hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setQ("");
        }}
      >
        {value ? (
          <span className="font-medium text-slate-900">{display}</span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
      </button>
      {open && !disabled ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search…"
              className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-300"
            />
          </div>
          <ul className="max-h-52 overflow-auto py-1">
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm cursor-pointer hover:bg-slate-50",
                    o.value === value ? "bg-slate-50" : "",
                  )}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-slate-900">{o.label}</span>
                  {o.sub ? <span className="block text-[11px] text-slate-500">{o.sub}</span> : null}
                </button>
              </li>
            ))}
            {!filtered.length ? <li className="px-3 py-3 text-xs text-slate-500">No match</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CountryCitySelect({
  countryCode,
  city,
  onChange,
}: {
  countryCode: string;
  city: string;
  onChange: (next: { countryCode: string; city: string; location: string }) => void;
}) {
  const country = countryByCode(countryCode);
  const countryOptions = useMemo(
    () =>
      LOCATION_COUNTRIES.map((c) => ({
        value: c.code,
        label: c.name,
        sub: c.code === "OTHER" ? undefined : c.code,
        hay: `${c.code} ${c.name} ${c.aliases}`.toLowerCase(),
      })),
    [],
  );
  const cityOptions = useMemo(
    () =>
      (country?.cities || []).map((c) => ({
        value: c,
        label: c,
        hay: c.toLowerCase(),
      })),
    [country],
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">Country</div>
        <SearchablePick
          value={countryCode}
          display={country?.name || countryCode}
          placeholder="Select country…"
          options={countryOptions}
          onChange={(code) => {
            onChange({
              countryCode: code,
              city: "",
              location: "",
            });
          }}
        />
      </div>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">City</div>
        <SearchablePick
          value={city}
          display={city}
          placeholder={countryCode ? "Select city…" : "Pick country first"}
          options={cityOptions}
          disabled={!countryCode}
          onChange={(nextCity) => {
            onChange({
              countryCode,
              city: nextCity,
              location: composeOrgLocation(countryCode, nextCity),
            });
          }}
        />
      </div>
    </div>
  );
}
