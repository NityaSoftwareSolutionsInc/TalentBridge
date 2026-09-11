"use client";

import type { ReactNode } from "react";
import {
  Bell,
  FileText,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";
import {
  Avatar,
  Button,
  cn,
  IconButton,
  MenuItem,
  NAV_ITEMS,
} from "./workspace-ui";

export type AppShellSession = {
  name: string;
  title: string;
  role?: string;
  permissions?: string[];
} | null;

export type AppShellMenu = "none" | "help" | "user" | "bell" | string;

export type GlobalHit = {
  id: string;
  name: string;
  module?: string;
  personId?: string;
  type?: string;
};

type AppShellProps = {
  moduleKey: string;
  session: AppShellSession;
  badges: { tasks: number; communications: number };
  navCollapsed: boolean;
  onToggleNav: () => void;
  menu: AppShellMenu;
  onMenuChange: (menu: AppShellMenu) => void;
  globalHits: Record<string, GlobalHit[]> | null;
  onSearchGlobal: (q: string) => void;
  onClearHits: () => void;
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  primaryAction?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  moduleKey,
  session,
  badges,
  navCollapsed,
  onToggleNav,
  menu,
  onMenuChange,
  globalHits,
  onSearchGlobal,
  onClearHits,
  onNavigate,
  onSignOut,
  primaryAction,
  children,
}: AppShellProps) {
  const isAdmin = Boolean(session?.permissions?.includes("admin") || session?.role === "admin");
  const navItems = NAV_ITEMS.filter((item) => item.key !== "settings" || !session || isAdmin);

  return (
    <div className="h-screen flex bg-[var(--color-canvas)] text-[var(--color-text)]">
      {menu !== "none" ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          onClick={() => onMenuChange("none")}
        />
      ) : null}

      <aside
        className={cn(
          "shrink-0 bg-[var(--color-sidebar)] text-[var(--color-text-inverse)] flex flex-col transition-[width] duration-150 ease-out overflow-visible",
          navCollapsed ? "w-[64px]" : "w-[220px]",
        )}
      >
        <div className={cn("flex items-center border-b border-white/10", navCollapsed ? "flex-col gap-2 px-1.5 py-3" : "px-3 py-3 gap-2")}>
          <span className="relative h-7 w-7 shrink-0" aria-hidden>
            <span className="absolute left-0.5 top-1 h-3.5 w-3.5 rounded-full bg-sky-400/90" />
            <span className="absolute right-0.5 top-1 h-3.5 w-3.5 rounded-full bg-blue-500/90" />
            <span className="absolute left-1.5 top-3 h-3.5 w-3.5 rounded-full bg-slate-400/80" />
          </span>
          {!navCollapsed ? (
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-blue-200/90">TalentBridge</div>
              <div className="text-[13px] font-semibold leading-tight">Contact Manager</div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleNav}
            title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!navCollapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-blue-200 hover:bg-[var(--color-sidebar-hover)] hover:text-white cursor-pointer shrink-0"
          >
            {navCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className={cn("flex-1 overflow-auto", navCollapsed ? "p-1.5 space-y-0.5" : "p-2 space-y-0.5")} aria-label="Primary">
          {navItems.map((item) => {
            const count = item.badge ? badges[item.badge] : 0;
            const active = moduleKey === item.key;
            const Icon = item.icon;
            return (
              <a
                key={item.key}
                href={`/${item.key}`}
                title={navCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-[var(--radius-md)] text-[13px] cursor-pointer transition-colors",
                  navCollapsed ? "justify-center h-9" : "gap-2 px-2.5 py-1.5",
                  active
                    ? "bg-[var(--color-sidebar-accent)] text-white"
                    : "text-slate-200 hover:bg-[var(--color-sidebar-hover)] hover:text-white",
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4" />
                  {navCollapsed && count ? (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-[9px] leading-4 text-white text-center">
                      {count}
                    </span>
                  ) : null}
                </span>
                {!navCollapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                {!navCollapsed && count ? (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] flex items-center justify-center">
                    {count}
                  </span>
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className={cn("border-t border-white/10 text-xs relative z-30", navCollapsed ? "p-1.5" : "p-2.5")}>
          <button
            type="button"
            title="Help & Support"
            className={cn(
              "w-full flex items-center rounded-[var(--radius-md)] text-left text-blue-200 hover:bg-[var(--color-sidebar-hover)] hover:text-white cursor-pointer",
              navCollapsed ? "justify-center h-9" : "gap-2 px-2 py-1.5",
            )}
            onClick={() => onMenuChange(menu === "help" ? "none" : "help")}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            {!navCollapsed ? "Help & Support" : null}
          </button>
          {menu === "help" ? (
            <div
              className={cn(
                "z-30 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-md)] p-3",
                navCollapsed ? "absolute left-full bottom-14 ml-2 w-56" : "absolute bottom-20 left-2 right-2",
              )}
            >
              <div className="font-medium text-[13px] mb-1">Help</div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Every call, email or meeting needs wrap-up: Next Action, No Action Required, or Closed.
              </p>
            </div>
          ) : null}
          <div
            className={cn(
              "w-full flex items-center rounded-[var(--radius-md)] text-left",
              navCollapsed ? "justify-center h-9 mt-1" : "gap-2 px-2 py-1.5 mt-1",
            )}
            title={session?.name || "Account"}
          >
            <Avatar name={session?.name || "User"} size={navCollapsed ? 28 : 28} />
            {!navCollapsed ? (
              <div className="min-w-0">
                <div className="font-medium truncate text-[12px]">{session?.name}</div>
                <div className="text-blue-200/90 truncate text-[11px]">{session?.title}</div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              className="w-full h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] pl-8 pr-3 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none hover:border-[var(--color-border-strong)] focus:bg-[var(--color-surface)] focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              placeholder="Search candidates, clients, organizations, conversations and files."
              aria-label="Global search"
              onChange={(e) => onSearchGlobal(e.target.value)}
            />
            {globalHits ? (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto text-[12px] border border-[var(--color-border)] rounded-[var(--radius-md)] p-2 space-y-1 bg-[var(--color-surface)] shadow-[var(--shadow-md)]">
                {Object.entries(globalHits).map(([group, rows]) =>
                  rows?.length ? (
                    <div key={group}>
                      <div className="uppercase text-[var(--color-text-muted)] text-[10px] font-semibold px-1">{group}</div>
                      {rows.map((row) => (
                        <button
                          key={String(row.id)}
                          type="button"
                          className="block w-full text-left hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-accent)] rounded px-2 py-1 cursor-pointer"
                          onClick={() => {
                            onClearHits();
                            onNavigate(`/${row.module}?id=${row.personId || row.id}&type=${row.type || "person"}`);
                          }}
                        >
                          {String(row.name)}
                        </button>
                      ))}
                    </div>
                  ) : null,
                )}
              </div>
            ) : null}
          </div>

          {primaryAction}

          <div className="relative">
            <IconButton
              icon={Bell}
              label="Notifications"
              badge={badges.communications || undefined}
              onClick={() => onMenuChange(menu === "bell" ? "none" : "bell")}
            />
            {menu === "bell" ? (
              <div className="absolute right-0 mt-1 z-30 w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] p-1">
                <MenuItem
                  icon={Bell}
                  onClick={() => {
                    onMenuChange("none");
                    onNavigate("/communications");
                  }}
                >
                  Open Communications ({badges.communications})
                </MenuItem>
                <MenuItem
                  icon={FileText}
                  onClick={() => {
                    onMenuChange("none");
                    onNavigate("/tasks");
                  }}
                >
                  Open Tasks ({badges.tasks})
                </MenuItem>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              className="rounded-full cursor-pointer hover:ring-2 hover:ring-[var(--color-focus-ring)]"
              title={session?.name || "Account"}
              aria-label="Account menu"
              onClick={() => onMenuChange(menu === "user" ? "none" : "user")}
            >
              <Avatar name={session?.name || "U"} size={30} />
            </button>
            {menu === "user" ? (
              <div className="absolute right-0 mt-1 z-30 w-52 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] py-1">
                {isAdmin ? (
                  <MenuItem
                    icon={Settings}
                    onClick={() => {
                      onMenuChange("none");
                      onNavigate("/settings");
                    }}
                  >
                    Settings
                  </MenuItem>
                ) : null}
                <MenuItem icon={LogOut} onClick={onSignOut}>
                  Log out
                </MenuItem>
              </div>
            ) : null}
          </div>
        </header>

        <div className="flex-1 flex min-w-0 min-h-0">{children}</div>
      </div>
    </div>
  );
}

/** Convenience primary action button for the shell top bar */
export function ShellPrimaryAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick}>
      {label}
    </Button>
  );
}
