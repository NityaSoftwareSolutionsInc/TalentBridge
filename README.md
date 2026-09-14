# TalentBridge / Contact Manager

Staffing relationship and operational intelligence hub. Spec: [docs/spec/README.md](docs/spec/README.md).

## Run the POC

```bash
npm install
npm run db:setup
npm run dev
```

Opens at http://localhost:3011. Sign in after seeding platform admins (see below).

Postgres is on `127.0.0.1:5435` (see `docker-compose.yml`). `npm run db:up` starts **DB only** for local `npm run dev`.

### Full stack with Docker (app + admin + DB)

Keep repos as siblings (`Talent-Bridge` and `Admin-Talent-Bridge`). Then:

```bash
cp .env.docker.example .env   # set AUTH_JWT_SECRET + public URLs
npm run docker:up             # docker compose up -d --build
```

That builds and runs Postgres, schema/seed, TalentBridge (`127.0.0.1:3011`), and Admin (`127.0.0.1:3012`). Point Nginx at those ports for `dtalentbridge.d3e.studio` / `dadmintalentbridge.d3e.studio`.

`npm run db:seed` creates **platform admins only** — no demo tenants or CRM data. Create organizations from Admin-Talent-Bridge.

Platform users (Admin-Talent-Bridge at http://localhost:3012), password `ChangeMe123!`:

- Global Admin `global.admin@talentbridge.example`
- Manager `manager@talentbridge.example`
- Support `support@talentbridge.example`

TalentBridge workspace users are created when you invite the first tenant Administrator from Admin.

Integrations (JobsNProfiles, VioTalk, Outlook) are **stub adapters** in `src/integrations/`. Swap implementations later without changing product code.

## After seed (manual setup)

1. Open Admin → sign in as Global Admin or Manager.
2. Create a tenant and invite the first Administrator (SendGrid or stub link in server log).
3. Open the invite link on TalentBridge `/set-password`, then sign in.
4. Add workspace users and CRM data from TalentBridge Settings / modules.

## Spec demo spine (C.11)

Once you have sample data, the product acceptance path is still: search → ownership → VioTalk wrap-up → Submit Profile → Client 360 → leadership restrictions → tenant isolation.