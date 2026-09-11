# TalentBridge UI system (Phase 1)

Dense enterprise Contact Manager chrome: one visual language across Dashboard, Candidates, Clients, Vendors, and Settings. Product IA stays **list → detail → actions** (three-pane). Do not invent parallel button/input styles inside feature modules.

## Tokens

Source: [`src/app/globals.css`](../src/app/globals.css)

| Group | Variables |
| --- | --- |
| Surfaces | `--color-canvas`, `--color-surface`, `--color-surface-muted`, `--color-sidebar*` |
| Text | `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse` |
| Border / focus | `--color-border`, `--color-border-strong`, `--color-focus`, `--color-focus-ring` |
| Accent / status | `--color-accent*`, `--color-danger*`, `--color-success*`, `--color-warning*` |
| Radius / shadow | `--radius-sm/md/lg`, `--shadow-sm/md` |
| Type density | `--tb-font-page/section/body/meta`, `--tb-control-h` |

Keep slate + single blue accent. No purple gradients, glass, or marketing hero layouts in the hub.

## Layout

[`AppShell`](../src/components/AppShell.tsx) owns:

- Collapsible sidebar (`NAV_ITEMS` from workspace-ui)
- Top bar: global search, primary action slot, notifications, account menu
- Main content region for module panes

[`Workspace`](../src/components/Workspace.tsx) owns workflow (filters, record load, drawers, wrap-up). URL filter/context behavior stays workflow-first.

## Shared components

[`workspace-ui.tsx`](../src/components/workspace-ui.tsx)

- **Button** — `primary` / `secondary` / `ghost` / `danger`
- **FieldInput / FieldSelect / FieldTextarea** — label, required, error, focus ring
- **Tabs**, **PageHeader**, **Drawer**
- **EmptyState**, **LoadingSkeleton**, **InlineError**, **Alert**
- **FilterChip**, **DataTable** (sticky header + compact row; no virtualization yet)
- **Avatar**, **Badge/Tag**, **IconButton**, **MenuItem**, nav helpers

List chrome: [`ListToolbar`](../src/components/ListToolbar.tsx) (active filters as removable chips), [`ListPager`](../src/components/ListPager.tsx).

## Permissions (UI only)

API + `src/lib/queries.ts` remain the source of truth. UI should disable/hide by `session.permissions` with tooltips; destructive actions use danger styling and confirm drawers. No Teams hierarchy in Phase 1.

## Deferred (later phases)

- Virtualized million-row tables, column resize/visibility, saved views
- Full bulk-ops platform
- Teams hierarchy model
- OpenTelemetry / observability stack
- Mobile bottom-nav redesign
- Draft / autosave forms
- Rewriting login or Admin-Talent-Bridge apps
