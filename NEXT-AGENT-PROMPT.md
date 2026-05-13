# Next-agent prompt — Relatably v1.0 build 28 resubmit

> Paste this into a fresh Claude Code session if the previous one was closed.
> Full handoff doc with file pointers + failure modes:
> `C:\Users\levin\brain\10_Projects\Relatably\next-agent-build28-resubmit.md`

## One-paragraph context

Apple rejected v1.0 build 27 on 2026-05-13 under Guidelines 1.1, 1.2, 5.1.1(v).
Full remediation was shipped to `main` and verified live (Vercel deployed, ToS
page returns 200, Firestore index built, ASC metadata patched). Levin clicked
"Start new build" in Codemagic at ~12:11 UTC on 2026-05-13 to produce build 28.

## What to do

When Levin says "build's up" (or you receive the Apple "Build is now available"
email at levin.schwab@gmx.de):

```bash
cd C:\Users\levin\relatably

# 1. Verify build 28 is VALID in ASC.
node scripts/asc-list-builds.mjs
# expect: build=28 state=VALID ... uploaded=2026-05-13...

# 2. Re-attach build 28 to v1.0 + re-fire all metadata patches.
#    (Idempotent. The script accepts REJECTED state, not only
#    PREPARE_FOR_SUBMISSION.)
node scripts/asc-fill-metadata.mjs

# 3. File the new review submission.
#    Creates a fresh draft, adds v1.0 as item, PATCHes submitted=true.
node scripts/asc-submit-for-review.mjs

# 4. Verify state flipped.
node scripts/asc-rejection-detail.mjs
# expect: appStoreState=WAITING_FOR_REVIEW, reviewSubmission state=WAITING_FOR_REVIEW
```

Apple SLA after submit: 24-48h. Decision emails to `levin.schwab@gmx.de`.

## If something is unexpected

- "No editable v1.0 appStoreVersion found" → check `node scripts/asc-rejection-detail.mjs` first; the version state may have transitioned.
- "ALREADY_EXISTS" on the draft → stale reviewSubmission in a READY_FOR_REVIEW state blocking the new one. ASC API returns 403 on `DELETE /reviewSubmissions/{id}` — you have to delete the stale draft in the ASC web UI.
- New rejection findings beyond the three from `245a9f1f-...` → carefully read the new email, then re-plan. The remediation that shipped is exhaustive for the original three findings only.

## Why we trust the existing fix

- 251/251 api tests + 154/154 iOS tests pass on `main` tip `c8b70a4`
- `curl https://relatably.vercel.app/tos` returns 200 with the full ToS
- `curl -X POST .../api/report -d '{}'` returns 400 (validation works)
- `curl -X POST .../api/cron/prepare-next-drop` with the bearer token returns `{"ok":true,"scheduled":{...}}` cold
- `asc-fill-metadata.mjs` exit OK on 2026-05-13 — all 7 PATCHes returned 200

Lineage: this round supersedes `next-agent-build27-resubmit.md` in the brain vault.
