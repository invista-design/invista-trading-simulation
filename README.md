# InVista Trading Simulation

Competition platform for the InVista Trading Simulation at International Management Institute New Delhi. It has 2 parts:

- **Participant portal**: team sign-in, markets, news announcements linked to the InVista Instagram page, trading terminal with a built-in calculator, portfolio, orders and leaderboards.
- **Organiser admin panel** at `/admin`: phases and round control, teams and logins, assets, news scores and market settings, trading rules and rulebook, orders, market analytics, leaderboards, reports and the audit log.

Every financial calculation runs on the server and matches the master workbook (`Trading_Simulation_Model_Rounds_1-3.xlsx`) to the paisa. News scores, market settings and unpublished results never reach a team's browser.

## Deploy on Vercel (first time, about 10 minutes)

1. **Import the repository.** In Vercel, choose Add New, then Project, and import this GitHub repository. Keep the framework preset (Next.js) and the default build settings, then deploy. This first deployment works but has no database yet.
2. **Add the database.** Open the project, go to the **Storage** tab and create or connect a **Neon** Postgres database. Choose the region **Singapore** if it is offered, because this project runs its server functions in Singapore (`vercel.json`). Connect it to all environments. Neon adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the project.
3. **Add the setup code.** Go to Settings, then Environment Variables, and add `SETUP_TOKEN` with a private value of at least 12 characters.
4. **Deploy.** Go to Deployments and redeploy. Every build first applies database migrations, then builds the site.
5. **Create the organiser account.** Open `https://<your-project>.vercel.app/setup`, enter the setup code and choose an organiser username and password. This loads the 10 assets, 3 phases, news scores and rulebook from the workbook. The setup page locks itself after the first organiser exists.

If you choose a database region other than Singapore, change `regions` in `vercel.json` to the nearest Vercel region so every database query stays fast.

## Before the event

Work through the checklist on the admin Overview page:

1. **Teams**: paste 1 team per line (`Team name | Member 1, Member 2`). Passwords are shown once; download them as a spreadsheet and hand them out.
2. **Assets**: recalibrate supply for the number of registered teams.
3. **Rules and rulebook**: review the per-phase rules (selling, minimum distinct assets, concentration cap, rationing) and publish the suggested rulebook update so the rulebook matches what the website enforces.
4. **News and market impact**: confirm the news scores, supply and any opening price override for each phase. These are confidential.
5. **Settings**: add the Instagram link and add more organiser accounts if needed.
6. **News**: post an announcement when each news pack goes live on Instagram.

## During each phase

On **Phases and round control**: open the phase (the countdown starts), pause, resume, extend or close it. The phase also closes by itself at its closing time. Then calculate the results preview, review it, confirm it and publish it. Teams see results only after publishing.

Every organiser action asks for a reason and is written to the audit log with the time and the values before and after.

## Corrections after a phase is confirmed

Edit the settings of a confirmed phase (for example a news score), then use **Preview a recalculation from this phase**. The preview lists every price, value, order and disqualification that would change. Nothing changes until you confirm it. Earlier results are kept as superseded snapshots.

## Data safety

- All competition data lives in the Neon database. Redeploying the site never deletes it; migrations only add structure.
- Download the reports on the **Reports** page before and after each phase as a backup.
- Never delete the Neon database or disconnect it from the project during the competition.

## Local development

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL and SETUP_TOKEN
npm run db:migrate
npm run dev
```

- `npm test` runs the engine tests, including exact parity with the workbook across 3 phases.
- `npm run typecheck` checks types.

## Structure

| Folder | Contents |
| --- | --- |
| `src/engine` | Pure calculation engine: validation, pricing, rationing, valuation and ranking |
| `src/server` | Server-only logic: orders, phase control, recalculation, views and exports |
| `src/db` | Database schema and the workbook defaults loaded at setup |
| `src/app` | Pages: public, team portal under `(team)` and the admin panel under `admin` |
| `drizzle` | Database migrations |
