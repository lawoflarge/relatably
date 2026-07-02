# Relatably SwiftUI Rebuild — Design Spec

**Date:** 2026-07-02
**Status:** Approved by Levin (2026-07-02)
**Scope:** Rebuild the Expo/React-Native iOS client 1:1 as a native SwiftUI app, submit it as build 35 for v1.0, and remove the React Native client after Apple approval.

## 1. Context

Relatably (ASC app `6768082631`, bundle `co.relatably.app`) v1.0 build 34 was rejected on 2026-06-30 — **Guideline 2.1(a) App Completeness**: "The application encountered an error and couldn't progress past the initial loading screen" (iPad Air 11-inch M3, iPadOS 26.5, active internet, submission `1b1cbb00-b663-4bef-a75d-739fcb59d34b`). This is the 7th rejection (5× 1.2 UGC, 1× 2.1 ATT, now 2.1(a)).

Root-cause analysis (2026-07-02):

- **Backend is healthy.** `GET /api/questions/today`, `/api/yesterday`, `/api/archive`, `/api/leaderboard` all return HTTP 200 in < 2.5 s. The hang is client-side.
- **Client-side candidates in the RN app (ranked):**
  1. `react-native-svg@15.12.1` render crash under New Architecture. `PaperTexture` (SVG) renders unconditionally as the first child of HomeScreen. `StickerTabBar.tsx:24-34` documents this exact library leaving SVG element imports `undefined` at runtime ("Element type is invalid… got: undefined") — tab icons were already replaced with Unicode glyphs as a workaround, but `PaperTexture`, `IconPeelCorner`, and `IconShare` still use SVG. A first-render throw hits the ErrorBoundary ("Relatably hit a snag") — matching the reviewer's wording.
  2. No fetch timeout anywhere in `src/lib/api.ts` and no watchdog on the HomeScreen loading phase — a stalled response pins the app on "preparing today's drop…" forever.
  3. `new URL().searchParams` without `react-native-url-polyfill` throws on device (breaks `fetchYesterday` / `fetchLeaderboard`).

**Decision (Levin, 2026-07-02):** Do not patch the RN app. The SwiftUI rebuild becomes build 35 and is what gets resubmitted. After verification and Apple approval, the RN client is deleted from the repo; SwiftUI is the only iOS client going forward.

## 2. Goals & Success Criteria

1. **Functional and visual 1:1 parity** with the current RN app — verified by per-screen screenshot pairs (RN app vs SwiftUI app in the simulator) and a scripted functional walkthrough.
2. **The boot path can never hang.** Every startup state resolves within ≤ 12 s to content, the no-drop card, or an error card with RETRY. Verified with an unreachable-API launch test.
3. **All Guideline 1.2 moderation affordances preserved** (hide / report / block everywhere UGC appears, EULA gate, demo-content guarantees) — 5 prior rejections were 1.2.
4. **No ATT, no tracking.** Non-personalized ads only, no `NSUserTrackingUsageDescription` — matching the build-34 privacy posture (App Privacy label already set: no tracking).
5. **Verified on the exact review device class:** iPad Air 11-inch (M3) simulator in iPhone-compat mode, plus an iPhone simulator, in Release configuration.
6. Build 35 uploaded, attached to v1.0, and resubmitted for review with updated review notes.

## 3. Non-Goals

- No backend changes. The Vercel API (`api/`) and Firebase project stay exactly as they are.
- No new features: no push notifications (RN stub only), no Branch deep links (stubbed off), no banner ads (disabled in RN), no remote config.
- Dead RN code is not ported: `src/screens/QuestionScreen.tsx` (legacy), `app/modal.tsx` (template leftover), `messaging.ts` / `remoteConfig.ts` stubs, Expo template components.
- No visual redesign. Deviations from the RN app are defects.

## 4. Architecture

### 4.1 Repo layout

```
relatably/
  api/          # unchanged Next.js backend (Vercel)
  ios/          # existing Expo RN app — untouched until approval, then deleted
  ios-swift/    # NEW: native SwiftUI app (this spec)
    project.yml           # XcodeGen (pattern: schlummer, rateradar apps/ios)
    Relatably/
      App/                # entry, RootView, TosGate, StickerTabBar
      Features/
        Today/            # HomeView + state machine, AnswerInput, RevealView, WordcloudView, ClusterBubble
        Friends/
        Board/
        Archive/          # list + detail
        Me/               # settings
      Core/               # APIClient, Endpoints, Models, Identity, Keychain/Defaults stores,
                          # FirestoreLive, AdManager, ShareCard, DemoContent, Haptics, ReducedMotion
      DesignSystem/       # Tokens, Fonts, sticker components (paper texture, hard shadows, pills)
      Resources/          # Info.plist, entitlements, Assets.xcassets (app icon reused), fonts/, GoogleService-Info.plist
    RelatablyTests/       # XCTest unit tests
```

After approval: delete `ios/`, `git mv ios-swift ios`, update README.

### 4.2 Project config (XcodeGen)

- Bundle ID `co.relatably.app`, marketing version `1.0`, `CURRENT_PROJECT_VERSION` **35**.
- `TARGETED_DEVICE_FAMILY: "1"` (iPhone-only; runs in iPad compatibility mode like today), portrait-only, `LSRequiresIPhoneOS: true`.
- Deployment target **iOS 17.0**.
- Manual signing: team `R95M36AU2X`, Apple Distribution, provisioning profile **"Relatably Local AppStore 2026-06-01"** (verify it carries the Sign in with Apple entitlement before archiving; regenerate via ASC API if not).
- Entitlements: `com.apple.developer.applesignin` only. **No** aps-environment, **no** tracking usage description.
- `ITSAppUsesNonExemptEncryption: false`. ATS default (no arbitrary loads). `GADApplicationIdentifier: ca-app-pub-6563643868702361~4571132569` in Info.plist.
- App icon: reuse the existing asset from the RN project.

### 4.3 Dependencies (SPM only)

- `firebase-ios-sdk` — FirebaseAuth (SIWA → Firebase credential → ID token) + FirebaseFirestore (live listener). Configured from the existing `GoogleService-Info.plist` (project `relatably-prod`).
- `swift-package-manager-google-mobile-ads` (GoogleMobileAds) — post-reveal interstitial only.
- No other third-party dependencies. Networking is URLSession; images/textures are native.

## 5. Feature Parity Specification

### 5.1 App shell

- Fonts load synchronously from the bundle (no network, no loading gate needed).
- **TosGate** (first launch / ToS version bump): full-screen "Before you play" EULA — 18+, zero-tolerance rules, ToS/Privacy links, **I AGREE** → records `tos_accepted_version = "2026-06-07"` in Keychain. Blocks the whole app until accepted, identical copy to `TosGate.tsx`.
- **Tab bar:** floating cream pill, 5 tabs TODAY / FRIENDS / BOARD / ARCHIVE / ME with Unicode glyphs (■ ♥ ★ ▦ ⚙), active tab = ink fill + cream text, selection haptics. Custom SwiftUI tab bar (not native `TabView` styling).

### 5.2 Today (Home) — state machine

Phases identical to `app/(tabs)/index.tsx`: `loading → reveal | question | no_drop | error`, then `question → wordcloud` after submit.

- **Boot sequence:** get device token (local) → `fetchYesterday(device_token)`; if an unseen reveal exists (`reveal_seen_<qid>` not set) → phase `reveal`; else `loadQuestion()`: `GET /api/questions/today`; on 404 → newest archive tile as substitute content; on 404 **with empty archive** → `no_drop` card; on error → `error` phase with RETRY card. (Exact branching mirrors `loadQuestion` in `app/(tabs)/index.tsx`.)
- **question:** lowercased hero question text (BagelFatOne), `AnswerInput` (single line, 280-char limit, placeholder "your take?"), `LiveCounter` (live vote count from Firestore listener), **DROP IT** submit button with 3 s minimum-dwell gate (disabled before), press animation + haptics.
- **submit:** `POST /api/submit {question_id, device_token, raw_text, dwell_ms}` → phase `wordcloud`.
- **wordcloud:** see 5.3. Header "N VOTES · THE WORLD IS VOTING". "DELETE MY ANSWER" → confirm alert → `DELETE /api/submissions/:id {device_token}`.
- **reveal:** clusters #10 → #1 revealed on a 1 s interval, verdict "the world said — X", CTAs SHARE THE VERDICT / "★ SHARE — YOU CALLED IT" (when own cluster is #1) / continue. Marks `reveal_seen_<qid>`. On completion: post-reveal interstitial (once per question, see 5.8), then `loadQuestion()`.

### 5.3 Wordcloud rendering

- **Layout:** exact port of `wordcloudLayout.ts` — sort clusters by `submission_count` desc; phyllotaxis placement `r = step·√i`, `θ = i · π(3−√5)`, centered; `step = min(w, h) · 0.08`. Unit-tested against the TS implementation's outputs.
- **Render:** absolutely positioned sticker bubbles in a `ZStack` (offset x−60 / y−20 like the RN version). Cloud height `min(560, screenH − insets − 220)`.
- **ClusterBubble:** thick ink border, hard offset shadow, deterministic rotation via FNV-1a hash of cluster id → ±4°, background color rotating `[mint, lemon, blue, #FFD7E8]` by index, size bucket xs/s/m/l/xl → 13/16/22/30/44 pt (thresholds ratio ≥ 0.08/0.20/0.40/0.84), own answer = pink fill + "YOU" tab. Tap or long-press (except own) → moderation sheet.
- Live updates: Firestore snapshot listener on `answer_clusters` where `question_id ==` today's id, `orderBy submission_count desc`, `limit 100`.

### 5.4 Board (Leaderboard)

Period tabs Daily/Weekly/All-time × scope Global/Friends. `GET /api/leaderboard?period=&scope=&limit=` (Bearer required only for friends scope; friends scope gated on SIWA). Empty/error on global scope → `DEMO_LEADERBOARD` fallback. Row moderation: ⋯ / long-press → Block user (`POST /api/users/:id/block`) / Report (`POST /api/report {target_type:"user"}`). Blocked users filtered locally.

### 5.5 Archive

- List: paginated tiles `GET /api/archive?cursor=`, long-press → share card.
- Detail (`GET /api/archive/:questionId`): ranked verdict list with percentages; ⋯ per row → hide/report/block via the moderation sheet; empty → `DEMO_ARCHIVE_CLUSTERS` fallback.

### 5.6 Friends

SIWA gate when signed out (Sign in with Apple button → Firebase OAuth). Signed in: friend list (`GET /api/friends`), accept (`POST /api/friends/accept`), remove (`DELETE /api/friends/:id`), request (`POST /api/friends/request`), long-press row → remove/block. Auth state observed reactively (Firebase `AuthStateDidChange`).

### 5.7 Me (Settings)

Support & "Report inappropriate content" via `mailto:`, ToS/Privacy links, **HIDDEN ANSWERS** list (tap to unhide), **BLOCKED USERS** list (tap to unblock), Sign out, Delete account (`POST /api/account/delete` + sign-out + confirm alert). Identical section order and copy to `settings.tsx`.

### 5.8 Ads

Google Mobile Ads, `maxAdContentRating = T`, **every request `npa=1` (non-personalized)**, no ATT call anywhere. One placement: post-reveal interstitial, unit `ca-app-pub-6563643868702361/2000809540`, gated once per question (`interstitial_seen_<qid>` in Keychain), 8 s load timeout, silent no-op on no-fill. SDK init is fire-and-forget off the boot path. No banners.

### 5.9 Moderation (Guideline 1.2 — must not regress)

- Moderation sheet (native `confirmationDialog` / action sheet): Cancel / **Hide this answer** / **Report** / **Block this contributor**. Local-first (hide via store immediately), then best-effort `POST /api/report`. Block records `user_id: "contributor:<clusterId>"`.
- Entry points: every cluster bubble (tap + long-press), every archive-detail row, every leaderboard row, friend rows.
- Hidden/blocked stores filter all rendered UGC everywhere.
- Demo content mirrors `demoContent.ts` **exactly** (8 users maya/leo/aisha/theo/nina/omar/ruby/kai; 10 innocuous coffee-order clusters; ranked archive clusters) so moderation always has targets at review time.

### 5.10 Share

Share card rendered offscreen with SwiftUI `ImageRenderer` → PNG → native share sheet. `POST /api/share/track {banner_type, question_id, share_target}` → `referral_code`; shared URL `https://relatably.app/?r=<code>`.

## 6. Data Layer

### 6.1 Identity

- `device_token`: iOS IDFV, persisted in Keychain under `relatably.device_token` (fallback: `anon-<uuid>-<timestamp>`). Sent on submit/report/delete/yesterday.
- Optional SIWA → `ASAuthorizationAppleIDProvider` → Firebase `OAuthProvider("apple.com")` credential → `signInWithCredential` → `getIDToken()` as `Authorization: Bearer` header. Required only for friends graph, friends-scope board, `/api/auth/me`, block, account delete.

### 6.2 REST endpoints (all against `https://relatably.vercel.app`, overridable via launch argument for testing)

| Method | Path | Body / query | Auth |
|---|---|---|---|
| GET | `/api/questions/today` | — | none |
| POST | `/api/submit` | `{question_id, device_token, raw_text, dwell_ms}` | optional |
| GET | `/api/yesterday` | `?device_token=` | none |
| POST | `/api/auth/me` | — | required |
| GET | `/api/friends` | — | required |
| POST | `/api/friends/request` | `{target_user_id}` | required |
| POST | `/api/friends/accept` | `{friendship_id}` | required |
| DELETE | `/api/friends/:id` | — | required |
| GET | `/api/leaderboard` | `?period=&scope=&limit=` | friends scope only |
| POST | `/api/share/track` | `{banner_type, question_id, share_target}` | optional |
| GET | `/api/archive` | `?cursor=` | none |
| GET | `/api/archive/:questionId` | — | none |
| POST | `/api/report` | `{target_type, target_id, reason?, device_token?}` | optional |
| DELETE | `/api/submissions/:submissionId` | `{device_token}` | optional |
| POST | `/api/users/:targetUserId/block` | — | required |
| POST | `/api/account/delete` | — | required |
| POST | `/api/devices/register` | not called in v1.0 (RN parity) | — |

Response models mirror `ios/src/types/api.ts`. Query strings built with `URLComponents` (no polyfill issues by construction).

### 6.3 Persistence key mapping (RN → SwiftUI)

| RN store | Key | SwiftUI |
|---|---|---|
| SecureStore | `relatably.device_token` | Keychain, same key |
| SecureStore | `tos_accepted_version` | Keychain, same key |
| SecureStore | `reveal_seen_<questionId>` | Keychain, same pattern |
| SecureStore | `interstitial_seen_<questionId>` | Keychain, same pattern |
| AsyncStorage | `ugc_hidden_clusters_v1` (`{id,text,hidden_at}[]`) | UserDefaults, same key + JSON shape |
| AsyncStorage | `ugc_blocked_users_v1` (`{user_id,handle,blocked_at}[]`) | UserDefaults, same key + JSON shape |

(Fresh install at review time; key continuity is for internal consistency, not migration.)

## 7. Design System

Port `src/theme/tokens.ts` verbatim into `Tokens.swift`:

- Colors: cream `#FFF7E8` bg, ink `#1A1A1A`, pink `#FF4FA3`, mint `#7AE6C3`, lemon `#FFDF6B`/`#FFD43B`, blue `#7BC8F6`, red `#FF5A4F`.
- Hard offset shadows: solid ink, **zero blur**, offsets (2,2)/(4,4)/(6,6) — implemented as a background offset shape, not `.shadow(radius:)`.
- Typography: BagelFatOne (display 52/40/36/22), HankenGrotesk-Bold (body 17/15/13), SpaceGrotesk-SemiBold/Bold (letter-spaced caps labels/micro). TTFs copied from the RN project's Google-Fonts packages (all OFL), registered via `UIAppFonts`.
- Radii 14/22/28/36/pill, spacing scale 4/8/12/16/24/32/48/64 (gutter 22), deliberate sticker rotations (±1.5°, −8° etc. matching per-component values in the RN code).
- Paper texture: rebuilt natively (SwiftUI `Canvas` dot pattern), replacing the crash-prone SVG component.
- Reduced motion: respect `UIAccessibility.isReduceMotionEnabled` wherever the RN app consulted `reducedMotion.ts`.

## 8. Boot Robustness (the 2.1(a) fix)

- All URLSession requests: 10 s timeout (`timeoutIntervalForRequest`).
- Home boot task wrapped in a 12 s watchdog: whatever happens (stall, throw, cancellation), the phase resolves to `question`, `reveal`, `no_drop`, or `error` — the `loading` phase cannot outlive the watchdog.
- Error phase always shows the sticker-styled RETRY card (parity with RN's error card).
- Firebase configure + AdMob init: fire-and-forget, never awaited on the boot path.
- Fonts: bundled, synchronous.
- **Verification:** launch with `-apiBaseURL http://127.0.0.1:9` (dead host) → RETRY card must appear within 12 s. Launch with live API → question within normal latency.

## 9. Testing & Autonomous Verification

1. **Unit tests (XCTest, target ~50):** phyllotaxis layout values (cross-checked against the TS implementation), size-bucket thresholds, FNV rotation determinism, interstitial gate, hidden/blocked stores (JSON shape), EULA version logic, API response decoding for every endpoint, demo-content integrity, dwell-gate timing logic.
2. **Functional walkthrough (Release build, scripted via simulator tooling):** EULA accept → Today question → type answer → dwell gate → DROP IT → wordcloud → moderation sheet on a bubble → hide → Board (periods, moderation) → Archive (list → detail → moderation) → Friends (SIWA gate visible) → Me (hidden list shows the hidden item, unhide). Run on **iPhone 16 Pro** and **iPad Air 11-inch (M3)** simulators.
3. **Visual parity:** for each screen, screenshot pair — RN app (current build in simulator; build 33 was successfully sim-verified, so a simulator build is available) vs SwiftUI app — compared and iterated until visually equivalent. Fallback if the RN simulator build won't run: the existing ASC marketing screenshots plus the build-33 verification screenshots serve as reference.
4. **Boot robustness test** per section 8.
5. Existing RN Jest tests are not ported as-is; their assertions inform the XCTest suite.

## 10. Build & Submission Pipeline

1. `xcodegen generate` → `xcodebuild archive` (Release, manual signing, profile "Relatably Local AppStore 2026-06-01") → `xcodebuild -exportArchive` (App Store method) → `altool --upload-app` (key `8XWLD2B2RQ`, issuer `538cb0d4-b8c6-4bc7-8b59-75da5d2b9411`, key file in `.secrets/`).
2. Pre-archive check: decode the provisioning profile and confirm the `com.apple.developer.applesignin` entitlement; regenerate if missing.
3. After processing: attach build 35 to v1.0 via ASC REST.
4. Review notes: rewritten — native Swift rebuild resolving 2.1(a); explicit steps + locations for every 1.2 moderation control; guaranteed demo content; no ATT / non-personalized ads; 18+ EULA gate.
5. Resubmit via existing repo scripts: cancel rejected submission `1b1cbb00` (`PATCH /v1/reviewSubmissions/{id} {canceled:true}`), create new submission, add the appStoreVersion item, submit. (Known transient 409 `ENTITY_STATE_INVALID` right after cancel — retry.)
6. Monitor review state via ASC API.

## 11. Post-Approval Cleanup

Only after Apple approves build 35: delete `ios/` (Expo app), `git mv ios-swift ios`, remove RN-only tooling (`codemagic.yaml` references, RN scripts), update README/LAUNCH_CHECKLIST, commit via PR. Git history preserves the RN implementation.

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Visual drift vs the RN app | Screenshot-pair loop per screen until equivalent (success criterion 1) |
| Guideline 1.2 regression (5 prior rejections) | Full moderation port (5.9), demo fallbacks, precise review notes |
| New review surface (full rewrite) → new findings | Keep scope strictly 1:1; no new features; same privacy posture |
| Firestore/AdMob SDK integration issues | First-class native SDKs; both init off the boot path; interstitial no-op on failure |
| Provisioning profile missing SIWA entitlement | Pre-archive profile check (10.2) |
| Reveal/animation timing feels different | 1 s interval + ordering ported exactly; verified in walkthrough |
