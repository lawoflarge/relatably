# GitHub Actions Workflows

Phase 6 low-cost architecture: instead of running Firebase Cloud Functions
on a schedule, GitHub Actions cron drives all scheduled work. Each workflow
simply POSTs to a Next.js route hosted on Vercel under `api/cron/*`, with
bearer auth.

> **This only works because the repo is public.** Public repos get
> unlimited free Actions minutes on standard runners. Private repos are
> metered: the original claim in this file that private repos get
> unlimited minutes for the owner was simply wrong, and it is what caused
> the 2026-08-01 outage: the account's included minutes ran out with the
> spending limit at €0, and every workflow in every private repo stopped.
>
> That failure mode is worth recognising, because it looks like nothing
> else: runs go red after ~3 seconds, `gh run view --log` reports `log not
> found`, and the only evidence is the check-run annotation "The job was
> not started because recent account payments have failed or your spending
> limit needs to be increased." Retrieve it with
> `gh api repos/<owner>/<repo>/check-runs/<id>/annotations`. It is a
> billing problem, not a workflow problem.
>
> Corollary: **do not make this repo private again** without first moving
> `trigger-drop` off Actions. The self-looping job below deliberately burns
> runner minutes and would exhaust a metered quota within days.

## Cron workflows

| File | Schedule (UTC) | Endpoint |
| --- | --- | --- |
| `cron-prepare-next-drop.yml` | `0 0 * * *` (daily 00:00) | `POST /api/cron/prepare-next-drop` |
| `cron-trigger-drop.yml` | `0,30 * * * *`, each run loops for 65 min | `POST /api/cron/trigger-drop` |

Score reveal is **not** a separate cron. It runs inline inside
`trigger-drop` per the Phase 6 pivot doc.

### Why `trigger-drop` loops instead of using `*/5`

It used to be scheduled `*/5 * * * *`. That cadence never actually
happened. GitHub silently drops most high-frequency scheduled runs, and
the green checkmarks hid it. Measured over 2026-07-29: a day on which
**every run succeeded**: `trigger-drop` fired **15 times, not 288**:

```
gaps in minutes: 196 148 162 129 101 122 79 72 51 76 55 48 55 60
min / median / max: 48 / 79 / 196
```

Since `runTriggerDrop` releases questions whose `scheduled_drop_at` has
passed, drops were going live a median of ~79 min and up to ~3 h late,
for as long as the workflow existed.

The fix inverts the dependency: ask GitHub only for a *low-frequency*
trigger (every 30 min), which it delivers reliably, and let each run drive
the 5-minute cadence itself for the next ~65 minutes. Runs overlap by
design, two or three are normally in flight, so a dropped trigger is
covered by a run already underway.

Overlap is free: the endpoint claims a 5-minute bucket in a Firestore
transaction (`runOnce`, `api/src/lib/idempotency.ts`), so a duplicate POST
returns `{"skipped": "already-ran-this-bucket"}` without doing work. A
failed call does not abort the loop: that would surrender the rest of the
hour's coverage, but the job still exits non-zero at the end so failures
stay visible.

> GitHub disables scheduled workflows on public repos after 60 days with
> no commit activity. If drops stop and the Actions tab shows no runs at
> all, check for the "this scheduled workflow was disabled" banner before
> debugging the endpoint.

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
