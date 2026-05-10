# GitHub Actions Workflows

Phase 6 zero-cost architecture: instead of running Firebase Cloud Functions
on a schedule, GitHub Actions cron drives all scheduled work for free
(unlimited minutes on private repos for the owner). Each workflow simply
POSTs to a Next.js route hosted on Vercel under `api/cron/*`, with bearer
auth.

## Cron workflows

| File | Schedule (UTC) | Endpoint |
| --- | --- | --- |
| `cron-prepare-next-drop.yml` | `0 0 * * *` (daily 00:00) | `POST /api/cron/prepare-next-drop` |
| `cron-trigger-drop.yml` | `*/5 * * * *` (every 5 min) | `POST /api/cron/trigger-drop` |

Score reveal is **not** a separate cron. It runs inline inside
`trigger-drop` per the Phase 6 pivot doc.

> GitHub Actions enforces a 5-minute minimum cron granularity, and
> scheduled runs can be delayed by a few minutes during peak load.
> `trigger-drop` is designed to be idempotent so occasional double-fires
> or skipped runs are safe.

## Required repo secrets

Both workflows depend on two repository secrets. Set them under
**Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value | Notes |
| --- | --- | --- |
| `API_BASE_URL` | `https://relatably.vercel.app` | The production Vercel URL once deployed (no trailing slash). Use a preview URL only for testing. |
| `CRON_SECRET` | long random string | Must match the `CRON_SECRET` env var configured on the Vercel project for `api/`. The cron route handlers verify the bearer token against this value and reject any other caller. |

Generate a strong `CRON_SECRET` with e.g. `openssl rand -hex 32` and set
the **same value** in:

1. GitHub: Settings → Secrets and variables → Actions → `CRON_SECRET`
2. Vercel: Project → Settings → Environment Variables → `CRON_SECRET`
   (Production scope at minimum)

If they drift, every cron call will fail with 401 from the API.

## Manual triggers

Each workflow is also `workflow_dispatch`-enabled so you can run it on
demand:

1. Open the **Actions** tab in the GitHub repo.
2. Pick the workflow in the left sidebar (e.g. `Cron - Trigger Drop`).
3. Click **Run workflow** → choose `phase-6-launch-hardening` (or `main`
   once merged) → **Run workflow**.

This is the fastest way to smoke-test the wiring after rotating
`CRON_SECRET` or pointing `API_BASE_URL` at a new deployment.

## Failure semantics

`curl -fSs` causes the step (and the run) to fail loudly on any non-2xx
HTTP response, so failures show up red in the Actions UI and via
GitHub's default failure notifications. There is no retry. The next
scheduled tick is the retry.
