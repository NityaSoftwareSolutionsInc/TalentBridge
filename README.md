# TalentBridge / Contact Manager

Staffing relationship and operational intelligence hub. Spec: [docs/spec/README.md](docs/spec/README.md).

## Run the POC

```bash
npm install
npm run db:setup
npm run dev
```

Opens at http://localhost:3011. Pick a demo user on `/login`.

Postgres is on `127.0.0.1:5435` (see `docker-compose.yml`). Platform users (Admin-Talent-Bridge at http://localhost:3012):

- Global Admin `global.admin@talentbridge.example` / `ChangeMe123!`
- Manager `manager@talentbridge.example` / `ChangeMe123!`
- Support `support@talentbridge.example` / `ChangeMe123!`

TalentBridge workspace users:

- Recruiter (Sarah) lands on Candidates
- Sales (James) lands on Clients
- Operations / Leadership land on Dashboard
- Admin lands on Settings
- Ghost Corp user proves tenant isolation (Northstar records are invisible)

Integrations (JobsNProfiles, VioTalk, Outlook) are **stub adapters** in `src/integrations/`. Swap implementations later without changing product code.

## Demo spine (C.11)

1. Sign in as Sarah. Search Candidates (title `Java`, skills `Spring`). Open Anil Reddy — filters stay.
2. Existing relationship banner appears if you are not the owner. Request Collaboration does not auto-merge.
3. VioTalk Call → wrap-up **Next Action** creates a Task.
4. Submit Profile: pick Java Developer requirement + client person → stub Outlook send → Submission ID on candidate, job, and client.
5. Sign in as James. Open Acme Technologies — Client 360, Requirements tab, MSA/PO (amounts visible with `po` permission).
6. Sign in as Elena (leadership). PO amounts hidden; page still opens. Dashboard Today’s Risks click through to live records.
7. Sign in as Ghost Admin — Northstar candidates do not appear.
# TalentBridge
