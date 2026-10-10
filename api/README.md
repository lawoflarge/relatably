This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin console (Phase 5)

The admin console lives at `/admin` and is gated by Firebase Auth + Google sign-in.

### Local setup

1. In Firebase Console for `relatably-prod`, enable the Google sign-in provider under Authentication → Sign-in method.
2. Copy your web SDK config (Firebase Console → Project Settings → SDK setup → Web) into `api/.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
3. Sign into the running app at `http://localhost:3000/admin` once with Google. Note the uid printed by the gate when you're "Not authorized".
4. Add that uid to BOTH `ADMIN_UIDS` (server-side enforcement) and `NEXT_PUBLIC_ADMIN_UIDS` (web UI gate) in `.env.local`.
5. Restart `pnpm dev`. You're now an admin.

### Production (Vercel)

Set the same five env vars in the Vercel project (`relatably-api` or whatever the slug is). Add `localhost`, the preview-deploy domain, and the production domain to the Firebase Auth → Settings → Authorized domains list.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/archive`                                  | Public: paginated revealed-question tiles |
| GET    | `/api/archive/[id]`                             | Public: full archive detail (top-N clusters) |
| GET    | `/api/admin/candidates`                         | Admin: list question candidates |
| POST   | `/api/admin/candidates`                         | Admin: create candidate (status=pending) |
| PATCH  | `/api/admin/candidates/[id]`                    | Admin: approve (atomically schedules question) or reject |
| GET    | `/api/admin/questions`                          | Admin: list scheduled + live questions |
| POST   | `/api/admin/questions/[id]/schedule`            | Admin: set scheduled_drop_at |
| POST   | `/api/admin/trigger-drop`                       | Admin: soft-trigger next drop (≤60s) |

## Phase 6 - Cron + observability + kill-switches

The Cloud Functions architecture (`firebase/functions/`) was abandoned in
the 2026-05-10 architecture pivot to keep monthly cost at €0 (Firebase
Spark plan, no Blaze upgrade). All server-side scheduled work now lives
in Vercel api/ routes called by GitHub Actions cron. See
`docs/superpowers/plans/2026-05-09-relatably-phase6-launch-hardening.md`
under "2026-05-10 Architecture Pivot" for full context.

### Cron endpoints (require `Authorization: Bearer $CRON_SECRET`)

| Method | Path | Schedule | Purpose |
|---|---|---|---|
| POST | `/api/cron/prepare-next-drop` | daily 00:00 UTC | Assigns `scheduled_drop_at` to oldest unscheduled question |
| POST | `/api/cron/trigger-drop`      | every 5 min     | Flips due questions live + reveals previous + inline FCM fanout |

Both endpoints are idempotent via `runOnce` (Firestore `function_runs`
guard doc) and gated by Firebase Remote Config kill-switches.

### Remote Config kill-switches (read by api/ at runtime)

| Key | Type | Default | Effect when set |
|---|---|---|---|
| `drop_enabled` | boolean | `true` | When `false`, `/api/cron/trigger-drop` returns immediately |
| `fanout_enabled` | boolean | `true` | When `false`, FCM push fanout is skipped during drops |
| `submit_rate_limit_per_min` | number | `10` | Per-IP submit limit; set to `0` for full halt |

5-min in-memory cache with graceful fallback. The api/ never goes down
because Remote Config is unreachable.

### Sentry

`api/instrumentation.ts` initialises `@sentry/node` on the Node runtime
when `SENTRY_DSN` is set. `tracesSampleRate=0.1` keeps the free-tier
quota safe (5K errors / 10K traces per month).

### Production env vars (Vercel)

Add these on top of the Phase 5 admin-console set:

```
CRON_SECRET=...                 # openssl rand -hex 32; must match GH Actions secret
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
PERSPECTIVE_API_KEY=...         # Phase 4; required for inline tier-2 moderation
```

### GitHub Actions repo secrets

| Secret | Value |
|---|---|
| `CRON_SECRET` | same value as Vercel |
| `API_BASE_URL` | `https://<your-vercel-deployment>` (no trailing slash) |

Cron workflows live in `.github/workflows/cron-*.yml`.
