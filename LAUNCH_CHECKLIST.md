# Relatably Phase 6 Launch Checklist

Code-side Phase 6 is shipped on branch `phase-6-launch-hardening`. This
checklist walks through every step needed to flip the app live without
adding monthly cost.

**Architecture**: Firebase Spark (free) + Vercel Hobby + GitHub Actions
cron. Total monthly cost target: **€0**. See
`docs/superpowers/plans/2026-05-09-relatably-phase6-launch-hardening.md`
section "2026-05-10 Architecture Pivot" for the why.

---

## Pre-flight values

Generate `CRON_SECRET` once and reuse the same string everywhere it appears:

```powershell
# from PowerShell:
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
```

Or from Git Bash / WSL:

```bash
openssl rand -hex 32
```

**Save the value somewhere safe** — you'll paste it into 2 places (Vercel
+ GitHub) and need them to match exactly.

---

## 1. Firebase setup (browser - free, no Blaze)

1. **Stay on Spark plan.** Confirm at
   <https://console.firebase.google.com/project/relatably-prod/overview>
   that the plan badge says "Spark". **Don't upgrade.**
2. **Service account JSON** (needed by Vercel + the seed script):
   - <https://console.firebase.google.com/project/relatably-prod/settings/serviceaccounts/adminsdk>
   - Click "Generate new private key" → "Generate key" → JSON downloads
   - Save to a safe location, e.g. `C:\Users\levin\relatably\.secrets\service-account.json`
   - This file is gitignored. **Never commit it.**
3. **Web SDK config** (4 `NEXT_PUBLIC_FIREBASE_*` vars for the admin console):
   - <https://console.firebase.google.com/project/relatably-prod/settings/general/>
   - Under "Your apps", confirm a Web app exists. If not, click "Add app" → Web → name "Relatably Admin" → Register.
   - Copy `apiKey`, `authDomain`, `projectId`, `appId` from the snippet.
4. **Authorized domains** for Google sign-in:
   - <https://console.firebase.google.com/project/relatably-prod/authentication/settings>
   - Add the Vercel preview + production domains once you know them. `localhost` is already there.
5. **Remote Config kill-switches** (run the seed script after step 2 lands the JSON):
   ```powershell
   $env:FIREBASE_PROJECT_ID = "relatably-prod"
   $env:FIREBASE_SERVICE_ACCOUNT_PATH = "C:\Users\levin\relatably\.secrets\service-account.json"
   cd C:\Users\levin\relatably\firebase\scripts
   pnpm install
   pnpm seed:remote-config
   ```
   Expected: `published Remote Config template version N`. Verify in
   Firebase Console → Engage → Remote Config that 3 keys are live:
   `drop_enabled=true`, `fanout_enabled=true`, `submit_rate_limit_per_min=10`.

## 2. Sentry project (browser - free tier)

1. Sign up / log in at <https://sentry.io>.
2. Create a new project: **Platform = Next.js**, **Name = relatably-api**.
3. Copy the DSN (looks like `https://abc123@o4501234567890.ingest.sentry.io/5012345`).

## 3. Perspective API key (browser - free tier)

1. <https://console.cloud.google.com/apis/library/commentanalyzer.googleapis.com?project=relatably-prod>
   - Click **Enable** if not already enabled.
2. <https://console.cloud.google.com/apis/credentials?project=relatably-prod>
   - **Create credentials** → API key → copy the key
   - **Restrict key**: Application restrictions = none, API restrictions = Perspective Comment Analyzer API only.

## 4. Vercel deploy (CLI - already logged in as `lawoflarge`)

```powershell
cd C:\Users\levin\relatably\api

# Link the api/ directory to a new Vercel project (one-time)
vercel link

# Set every env var (production scope). vercel will prompt for value.
vercel env add FIREBASE_PROJECT_ID production               # paste: relatably-prod
# For service account: paste ENTIRE JSON contents as one line.
# api/src/lib/firebase.ts auto-detects FIREBASE_SERVICE_ACCOUNT_JSON
# and skips the path loader on production.
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production     # paste: { "type": "service_account", ... }
vercel env add ADMIN_UIDS production                        # paste: <your firebase auth uid, comma-sep if multiple>
vercel env add NEXT_PUBLIC_ADMIN_UIDS production            # paste: same value
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production      # paste: from step 1.3
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production  # paste: relatably-prod.firebaseapp.com
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production   # paste: relatably-prod
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production       # paste: from step 1.3
vercel env add PERSPECTIVE_API_KEY production               # paste: from step 3
vercel env add SENTRY_DSN production                        # paste: from step 2
vercel env add SENTRY_ENVIRONMENT production                # type: production
vercel env add CRON_SECRET production                       # paste: the value you generated above

# Deploy
vercel --prod
```

Note the production URL printed at the end (e.g. `https://relatably-api-abc.vercel.app`). You'll need it for GH secrets.

> **`FIREBASE_SERVICE_ACCOUNT_JSON` vs `_PATH`**: api/src/lib/firebase.ts checks `FIREBASE_SERVICE_ACCOUNT_JSON` first (production / Vercel) and falls back to `FIREBASE_SERVICE_ACCOUNT_PATH` (local dev). Set whichever fits the environment.

## 5. GitHub repo secrets (REST API or web UI)

Web UI: <https://github.com/lawoflarge/relatably/settings/secrets/actions>

Set:
- `CRON_SECRET` = same value as Vercel (must match exactly)
- `API_BASE_URL` = your Vercel production URL (no trailing slash), e.g. `https://relatably-api-abc.vercel.app`

CLI alternative (using the PAT in `~/.claude/projects/.../memory/github_token.md`):

```powershell
# Skipping for brevity - use the web UI for secrets unless you specifically want scripted setup.
```

## 6. iOS client env (separate flow, EAS)

Phase 6 iOS work (T19/T20) hasn't shipped yet. When it does, the iOS
client will need:
- `EXPO_PUBLIC_API_URL` = same Vercel URL
- `SENTRY_DSN` (different from web - separate Sentry React Native project)
- `EXPO_PUBLIC_FIREBASE_REMOTE_CONFIG_*` if/when client-side flags are added

Set these via `eas env:create` once T19/T20 land.

## 7. Smoke test

After Vercel deploy + GH secrets are set:

1. Visit `https://<vercel-url>/admin` - sign in with Google, confirm authorization.
2. GitHub Actions tab → `Cron - Trigger Drop` → **Run workflow** → branch `phase-6-launch-hardening` → Run.
3. Watch the run - expect green check, ~5-10s. Body should include `{ok: true, ...}` or `{skipped: "drop_enabled=false"}` (if you flipped it off).
4. Repeat for `Cron - Prepare Next Drop`.
5. Visit `/admin/candidates`, create a test candidate, approve it. Confirm a `questions` doc with `status='scheduled'` appears in Firestore.
6. Open Sentry dashboard - confirm the project has received the test session ping (or trigger a deliberate error to verify).

## 8. Phase 6 follow-ups (next session)

Code remaining after this deploy:
- T16 leaderboard 503 fallback when kill-switch flipped
- T18 60 launch questions + seeding script
- T19 iOS Sentry + Remote Config wiring
- T20 eas.json production profile
- T21 EAS production build + ASC submission

---

## Vercel Hobby commercial-use note

Vercel Hobby's terms restrict to "personal, non-commercial use". Indie
App Store apps are a gray area; enforcement is rare for low-traffic
projects. If Vercel emails you about commercial use, options are:
1. Upgrade to Pro ($20/mo)
2. Migrate `api/` to Cloudflare Pages + Workers (free + commercial OK)

This is not a launch blocker.
