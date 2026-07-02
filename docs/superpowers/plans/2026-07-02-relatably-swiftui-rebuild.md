# Relatably SwiftUI Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Expo/RN iOS client 1:1 as a native SwiftUI app (`ios-swift/`), verify it autonomously (XCTest + simulator walkthrough on iPhone and iPad + screenshot parity + dead-host boot test), upload as build 35, and resubmit v1.0 to App Review.

**Architecture:** XcodeGen project (Schlummer pattern) with a single app target; `Core/` (URLSession API client, Keychain/UserDefaults stores, Firebase, AdMob), `Features/` (Today, Board, Archive, Friends, Me), `DesignSystem/` (tokens, fonts, sticker components). Backend (`api/`, Vercel) untouched.

**Tech Stack:** Swift 5 / SwiftUI, iOS 17+, XcodeGen 2.45.4, Xcode 26.6, SPM: firebase-ios-sdk (FirebaseAuth, FirebaseFirestore), swift-package-manager-google-mobile-ads (GoogleMobileAds). XCTest.

**Spec:** `docs/superpowers/specs/2026-07-02-relatably-swiftui-rebuild-design.md`

**Canonical port reference:** `docs/superpowers/plans/rn-extraction/*.md` — 11 verbatim extraction reports (strings, constants, algorithms, component trees, test vectors). **Every task below names its report sections; those sections are normative.** When this plan and a report disagree on a constant or string, the report wins.

**The behavioral contract:** `rn-extraction/asc-scripts.md` §1.3 quotes the App-Review notes verbatim. Every promise in them (first-launch Terms gate with "I AGREE", "DROP IT", instantly populated wordcloud, sheet options "Hide this answer" / "Report this answer" / "Block this contributor", "YOU" tag + "DELETE MY ANSWER", Archive "…" per row, populated Board with "Block this user"/"Report this user", ME tab with support/undo lists/account deletion, no chat/DMs, optional SIWA) must be true of the rebuilt app.

**Verified environment facts (2026-07-02):**
- xcodegen 2.45.4 at `/opt/homebrew/bin/xcodegen`; Xcode 26.6 (17F113).
- Simulators: `iPhone 16 Pro Max` (booted), `iPad Air 11-inch (M4)` — the review device was iPad Air 11-inch (M3); the M4 sim is the same device class/size and is what we verify on.
- Provisioning profile **"Relatably Local AppStore 2026-06-01"** (UUID `f2eb62a8-dcb6-412f-b2e0-4fc7027c9af8`, expires 2027-05-26) contains `com.apple.developer.applesignin` — already installed in `~/Library/MobileDevice/Provisioning Profiles/`.
- ASC key `.secrets/AuthKey_8XWLD2B2RQ.p8` (KEY_ID `8XWLD2B2RQ`, ISSUER `538cb0d4-b8c6-4bc7-8b59-75da5d2b9411`), app ID `6768082631`, v1.0 version ID `e613956d-da8b-4fc3-8b01-c5a69ed84f15`, rejected submission to cancel: `1b1cbb00-b663-4bef-a75d-739fcb59d34b`.
- Font TTFs live in `ios/node_modules/@expo-google-fonts/{bagel-fat-one,hanken-grotesk,space-grotesk}/` (exact files per `rn-extraction/tokens-fonts-texture.md` §2b).
- Firebase config: `ios/GoogleService-Info.plist` (project relatably-prod). App icon source: `ios/assets/images/icon.png` (1024×1024).

**Working rules for every task:**
- Branch: `feat/swiftui-rebuild`. Commit after every green step with a `feat(swift): …` / `test(swift): …` message; never batch multiple tasks into one commit.
- Wire format is snake_case; SwiftUI code style: no force-unwraps in production paths, `@MainActor` view models, structs over classes except where reference semantics are required.
- Build command (Debug/sim): `xcodegen generate --spec ios-swift/project.yml && xcodebuild -project ios-swift/Relatably.xcodeproj -scheme Relatably -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' build`
- Test command: same with `test` instead of `build`. Expected: `** TEST SUCCEEDED **`.
- The two never-rendered RN font weights (`HankenGrotesk_500`, `SpaceGrotesk_500` — see tokens report red flags) are NOT bundled (YAGNI).
- The RN 8 s font watchdog and its "loading…" splash are async-font artifacts; with bundled fonts they cannot occur and are NOT ported. The RN ErrorBoundary ("Relatably hit a snag.") has no SwiftUI equivalent for render errors and is NOT ported; boot failures are handled by the Task-9 watchdog + RETRY card instead.

---

### Task 1: Project scaffold (`ios-swift/`)

**Files:**
- Create: `ios-swift/project.yml`
- Create: `ios-swift/Relatably/Resources/Relatably.entitlements`
- Create: `ios-swift/Relatably/App/RelatablyApp.swift`
- Create: `ios-swift/Relatably/Resources/Assets.xcassets` (AppIcon from `ios/assets/images/icon.png`, `Cream` color #FFF7E8 for the launch screen)
- Create: `ios-swift/Relatably/Resources/Fonts/` (TTFs copied per tokens report §2b, minus the two unused weights)
- Copy: `ios/GoogleService-Info.plist` → `ios-swift/Relatably/Resources/GoogleService-Info.plist`

- [ ] **Step 1: Write `ios-swift/project.yml`**

```yaml
name: Relatably
options:
  bundleIdPrefix: co.relatably
  deploymentTarget:
    iOS: "17.0"
  createIntermediateGroups: true
  developmentLanguage: en
settings:
  base:
    SWIFT_VERSION: "5.0"
    MARKETING_VERSION: "1.0.0"
    CURRENT_PROJECT_VERSION: "35"
    DEVELOPMENT_TEAM: "R95M36AU2X"
packages:
  Firebase:
    url: https://github.com/firebase/firebase-ios-sdk
    from: "12.0.0"
  GoogleMobileAds:
    url: https://github.com/googleads/swift-package-manager-google-mobile-ads
    from: "12.0.0"
targets:
  Relatably:
    type: application
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - path: Relatably
    dependencies:
      - package: Firebase
        product: FirebaseAuth
      - package: Firebase
        product: FirebaseFirestore
      - package: GoogleMobileAds
        product: GoogleMobileAds
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: co.relatably.app
        PRODUCT_NAME: Relatably
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
        TARGETED_DEVICE_FAMILY: "1"
        ENABLE_USER_SCRIPT_SANDBOXING: YES
        GENERATE_INFOPLIST_FILE: NO
        CODE_SIGN_STYLE: Manual
        CODE_SIGN_IDENTITY: "Apple Distribution"
        PROVISIONING_PROFILE_SPECIFIER: "Relatably Local AppStore 2026-06-01"
        CODE_SIGN_ENTITLEMENTS: Relatably/Resources/Relatably.entitlements
      configs:
        debug:
          CODE_SIGN_STYLE: Automatic
          CODE_SIGN_IDENTITY: "Apple Development"
          PROVISIONING_PROFILE_SPECIFIER: ""
    info:
      path: Relatably/Resources/Info.plist
      properties:
        CFBundleDisplayName: Relatably
        CFBundleShortVersionString: "1.0.0"
        CFBundleVersion: "35"
        LSRequiresIPhoneOS: true
        UILaunchScreen:
          UIColorName: Cream
        UIApplicationSceneManifest:
          UIApplicationSupportsMultipleScenes: false
        UISupportedInterfaceOrientations:
          - UIInterfaceOrientationPortrait
        UIUserInterfaceStyle: Light
        ITSAppUsesNonExemptEncryption: false
        CFBundleDevelopmentRegion: en
        GADApplicationIdentifier: "ca-app-pub-6563643868702361~4571132569"
        UIAppFonts:
          - Fonts/BagelFatOne-Regular.ttf
          - Fonts/HankenGrotesk-Bold.ttf
          - Fonts/SpaceGrotesk-SemiBold.ttf
          - Fonts/SpaceGrotesk-Bold.ttf
  RelatablyTests:
    type: bundle.unit-test
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - path: RelatablyTests
    dependencies:
      - target: Relatably
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: co.relatably.app.tests
        GENERATE_INFOPLIST_FILE: YES
        CODE_SIGN_STYLE: Automatic
schemes:
  Relatably:
    build:
      targets:
        Relatably: all
    run:
      config: Debug
    test:
      config: Debug
      targets:
        - RelatablyTests
    archive:
      config: Release
```

Adjust the exact `UIAppFonts` list after Step 3 to match the file names actually copied (normative list: tokens report §2b rendered-weights only). If SPM resolution fails on `from: "12.0.0"`, resolve the latest available majors (`xcodebuild -resolvePackageDependencies`) and pin those.

**CRITICAL — no tracking:** `NSUserTrackingUsageDescription` must NEVER appear in this Info.plist, and nothing may call `ATTrackingManager` (App Privacy says no tracking; that was rejection #6).

- [ ] **Step 2: Write entitlements** (mirror of the RN app's — SIWA only)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.developer.applesignin</key>
    <array>
      <string>Default</string>
    </array>
  </dict>
</plist>
```

- [ ] **Step 3: Copy assets** — AppIcon (single 1024 `ios/assets/images/icon.png` into an `AppIcon.appiconset` with `"platform":"ios","size":"1024x1024","idiom":"universal"` Contents.json), `Cream` color set (#FFF7E8, "Any" appearance), the TTFs from `ios/node_modules/@expo-google-fonts/…` (verify each PostScript name — the names in `UIAppFonts` are file names, the names used in code are PostScript names per tokens report §2b), and `GoogleService-Info.plist`.

- [ ] **Step 4: Minimal app entry** (placeholder until Task 8)

```swift
import SwiftUI

@main
struct RelatablyApp: App {
    var body: some Scene {
        WindowGroup { Text("relatably").font(.largeTitle) }
    }
}
```

- [ ] **Step 5: Generate + build**

Run: `cd ios-swift && xcodegen generate && xcodebuild -project Relatably.xcodeproj -scheme Relatably -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' build`
Expected: `** BUILD SUCCEEDED **` (first run resolves SPM packages — allow several minutes).

- [ ] **Step 6: Commit** — `feat(swift): scaffold XcodeGen project for native rebuild (build 35)`

---

### Task 2: Design system

**Report:** `rn-extraction/tokens-fonts-texture.md` §1 (tokens verbatim + SwiftUI tables), §2b (PostScript names), §3 (PaperTexture spec), §5 (test vectors), §6 (edge cases — esp. BagelFatOne line-height headroom: RN `lineHeight` is an absolute line-box height; use explicit line spacing so hero text does not clip. **Hero line height is 62, not the stale 50 in the RN Jest test.**)

**Files:**
- Create: `ios-swift/Relatably/DesignSystem/Tokens.swift` — namespaced `Color` palette (10 colors as hex inits), `Typography` (9 styles: family/size/lineHeight/letterSpacing), `Spacing` (sp1–sp8 + gutter 22 + section 24), `Radii` (14/22/28/36/pill 999), `Shadows` (3 hard shadows: ink, zero blur, offsets (2,2)/(4,4)/(6,6), opacity 1), `Motion` constants.
- Create: `ios-swift/Relatably/DesignSystem/Fonts.swift` — `Font.custom` helpers keyed by PostScript names (`BagelFatOne-Regular`, `HankenGrotesk-Bold`, `SpaceGrotesk-SemiBold`, `SpaceGrotesk-Bold`).
- Create: `ios-swift/Relatably/DesignSystem/HardShadow.swift` — ViewModifier drawing a solid ink offset copy of the shape BEHIND the content (`background` of the same shape offset by (dx,dy), no blur). `.shadow(radius:)` is forbidden for sticker shadows.
- Create: `ios-swift/Relatably/DesignSystem/PaperTexture.swift` — `Canvas` 12 pt grid, r=1 circles at (1,1) offsets, ink at 6 % opacity, `allowsHitTesting(false)`, ignores safe area.
- Test: `ios-swift/RelatablyTests/TokensTests.swift`

- [ ] **Step 1: Write failing tests** — hex values of all 10 palette colors (compare via UIColor components), hero size 52 / line 62, body 17/15/13, shadow offsets, radii, spacing; `UIFont(name: "BagelFatOne-Regular", size: 12) != nil` for each bundled font (proves Info.plist registration).
- [ ] **Step 2: Run tests — expect FAIL** (types don't exist).
- [ ] **Step 3: Implement the four files** with every value from report §1 verbatim.
- [ ] **Step 4: Run tests — expect PASS.**
- [ ] **Step 5: Commit** — `feat(swift): design system — tokens, fonts, hard shadows, paper texture`

---

### Task 3: Models + API client

**Report:** `rn-extraction/core-libs.md` §1 (endpoint table + semantics), §2 (all types verbatim), §9.1 (test vectors).

**Files:**
- Create: `ios-swift/Relatably/Core/Models.swift` — Codable structs for every type in report §2 with explicit `CodingKeys` (snake_case wire). `daily_rank`, `handle`, `self_cluster_id`, `next_cursor` optional.
- Create: `ios-swift/Relatably/Core/APIClient.swift`
- Test: `ios-swift/RelatablyTests/APIClientTests.swift` (URLProtocol stub)

**APIClient contract (from report §1, plus the spec's 2.1(a) hardening):**
- Base URL: `UserDefaults.standard.string(forKey: "apiBaseURL") ?? "https://relatably.vercel.app"` (launch argument `-apiBaseURL <url>` overrides for testing; production default is compiled in — NEVER localhost, that was the build-25 killer).
- `URLSessionConfiguration.timeoutIntervalForRequest = 10`, `timeoutIntervalForResource = 15`.
- Header `content-type: application/json` on JSON bodies; auth header lowercase `authorization: Bearer <token>` supplied by an injected `tokenProvider: () async -> String?` — when nil the request is STILL sent without the header.
- All 17 endpoints exactly per the table: `fetchAuthMe` is **POST with no body**; `fetchYesterday` returns `nil` on 404 (other non-2xx throw) while `fetchArchiveDetail` throws on 404; `deleteOwnSubmission` is **DELETE with JSON body** `{"device_token": …}`; `fetchLeaderboard` sends auth only for `scope == "friends"`, `limit` only when provided; `submitAnswer` on !ok prefers the server's `error` field verbatim as the thrown message (`APIError.server(message:)`), fallback `submit: <status>`.
- Query strings via `URLComponents`; path params percent-encoded.

- [ ] **Step 1: Write failing tests** from report §9.1 — one test per row (method, path, query encoding incl. `cursor=2026-05-08T00%3A00%3A00.000Z`, auth-header presence/absence, body shapes `{"target_user_id":"u2"}` / `{"friendship_id":"fid"}`, 404-vs-throw semantics, submit error-body preference) plus decoding fixtures for every response model, plus a timeout test (URLProtocol that never replies → throws within ~11 s).
- [ ] **Step 2: Run — FAIL. Step 3: Implement. Step 4: Run — PASS.**
- [ ] **Step 5: Commit** — `feat(swift): API client + models with 10s timeouts (2.1a hardening)`

---

### Task 4: Identity, Keychain gates, hidden-content store

**Report:** `rn-extraction/core-libs.md` §3 (deviceId algorithm), §5 (one-shot gates verbatim), §6 (hidden store: UserDefaults NOT Keychain, keys/shapes/unshift/idempotency), §9.3–9.4 (test vectors).

**Files:**
- Create: `ios-swift/Relatably/Core/KeychainStore.swift` — minimal string get/set on `kSecClassGenericPassword` (service = bundle id), injectable protocol `StringStore` for tests.
- Create: `ios-swift/Relatably/Core/DeviceToken.swift` — key `relatably.device_token`; cached→IDFV (`UIDevice.current.identifierForVendor`)→`anon-<uuid>` fallback; persist then return.
- Create: `ios-swift/Relatably/Core/OneShotGates.swift` — `RevealStore` (`reveal_seen_<qid>`), `InterstitialGate` (`interstitial_seen_<qid>`); value must be the literal string `"1"`.
- Create: `ios-swift/Relatably/Core/EulaStore.swift` — key `tos_accepted_version`, `CURRENT_TOS_VERSION = "2026-06-07"`, exact-equality check, read errors fail-open (per tosgate report; write path: surface nothing, keep parity).
- Create: `ios-swift/Relatably/Core/HiddenContentStore.swift` — UserDefaults keys `ugc_hidden_clusters_v1` / `ugc_blocked_users_v1`, JSON arrays newest-first (`insert(at: 0)`), idempotent by id, corrupt JSON → empty, `hidden_at`/`blocked_at` = ms epoch numbers; `hiddenClusterIds()` / `blockedUserIds()` return `Set<String>`.
- Test: `ios-swift/RelatablyTests/StoresTests.swift`

- [ ] **Step 1: Failing tests** per report §9.3/§9.4 tables (per-question isolation, idempotency, unshift order, null handle, corrupt-JSON degradation) against in-memory `StringStore` + isolated `UserDefaults(suiteName:)`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `feat(swift): identity + keychain gates + hidden-content store`

---

### Task 5: Demo content

**Report:** `rn-extraction/board-demo.md` (DEMO_LEADERBOARD verbatim — 8 users maya/leo/aisha/theo/nina/omar/ruby/kai with exact scores/ranks/locales) and `rn-extraction/wordcloud.md` §1 (10 demo coffee clusters verbatim) + `rn-extraction/archive.md` (DEMO_ARCHIVE_CLUSTERS).

**Files:**
- Create: `ios-swift/Relatably/Core/DemoContent.swift` — `DEMO_QUESTION`, `DEMO_LEADERBOARD: [LeaderboardEntry]`, `DEMO_CLUSTERS`, `DEMO_ARCHIVE_CLUSTERS` — every string/number copied verbatim from the reports.
- Test: `ios-swift/RelatablyTests/DemoContentTests.swift`

- [ ] **Step 1: Failing tests** — counts (8 users, 10 clusters), first entries (`maya`, 1840, rank 1), all cluster texts match the report set.
- [ ] **Steps 2–4: FAIL → implement → PASS. Step 5: Commit** — `feat(swift): demo fallback content (guideline 1.2 guarantee)`

---

### Task 6: Wordcloud math

**Report:** `rn-extraction/wordcloud.md` §4 (verbatim TS: `clusterSizeBucket` thresholds 0.08/0.20/0.40/0.84 → xs/s/m/l/xl; `stickerRotation` FNV-1a hash → ±4°; phyllotaxis `r = step·√i`, `θ = i·π(3−√5)`, `step = min(w,h)·0.08`, sort by count desc, center offset), §8 (test vectors).

**Files:**
- Create: `ios-swift/Relatably/Core/WordcloudMath.swift` — `sizeBucket(count:maxCount:) -> Bucket`, `stickerRotation(id:) -> Double`, `wordcloudLayout(clusters:width:height:) -> [PlacedCluster]`. Port the TS line-by-line; FNV-1a must use the same 32-bit unsigned overflow arithmetic (`&*`, `&+`).
- Test: `ios-swift/RelatablyTests/WordcloudMathTests.swift`

- [ ] **Step 1: Failing tests** — every vector from report §8 (exact x/y positions for known inputs, bucket boundaries incl. the ≥ vs > edge, rotation determinism: same id → same angle, angles within ±4).
- [ ] **Steps 2–4: FAIL → implement → PASS. Step 5: Commit** — `feat(swift): phyllotaxis layout + size buckets + FNV sticker rotation`

---

### Task 7: Firebase bootstrap + live listener + auth service

**Report:** `rn-extraction/friends-auth.md` (SIWA→Firebase OAuth flow verbatim, firebase.ts config), `rn-extraction/home-flow.md` §2 (onSnapshot query: collection `answer_clusters`, `where("question_id", isEqualTo:)`, `order(by: "submission_count", descending: true)`, `limit(to: 100)`).

**Files:**
- Create: `ios-swift/Relatably/Core/FirebaseBootstrap.swift` — `FirebaseApp.configure()` at app init, wrapped so a missing plist logs and continues (never blocks boot). NO emulator wiring (the RN emulator env is a dev-only footgun; the port omits it).
- Create: `ios-swift/Relatably/Core/ClusterLiveSource.swift` — `protocol ClusterLiveSource` (`listen(questionId:onChange:) -> ListenerHandle`) + `FirestoreClusterSource` impl (doc fields `canonical_text`, `submission_count`; errors keep last data, never crash) + `StaticClusterSource` for tests/previews.
- Create: `ios-swift/Relatably/Core/AuthService.swift` — `signInWithApple()` (ASAuthorization → `OAuthProvider.credential(providerID: .apple, idToken:, rawNonce:)` → `Auth.auth().signIn`), `getIdToken() async -> String?`, `signOut()`, auth-state publisher. This is the APIClient's `tokenProvider`.
- Test: `ios-swift/RelatablyTests/AuthServiceTests.swift` (nonce generation: length/charset/uniqueness; SHA256 hashing — pure logic only, no network).

- [ ] **Step 1: Failing nonce/hash tests. Steps 2–4: FAIL → implement → PASS.**
- [ ] **Step 5: Build the app target** (Firestore/Auth link check): expect `** BUILD SUCCEEDED **`.
- [ ] **Step 6: Commit** — `feat(swift): firebase bootstrap, firestore live source, SIWA auth service`

---

### Task 8: App shell — TosGate + tab bar

**Reports:** `rn-extraction/tosgate-eula.md` (ALL copy verbatim, §3 constants, §7 tree), `rn-extraction/settings-tabbar.md` (StickerTabBar glyphs ■ ♥ ★ ▦ ⚙, labels TODAY/FRIENDS/BOARD/ARCHIVE/ME, pill layout, active ink-fill, selection haptics), `rn-extraction/tokens-fonts-texture.md` §2c (root tree: cream background everywhere, dark status bar).

**Files:**
- Create: `ios-swift/Relatably/App/RootView.swift` — `TosGate { RootTabs() }`; cream background; PaperTexture behind every screen.
- Create: `ios-swift/Relatably/App/TosGate.swift` — 3 phases (loading/blocking/ready); blocking screen with the exact 12 strings from the report (title, 2 paragraphs, 4 bullets, fine print, "I AGREE" capsule button with hard shadow (2,2) and border 3, links to `https://relatably.vercel.app/tos` and `/privacy` opening in Safari); accept → `EulaStore.recordAcceptance()` → ready.
- Create: `ios-swift/Relatably/App/StickerTabBar.swift` + `RootTabs.swift` — custom bottom pill (NOT native TabView chrome): 5 items, Unicode glyphs, active = ink fill/cream text, `UISelectionFeedbackGenerator` on switch.
- Modify: `ios-swift/Relatably/App/RelatablyApp.swift` — FirebaseBootstrap + RootView.

- [ ] **Step 1: Implement all four files** (copy every string/constant from the reports — no paraphrasing; feature tabs render placeholder `Text` views until Tasks 9–15 land).
- [ ] **Step 2: Build + launch on iPhone 16 Pro Max sim** (`simulator_install_app`/`simulator_launch_app` or `xcrun simctl`); screenshot: EULA gate visible with correct fonts/colors; tap I AGREE → tab bar appears; relaunch → gate does NOT reappear.
- [ ] **Step 3: Commit** — `feat(swift): app shell — TosGate EULA + sticker tab bar`

---

### Task 9: Today feature — state machine + question phase

**Report:** `rn-extraction/home-flow.md` (§1 strings, §2 state machine verbatim, §3 per-phase trees incl. ZERO-spacing question stack, §4 AnswerInput 280-char + peel corner, §5 SubmitButton dwell gate MIN_DWELL_MS 3000 + press animation −2°→0° 120/200 ms + haptics + enabled/disabled colors, §10 test vectors, §11 edge cases).

**Files:**
- Create: `ios-swift/Relatably/Features/Today/HomeViewModel.swift`
- Create: `ios-swift/Relatably/Features/Today/HomeView.swift` (phase switch + loading/no_drop/error cards with verbatim copy)
- Create: `ios-swift/Relatably/Features/Today/QuestionView.swift`, `AnswerInput.swift`, `SubmitButton.swift`, `LiveCounter.swift`
- Test: `ios-swift/RelatablyTests/HomeViewModelTests.swift`

**State machine (port of §2 + spec §8 watchdog):**

```swift
@MainActor final class HomeViewModel: ObservableObject {
    enum Phase: Equatable { case loading, reveal(Yesterday), question(TodayQuestion), wordcloud(TodayQuestion), noDrop, error }
    @Published var phase: Phase = .loading

    // Boot: deviceToken → fetchYesterday; unseen reveal → .reveal; else loadQuestion().
    // loadQuestion(): fetchTodayQuestion → .question
    //   on HTTP 404 → fetchArchive; newest tile → substitute question; empty archive → .noDrop
    //   on any other error → .error
    // WATCHDOG (the 2.1(a) fix): boot() races a 12 s deadline —
    //   if phase is still .loading when the deadline fires, force .error.
    // RETRY card button re-runs boot().
}
```

- 404 detection: on HTTP status (`APIError.http(404)`), not the RN message-regex — identical branching, cleaner mechanism.
- Submit: `submitAnswer(question_id:, device_token:, raw_text: untrimmed, dwell_ms:)` → `.wordcloud`; trim gates the button only.
- Dwell gate: button disabled until 3 s after question appear; latches once (RN parity — no re-lock within same appearance).
- `handleRevealComplete` ordering (App-Review-relevant): `markRevealSeen` BEFORE the interstitial, then `loadQuestion()`.

- [ ] **Step 1: Failing VM tests** with mock API: boot→question; boot with unseen yesterday→reveal; seen yesterday→question; 404+archive→substitute; 404+empty archive→noDrop; API error→error; **stalled API (never resolves)→error within 12 s** (measure with expectation timeout 13 s); submit→wordcloud; dwell-gate timing (§10 vectors).
- [ ] **Steps 2–4: FAIL → implement VM → PASS.**
- [ ] **Step 5: Implement the views** (verbatim copy/constants from §1/§3–5; LiveCounter reads ClusterLiveSource).
- [ ] **Step 6: Build + sim launch: question phase renders with live backend; screenshot.**
- [ ] **Step 7: Commit** — `feat(swift): Today state machine with 12s boot watchdog + question phase`

---

### Task 10: Wordcloud phase + moderation

**Reports:** `rn-extraction/wordcloud.md` (§1 strings incl. "N VOTES · THE WORLD IS VOTING" header + moderation hint, §2 constants: canvas `min(560, h−insets−220)`, placement offset (−60, −20), bucket fonts 44/30/22/16/13, YOU-tab geometry, §3 colors incl. FILL_ROTATION [mint, lemon, blue, #FFD7E8], §6 tree, §7 edge cases: demo fallback gate, optimistic alerts), `rn-extraction/core-libs.md` §7 (moderation sheet verbatim: title `"<text>"`, options Cancel / Hide this answer / Report this answer / Block this contributor, destructive index 3, local-first semantics, alert strings, synthetic blocked user `contributor:<id>` with handle = cluster text).

**Files:**
- Create: `ios-swift/Relatably/Features/Today/WordcloudView.swift` — ZStack of positioned `ClusterBubble`s from `wordcloudLayout`; demo fallback when no other-authored clusters; hidden-ids filtering; "DELETE MY ANSWER" (confirm alert → `deleteOwnSubmission` → reset to question phase).
- Create: `ios-swift/Relatably/Features/Today/ClusterBubble.swift` — sticker: ink border, hard shadow, FNV rotation, fill rotation by index, bucket font, pink+YOU tab for self; tap/long-press (not on self) → moderation.
- Create: `ios-swift/Relatably/Core/ClusterModeration.swift` — `confirmationDialog` presentation model + the three actions exactly per core-libs §7.3 (hide-local-first, best-effort report, success alerts shown regardless).
- Test: `ios-swift/RelatablyTests/ClusterModerationTests.swift` — action semantics against mock store/API: hide = no server call; report = hide + report(target_type cluster) + alert regardless of server failure; block = hide + blocked user `contributor:<id>`/handle=text + report with reason "blocked contributor".

- [ ] **Step 1: Failing moderation tests. Steps 2–4: FAIL → implement → PASS.**
- [ ] **Step 5: Implement views; build + sim: submit an answer → wordcloud shows own YOU bubble + demo/live clusters; tap foreign bubble → sheet with exact 4 options; Hide removes it instantly. Screenshot.**
- [ ] **Step 6: Commit** — `feat(swift): wordcloud + cluster bubbles + 1.2 moderation sheet`

---

### Task 11: Reveal + interstitial

**Reports:** `rn-extraction/reveal-share.md` (reveal sequence verbatim: clusters #10→#1 on 1 s interval, verdict "the world said — X", CTA labels incl. "★ SHARE — YOU CALLED IT" when self is #1, skip/continue), `rn-extraction/core-libs.md` §4 (AdMob: init order — requestConfiguration maxAdContentRating .teen BEFORE initialize; `GADExtras.additionalParameters = ["npa":"1"]` on every request; interstitial unit `ca-app-pub-6563643868702361/2000809540` in Release / Google test unit in Debug; 8 s load timeout first-event-wins; show resolves on dismiss or immediately on throw; every failure → nil, silent).

**Files:**
- Create: `ios-swift/Relatably/Features/Today/RevealView.swift`
- Create: `ios-swift/Relatably/Core/AdManager.swift`
- Test: `ios-swift/RelatablyTests/AdManagerTests.swift` (gate: once per question via InterstitialGate; disabled in DEBUG unless `-adsEnabled YES`; unit-ID resolution DEBUG vs RELEASE)

- [ ] **Step 1: Failing gate/ID tests. Steps 2–4: implement → PASS.**
- [ ] **Step 5: Implement RevealView (timer-driven, reduced-motion respected); wire post-reveal: markRevealSeen → interstitial (once per question) → loadQuestion.**
- [ ] **Step 6: Build + sim smoke (reveal plays with mock Yesterday). Commit** — `feat(swift): reveal sequence + non-personalized post-reveal interstitial`

---

### Task 12: Board (leaderboard)

**Report:** `rn-extraction/board-demo.md` (period/scope tabs, row layout, "…" affordance, "Block this user"/"Report this user" strings, demo fallback on empty/error global scope, blocked-user filtering, SIWA gate for friends scope).

**Files:**
- Create: `ios-swift/Relatably/Features/Board/BoardViewModel.swift`, `BoardView.swift`, `LeaderboardRow.swift`
- Test: `ios-swift/RelatablyTests/BoardViewModelTests.swift`

- [ ] **Step 1: Failing VM tests** — global empty → DEMO_LEADERBOARD; API error → demo; friends scope without auth → SIWA gate state; blocked ids filtered out; period/scope drive query params.
- [ ] **Steps 2–4: implement → PASS. Step 5: views + sim screenshot. Step 6: Commit** — `feat(swift): board with demo fallback + row moderation`

---

### Task 13: Archive (list + detail)

**Report:** `rn-extraction/archive.md` (tile grid layout, pagination via `next_cursor`, long-press share, detail ranked list with percentages, "…" per row → moderation sheet, demo fallback, copy verbatim).

**Files:**
- Create: `ios-swift/Relatably/Features/Archive/ArchiveViewModel.swift`, `ArchiveView.swift`, `ArchiveDetailView.swift`
- Test: `ios-swift/RelatablyTests/ArchiveViewModelTests.swift` (pagination appends, cursor threading, empty detail → DEMO_ARCHIVE_CLUSTERS, hidden filtering)

- [ ] **Steps 1–4: TDD as above. Step 5: views + sim screenshots (list + detail + sheet). Step 6: Commit** — `feat(swift): archive list + detail with moderation`

---

### Task 14: Friends + SIWA

**Report:** `rn-extraction/friends-auth.md` (signed-out gate copy + SignInWithApple button, list sections incoming/outgoing/accepted, accept/remove/block flows, long-press actions, auth-state reactivity).

**Files:**
- Create: `ios-swift/Relatably/Features/Friends/FriendsViewModel.swift`, `FriendsView.swift`
- Test: `ios-swift/RelatablyTests/FriendsViewModelTests.swift` (mock API: list mapping incl. direction/status, accept moves pending→accepted, remove deletes)

- [ ] **Steps 1–4: TDD. Step 5: views (native `SignInWithAppleButton`), build + sim screenshot of the signed-out gate. Step 6: Commit** — `feat(swift): friends tab with SIWA gate`

---

### Task 15: Me (settings)

**Report:** `rn-extraction/settings-tabbar.md` (every section/row/copy verbatim: Contact support mailto, "Report inappropriate content", ToS/Privacy links, HIDDEN ANSWERS list with tap-to-unhide, BLOCKED USERS with tap-to-unblock — must render synthetic `contributor:<id>` entries with handle = cluster text, Sign out, Delete account with confirm → `deleteAccount()` + signOut).

**Files:**
- Create: `ios-swift/Relatably/Features/Me/MeViewModel.swift`, `MeView.swift`
- Test: `ios-swift/RelatablyTests/MeViewModelTests.swift` (unhide/unblock mutate stores; delete-account calls API then signs out)

- [ ] **Steps 1–4: TDD. Step 5: views + sim screenshot (with one hidden item visible after Task-10 walkthrough). Step 6: Commit** — `feat(swift): ME tab — support, undo lists, account deletion`

---

### Task 16: Share cards

**Report:** `rn-extraction/reveal-share.md` (share card composition, banner types todays_take/verdict/called_it, share URL `https://relatably.app/?r=<code>`, trackShare payload).

**Files:**
- Create: `ios-swift/Relatably/Core/ShareCard.swift` — SwiftUI card view → `ImageRenderer(scale: 3)` → PNG → share sheet; `trackShare` best-effort before presenting; failures silent.
- Test: `ios-swift/RelatablyTests/ShareCardTests.swift` (renderer produces non-nil image of expected aspect; URL built from referral code)

- [ ] **Steps 1–4: TDD. Step 5: wire CTAs (reveal + archive long-press). Step 6: Commit** — `feat(swift): share cards via ImageRenderer + share tracking`

---

### Task 17: Full suite + Release builds

- [ ] **Step 1:** `xcodebuild … test` on iPhone 16 Pro Max — expect `** TEST SUCCEEDED **`, ~50+ tests.
- [ ] **Step 2:** Release build for simulator: `xcodebuild -project ios-swift/Relatably.xcodeproj -scheme Relatably -configuration Release -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' CODE_SIGNING_ALLOWED=NO build` — expect success.
- [ ] **Step 3:** Same for `iPad Air 11-inch (M4)`.
- [ ] **Step 4: Commit any fixes** — `test(swift): full suite green on release config`

---

### Task 18: Functional walkthrough + boot robustness (both simulators)

Tooling: xclaude-plugin MCP (`simulator_boot`, `simulator_install_app`, `simulator_launch_app`, `idb_describe`, `idb_tap`, `idb_input`, `simulator_screenshot`) or `xcrun simctl` + AXe.

- [ ] **Step 1 (iPhone 16 Pro Max, Release build):** scripted pass — fresh install → EULA (screenshot 01) → I AGREE → Today question (02) → type "flowers" → wait 3 s dwell → DROP IT → wordcloud with YOU bubble (03) → tap foreign bubble → sheet (04) → Hide → bubble gone (05) → Board: periods + "…" sheet (06) → Archive list (07) → detail + "…" (08) → Friends gate (09) → ME: hidden item listed, tap to unhide (10). Every screenshot inspected — not just captured.
- [ ] **Step 2 (iPad Air 11-inch (M4), Release build):** boot sim, install, repeat the same pass in iPhone-compat mode (screenshots 01–10-ipad). **This is the rejection scenario — the app must reach the question screen.**
- [ ] **Step 3 (dead-host boot test):** relaunch with launch args `-apiBaseURL http://127.0.0.1:9` → RETRY error card must appear in ≤ 12 s (screenshot); relaunch without the override → recovers. Repeat once on the iPad sim.
- [ ] **Step 4:** `xcrun simctl spawn booted log show --last 5m --predicate 'process == "Relatably"'` — no crash reports; and `strings` on the app binary must NOT reference `ATTrackingManager` request APIs.
- [ ] **Step 5: Commit walkthrough artifacts** (screenshots under `ios-swift/verification/`) — `test(swift): simulator walkthrough iPhone + iPad + dead-host boot test`

---

### Task 19: Visual parity loop vs RN app

- [ ] **Step 1:** Build/launch the RN app in a simulator (`cd ios && npx expo run:ios --configuration Release` — build 33/34 ran in sim before; fallback per spec §9.3: ASC marketing screenshots at `ios/assets/screenshots/6.9/` as reference).
- [ ] **Step 2:** Capture the same 10 screens from the RN app.
- [ ] **Step 3:** Compare pairs screen-by-screen (fonts, colors, spacing, rotations, shadows, copy). Fix SwiftUI deviations; re-shoot until visually equivalent. Document accepted differences (e.g. system share sheet) in `ios-swift/verification/PARITY.md`.
- [ ] **Step 4: Commit** — `fix(swift): visual parity pass vs RN app`

---

### Task 20: Archive, export, upload build 35

- [ ] **Step 1: Pre-archive profile check:** `security cms -D -i ~/Library/MobileDevice/Provisioning\ Profiles/f2eb62a8-dcb6-412f-b2e0-4fc7027c9af8.mobileprovision | grep -A2 applesignin` — must show the entitlement.
- [ ] **Step 2: Archive:**

```bash
cd ios-swift && xcodebuild -project Relatably.xcodeproj -scheme Relatably -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Relatably35.xcarchive archive
```

- [ ] **Step 3: Write `ios-swift/ExportOptions.plist`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>R95M36AU2X</string>
  <key>signingStyle</key><string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>co.relatably.app</key><string>Relatably Local AppStore 2026-06-01</string>
  </dict>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
```

- [ ] **Step 4: Export + upload:**

```bash
xcodebuild -exportArchive -archivePath build/Relatably35.xcarchive -exportPath build/export35 -exportOptionsPlist ExportOptions.plist
xcrun altool --upload-app -f build/export35/Relatably.ipa -t ios \
  --apiKey 8XWLD2B2RQ --apiIssuer 538cb0d4-b8c6-4bc7-8b59-75da5d2b9411
```

(Key must be discoverable at `~/.appstoreconnect/private_keys/AuthKey_8XWLD2B2RQ.p8` — copy from `.secrets/` if missing.) Expected: `No errors uploading`.

- [ ] **Step 5: Poll processing:** `node scripts/asc-list-builds.mjs` until build 35 shows `state=VALID` (typically 5–15 min).
- [ ] **Step 6: Commit** — `chore(release): build 35 archived + uploaded`

---

### Task 21: ASC resubmission

**Report:** `rn-extraction/asc-scripts.md` §1 (fill-metadata flow — re-running it attaches the newest VALID build and rewrites review notes), §2 (submit script + draft-detection), §3/§4 (cancel semantics: `PATCH /v1/reviewSubmissions/{id} {canceled:true}` → state CANCELING → poll; transient 409 on add-item right after cancel — retry).

- [ ] **Step 1: Update review notes** in `scripts/asc-fill-metadata.mjs`: keep the entire 1.2 contract text verbatim, prepend this 2.1(a) paragraph:

```
GUIDELINE 2.1(a) — WHAT CHANGED IN THIS BUILD
Build 34 could fail to get past its initial loading screen on iPadOS. We rebuilt the app natively in Swift/SwiftUI for this build (35). Startup now has hard 10-second network timeouts and a 12-second watchdog: the app ALWAYS reaches either today's question, an archive fallback, or an explicit retry screen — verified on iPad Air 11-inch simulators (iPhone-compatibility mode) with normal, slow, and unreachable network. All previously reviewed functionality and all Guideline 1.2 moderation controls below are unchanged.
```

Also verify every 1.2 promise still matches the SwiftUI build (Task 18 walkthrough is the proof).
- [ ] **Step 2:** Run `node scripts/asc-fill-metadata.mjs` — attaches build 35 (newest VALID) to v1.0 and writes notes. NOTE: fill-metadata accepts state REJECTED, so it can run before the cancel; metadata edits may flip the version to PREPARE_FOR_SUBMISSION themselves (build-33 lesson).
- [ ] **Step 3: Cancel the rejected submission:** edit `scripts/asc-cancel-old-submission.mjs` → `OLD = "1b1cbb00-b663-4bef-a75d-739fcb59d34b"`, run it; poll `GET /v1/reviewSubmissions/{id}` until state leaves CANCELING (150 s budget pattern from asc-wait-and-submit).
- [ ] **Step 4: Submit:** `node scripts/asc-submit-for-review.mjs` (requires v1.0 in PREPARE_FOR_SUBMISSION with build 35 attached). On transient 409 `ENTITY_STATE_INVALID`: wait 30 s, retry once. Expected: `✓ SUBMITTED FOR REVIEW`.
- [ ] **Step 5: Verify via API:** version state `WAITING_FOR_REVIEW` + attached build is 35.
- [ ] **Step 6: Commit script changes** — `chore(asc): resubmit v1.0 with native build 35 (cancel 1b1cbb00)`

---

### Task 22: Persistence + repo close-out

- [ ] **Step 1:** Push `feat/swiftui-rebuild`; open PR "SwiftUI native rebuild (build 35) — fixes 2.1(a)" with summary + verification evidence; merge to `main` (repo pattern: PRs #4–#6). `ios/` (RN) stays in the repo until Apple approves (spec §11) — its deletion is a documented follow-up, NOT part of this plan.
- [ ] **Step 2:** Obsidian brain note `~/Data/Claude/brain/10_Projects/Relatably/2026-07-02-swiftui-rebuild.md`: rejection history, root cause, rebuild summary, verification evidence, submission state, follow-ups (delete `ios/` + `git mv ios-swift ios` after approval; banner-units red flag; link AdMob listing once live).
- [ ] **Step 3:** Memory: new `project_relatably_swiftui_rebuild_2026-07-02.md` (supersedes the build-34 note's "in review" claim) + MEMORY.md index line (≤160 chars).
- [ ] **Step 4:** Final status report to Levin: what shipped, proof, what's pending (Apple review), follow-ups.

---

## Self-review (done at authoring time; issues fixed inline)

- **Spec coverage:** goals §2.1→Tasks 18/19; §2.2→Tasks 3/9/18; §2.3→Tasks 5/8/10/12/13/15; §2.4→Tasks 1/11; §2.5→Tasks 17/18; §2.6→Tasks 20/21. Spec §11 cleanup deliberately deferred to post-approval (documented in Task 22).
- **No placeholders:** every task names normative in-repo report sections + exact files/commands; full code given where content is new (project.yml, entitlements, ExportOptions, review-notes paragraph, state-machine contract).
- **Type consistency:** `Phase` (Task 9) is consumed by Tasks 10/11; `StringStore` (Task 4) used by EulaStore/gates; `ClusterLiveSource` (Task 7) consumed by LiveCounter (Task 9) and WordcloudView (Task 10); `tokenProvider` (Task 3) implemented by AuthService (Task 7).
