# Relatably — Core Libs Extraction (for 1:1 SwiftUI port)

Source root: `/Users/levinschwab/Data/Claude/relatably/ios`
Files covered: `src/lib/api.ts`, `src/types/api.ts`, `src/lib/deviceId.ts`, `src/lib/ads.ts`, `src/lib/interstitialGate.ts`, `src/lib/revealStore.ts`, `src/lib/hiddenContentStore.ts`, `src/lib/clusterModeration.ts` + their `.test.ts` files.
These are non-UI modules: no colors, fonts, paddings, or component trees exist in them (see §8 for the one UI surface: the moderation action sheet). All user-facing strings and numeric constants that DO exist are captured below.

---

## 1. API Client (`src/lib/api.ts`)

### 1.1 Base URL and auth header

- `BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"` — Swift equivalent: a build-config/env-injected base URL with fallback `http://localhost:3000`.
- Auth header logic (applies to every endpoint marked "auth" below):

```ts
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}
```

Key behavior: if `getIdToken()` (Firebase Auth) returns null, the request is STILL sent, just without an `authorization` header (server then 401s and the client throws). Header name is lowercase `authorization`, value `Bearer <token>`.

### 1.2 Endpoint-by-endpoint spec

All bodies are JSON with header `content-type: application/json` (lowercase). All non-2xx responses throw. Exact error message strings are given because they may surface in alerts/logs.

| # | Function | Method | Path | Auth | Body / Query | Returns | Error thrown on !ok |
|---|----------|--------|------|------|--------------|---------|--------------------|
| 1 | `fetchTodayQuestion()` | GET | `/api/questions/today` | no | — | `TodayQuestion` | `` `fetchTodayQuestion: ${res.status}` `` |
| 2 | `submitAnswer(req)` | POST | `/api/submit` | yes | JSON `SubmitRequest` | `SubmitResponse` | body parsed; throws `body.error` if present else `` `submit: ${res.status}` `` (see 1.3) |
| 3 | `registerDevice(payload)` | POST | `/api/devices/register` | **no** | JSON `DeviceRegisterPayload` | `void` | `` `register failed: ${res.status}` `` |
| 4 | `fetchYesterday(deviceToken?)` | GET | `/api/yesterday` | no | query `device_token=<token>` only if provided | `Yesterday \| null` — **returns `null` on HTTP 404** (not an error) | `` `yesterday failed: ${res.status}` `` for other non-ok |
| 5 | `fetchAuthMe()` | **POST** | `/api/auth/me` | yes | no body | `AuthMeResponse` | `` `auth/me failed: ${res.status}` `` |
| 6 | `requestFriend(targetUserId)` | POST | `/api/friends/request` | yes | `{ "target_user_id": targetUserId }` | `{ id: string; status: string }` | `` `requestFriend: ${res.status}` `` |
| 7 | `acceptFriend(friendshipId)` | POST | `/api/friends/accept` | yes | `{ "friendship_id": friendshipId }` | `{ id: string; status: string }` | `` `acceptFriend: ${res.status}` `` |
| 8 | `removeFriend(friendshipId)` | DELETE | `/api/friends/{friendshipId}` (URL-encoded) | yes | — | `void` | `` `removeFriend: ${res.status}` `` |
| 9 | `fetchFriends()` | GET | `/api/friends` | yes | — | `{ friendships: Friendship[] }` | `` `fetchFriends: ${res.status}` `` |
| 10 | `fetchLeaderboard(opts)` | GET | `/api/leaderboard` | **only when `scope === "friends"`** | query `period=<period>&scope=<scope>` and `limit=<n>` only if `opts.limit` truthy | `{ entries: LeaderboardEntry[] }` | `` `fetchLeaderboard: ${res.status}` `` |
| 11 | `trackShare(req)` | POST | `/api/share/track` | yes | JSON `ShareTrackRequest` | `ShareTrackResponse` | `` `trackShare: ${res.status}` `` |
| 12 | `fetchArchive(cursor?)` | GET | `/api/archive` or `/api/archive?cursor=<encoded>` | no | cursor URL-encoded (e.g. `2026-05-08T00:00:00.000Z` → `cursor=2026-05-08T00%3A00%3A00.000Z`) | `ArchivePage` | `` `fetchArchive failed: ${res.status}` `` |
| 13 | `fetchArchiveDetail(questionId)` | GET | `/api/archive/{questionId}` (URL-encoded) | no | — | `ArchiveDetail` | `` `fetchArchiveDetail failed: ${res.status}` `` (404 also throws — unlike `fetchYesterday`) |
| 14 | `reportContent(payload)` | POST | `/api/report` | yes | JSON `ReportPayload` | `void` | `` `report failed: ${res.status}` `` |
| 15 | `deleteOwnSubmission(submissionId, deviceToken)` | **DELETE with JSON body** | `/api/submissions/{submissionId}` (URL-encoded) | yes | `{ "device_token": deviceToken }` + `content-type: application/json` | `void` | `` `deleteOwnSubmission failed: ${res.status}` `` |
| 16 | `blockUser(targetUserId)` | POST | `/api/users/{targetUserId}/block` (URL-encoded) | yes | no body | `void` | `` `blockUser failed: ${res.status}` `` |
| 17 | `deleteAccount()` | POST | `/api/account/delete` | yes | no body | `void` | `` `deleteAccount failed: ${res.status}` `` |

### 1.3 submitAnswer error path (verbatim — the server error string is user-relevant)

```ts
export async function submitAnswer(req: SubmitRequest): Promise<SubmitResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `submit: ${res.status}`);
  }
  return res.json();
}
```

Port note: on failure the client prefers the server's `error` field verbatim as the thrown message; JSON-parse failure of the error body falls back to `submit: <status>`.

### 1.4 ReportPayload (defined in api.ts, not types/api.ts)

```ts
export interface ReportPayload {
  target_type: "cluster" | "submission" | "user";
  target_id: string;
  reason?: string;
  device_token?: string;
}
```

---

## 2. API Types (`src/types/api.ts` — ENTIRE file, verbatim)

```ts
export interface TodayQuestion {
  id: string;
  text: string;
}

export interface SubmitRequest {
  question_id: string;
  device_token: string;
  raw_text: string;
  dwell_ms: number;
}

export interface SubmitResponse {
  cluster_id: string;
  submission_count: number;
  normalized_text: string;
  submission_id: string;
}

export interface DeviceRegisterPayload {
  device_token: string;
  fcm_token: string;
}

export interface YesterdayCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;
}

export interface Yesterday {
  id: string;
  text: string;
  top_clusters: YesterdayCluster[];
  self_cluster_id: string | null;
}

export interface AuthMeResponse {
  uid: string;
  handle: string | null;
  is_public: boolean;
  locale: string;
  shadowbanned: boolean;
}

export interface Friendship {
  id: string;
  friend_user_id: string;
  handle: string | null;
  locale: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
}

export interface LeaderboardEntry {
  user_id: string;
  handle: string | null;
  score: number;
  daily_rank?: number;
  locale: string;
}

export type LeaderboardPeriod = "daily" | "weekly" | "alltime";
export type LeaderboardScope = "global" | "friends";

export type BannerType = "todays_take" | "verdict" | "called_it";
export type ShareTarget = "ig_story" | "tiktok" | "snap" | "imessage" | "system";

export interface ShareTrackRequest {
  banner_type: BannerType;
  question_id: string;
  share_target: ShareTarget;
}

export interface ShareTrackResponse {
  referral_code: string;
}

export interface ArchiveTile {
  question_id: string;
  question_text: string;
  verdict_text: string;
  top_clusters: string[];
  created_at: string;
}

export interface ArchivePage {
  tiles: ArchiveTile[];
  next_cursor: string | null;
}

export interface ArchiveDetailCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;
}

export interface ArchiveDetail {
  id: string;
  text: string;
  created_at: string;
  top_clusters: ArchiveDetailCluster[];
}
```

Swift port: all field names are snake_case on the wire — use `CodingKeys` or `.convertFromSnakeCase` consistently. `daily_rank` is optional; `handle`, `self_cluster_id`, `next_cursor` are nullable.

---

## 3. Device ID (`src/lib/deviceId.ts` — entire, verbatim)

```ts
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";

const KEY = "relatably.device_token";

export async function getDeviceToken(): Promise<string> {
  let token = await SecureStore.getItemAsync(KEY);
  if (token) return token;

  const ifv = await Application.getIosIdForVendorAsync().catch(() => null);
  token = ifv ?? `anon-${cryptoRandom()}`;
  await SecureStore.setItemAsync(KEY, token);
  return token;
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

Algorithm:
1. Read Keychain (SecureStore) key `relatably.device_token`; if present, return it (stable forever once written).
2. Else try iOS identifierForVendor (`UIDevice.current.identifierForVendor?.uuidString` in Swift); on failure/nil, fall back to `anon-` + random base-36 string (`Math.random().toString(36).slice(2)` concatenated with `Date.now().toString(36)`; despite the name, NOT cryptographically secure — in Swift, `UUID().uuidString` prefixed with `anon-` is an acceptable equivalent, but note the RN format is `anon-<lowercase base36>`).
3. Persist to Keychain and return.

Swift persistence: Keychain item, key `relatably.device_token` (keep the exact key if migration from the RN app's Keychain is desired — expo-secure-store stores under service `app bundle id` with its own account naming; a fresh key is fine for a clean rewrite since IFV will regenerate the same value anyway).

---

## 4. Ads (`src/lib/ads.ts` — entire)

### 4.1 Constants

| Constant | Value | Applies to |
|----------|-------|-----------|
| `TEST_BANNER` | `ca-app-pub-3940256099942544/2934735716` | Google's official iOS test banner unit; fallback for both banner slots |
| `TEST_INTERSTITIAL` | `ca-app-pub-3940256099942544/4411468910` | Google's official iOS test interstitial (video) unit; DEV fallback |
| `PROD_INTERSTITIAL` | `ca-app-pub-6563643868702361/2000809540` | Real production interstitial unit (Relatably AdMob app `ca-app-pub-6563643868702361~4571132569`) |
| `nonPersonalized` | `true` (hard-coded) | Every interstitial request sets `requestNonPersonalizedAdsOnly: true` |
| Load timeout | `8000` ms | `loadInterstitialOnce` gives up and resolves null if no LOADED/ERROR event within 8 s |
| Max ad content rating | `MaxAdContentRating.T` ("T" — Teen) | Global request configuration set before SDK init |

Slots: `"leaderboard_banner" | "archive_banner" | "post_reveal_interstitial"`.

Env overrides: `EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID`, `EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID`, `EXPO_PUBLIC_ADMOB_ENABLED`.

### 4.2 ATT policy (verbatim comment — load-bearing for App Review)

```ts
// Relatably does not track users in the App Tracking Transparency sense: it
// never links data with third-party data for advertising and never calls the
// ATT framework. AdMob is therefore always requested non-personalized, so no
// IDFA-based cross-app tracking occurs. App Privacy in App Store Connect
// declares "Data Not Used to Track You" to match — there is no ATT prompt.
```

Swift port: NEVER call `ATTrackingManager.requestTrackingAuthorization`. Every `GADRequest` must carry `"npa": "1"` extras (`GADExtras.additionalParameters = ["npa": "1"]`). `GADMobileAds.sharedInstance().requestConfiguration.maxAdContentRating = .teen`.

### 4.3 Enable gate (verbatim)

```ts
export function isAdsEnabled(): boolean {
  if (cachedEnabled === undefined) {
    // Ads ship enabled in release builds. In dev they stay opt-in via env so the
    // simulator and the jest suite are ad-free unless explicitly turned on.
    cachedEnabled = !__DEV__ || process.env.EXPO_PUBLIC_ADMOB_ENABLED === "true";
  }
  return cachedEnabled;
}
```

- Release build → always enabled. Debug build → only when env var is the exact string `"true"` (`"1"` and `"false"` do NOT enable; test-verified). Result is cached after first call (memoized boolean).

### 4.4 Unit-ID resolution (verbatim)

```ts
export function getAdUnitId(slot: Slot): string {
  switch (slot) {
    case "leaderboard_banner":
      return process.env.EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID ?? TEST_BANNER;
    case "archive_banner":
      return process.env.EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID ?? TEST_BANNER;
    case "post_reveal_interstitial":
      return (
        process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ??
        (__DEV__ ? TEST_INTERSTITIAL : PROD_INTERSTITIAL)
      );
  }
}
```

RED FLAG: banner slots have NO production fallback — without env vars a release build would serve Google TEST banner units. Only the interstitial has a real prod unit baked in. The SwiftUI port must confirm the real banner unit IDs from build config (eas.json / .env / CI) or ship banner-free.

### 4.5 SDK init (once-only, error-swallowing)

```ts
export async function initAds(): Promise<void> {
  if (!isAdsEnabled() || initStarted) return;
  initStarted = true;

  try {
    const { default: mobileAds, MaxAdContentRating } = await import(
      "react-native-google-mobile-ads"
    );
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,
    });
    await mobileAds().initialize();
  } catch (e) {
    console.warn("ads init failed", e);
  }
}
```

Order matters: request configuration is set BEFORE `initialize()`. Any failure is logged (`"ads init failed"`) and swallowed — the app must never crash or block on ads.

### 4.6 Interstitial load/show (verbatim — the settle/timeout logic is the algorithm)

```ts
export interface InterstitialController {
  show: () => Promise<void>;
  dispose: () => void;
}

// Loads a single post-reveal interstitial (video-capable). Resolves to null if
// ads are disabled or nothing fills, so callers can always proceed silently.
export async function loadInterstitialOnce(): Promise<InterstitialController | null> {
  if (!isAdsEnabled()) return null;
  try {
    const { InterstitialAd, AdEventType } = await import(
      "react-native-google-mobile-ads"
    );
    const ad = InterstitialAd.createForAdRequest(
      getAdUnitId("post_reveal_interstitial"),
      { requestNonPersonalizedAdsOnly: nonPersonalized },
    );

    const loaded = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (v: boolean) => {
        if (settled) return;
        settled = true;
        unsubLoaded();
        unsubError();
        resolve(v);
      };
      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => finish(true));
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
      setTimeout(() => finish(false), 8000);
      ad.load();
    });

    if (!loaded) return null;

    return {
      show: () =>
        new Promise<void>((resolve) => {
          const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
            unsubClosed();
            resolve();
          });
          try {
            ad.show();
          } catch {
            unsubClosed();
            resolve();
          }
        }),
      dispose: () => {},
    };
  } catch (e) {
    console.warn("interstitial load failed", e);
    return null;
  }
}
```

Semantics for Swift (`GADInterstitialAd.load` with completion handler):
- Race of three outcomes, first wins (idempotent `finish`): LOADED→true, ERROR→false, 8000 ms timeout→false.
- No-fill / timeout / disabled / any exception ⇒ return `nil`; callers proceed silently — never surface an ad error to the user.
- `show()` resolves when the ad is CLOSED (fullScreenContentDidDismiss); if `ad.show()` itself throws, resolve immediately (never hang the post-reveal flow).
- `dispose()` is a no-op.
- Log strings: `"interstitial load failed"`, `"ads init failed"` (console only, not user-facing).

---

## 5. One-shot persistence gates

### 5.1 `src/lib/interstitialGate.ts` (entire, verbatim)

```ts
import * as SecureStore from "expo-secure-store";

const PREFIX = "interstitial_seen_";

export async function hasShownInterstitialFor(questionId: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(`${PREFIX}${questionId}`);
  return v === "1";
}

export async function markInterstitialShownFor(questionId: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}${questionId}`, "1");
}
```

### 5.2 `src/lib/revealStore.ts` (entire, verbatim)

```ts
import * as SecureStore from "expo-secure-store";

const PREFIX = "reveal_seen_";

export async function hasSeenReveal(questionId: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(`${PREFIX}${questionId}`);
  return v === "1";
}

export async function markRevealSeen(questionId: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}${questionId}`, "1");
}
```

Both: Keychain-backed per-question one-shot flags. Key format `interstitial_seen_<questionId>` / `reveal_seen_<questionId>`, value literally the string `"1"`; anything else (including nil) reads as false. Purpose: interstitial shown at most once per question; reveal animation played at most once per question. Note Keychain persists across app reinstalls on iOS — that matches expo-secure-store behavior and is presumably intentional.

---

## 6. Hidden content store (`src/lib/hiddenContentStore.ts`)

### 6.1 Storage decision (verbatim comment)

```ts
// User-managed lists of UGC the local user has chosen not to see.
// Backs the Hide-cluster / Block-user mechanisms required by App Review
// Guideline 1.2. AsyncStorage (not SecureStore) because Keychain has a
// ~2KB-per-value limit on iOS that can fail for power users.
```

Swift equivalent: UserDefaults (or a small file) — NOT Keychain, because the JSON arrays are unbounded.

### 6.2 Keys and JSON shapes

| Key | Value shape (JSON array, newest first) |
|-----|----------------------------------------|
| `ugc_hidden_clusters_v1` | `[{ "id": string, "text": string, "hidden_at": number /* ms epoch, Date.now() */ }, …]` |
| `ugc_blocked_users_v1` | `[{ "user_id": string, "handle": string \| null, "blocked_at": number /* ms epoch */ }, …]` |

### 6.3 Behavior (verbatim core)

```ts
async function readJson<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function hideCluster(input: { id: string; text: string }): Promise<void> {
  const list = await getHiddenClusters();
  if (list.some((h) => h.id === input.id)) return;
  list.unshift({ id: input.id, text: input.text, hidden_at: Date.now() });
  await writeJson(HIDDEN_KEY, list);
}

export async function unhideCluster(id: string): Promise<void> {
  const list = await getHiddenClusters();
  await writeJson(HIDDEN_KEY, list.filter((h) => h.id !== id));
}

export async function addBlockedUser(input: {
  user_id: string;
  handle: string | null;
}): Promise<void> {
  const list = await getBlockedUsers();
  if (list.some((b) => b.user_id === input.user_id)) return;
  list.unshift({ user_id: input.user_id, handle: input.handle, blocked_at: Date.now() });
  await writeJson(BLOCKED_KEY, list);
}

export async function removeBlockedUser(user_id: string): Promise<void> {
  const list = await getBlockedUsers();
  await writeJson(BLOCKED_KEY, list.filter((b) => b.user_id !== user_id));
}
```

Rules to preserve 1:1:
- Insert at the FRONT (`unshift`) — most-recently-hidden/blocked first (order is user-visible under the ME tab).
- Idempotent by `id` / `user_id` — duplicate adds are silently ignored (first-write-wins for `text`/`handle` and timestamp).
- Corrupt/missing/non-array stored JSON reads as empty list, never throws.
- Convenience: `getHiddenClusterIds()` / `getBlockedUserIds()` return `Set<string>` of ids for O(1) filtering in feeds.
- Timestamps are milliseconds since epoch (JS `Date.now()`), stored as JSON numbers.

---

## 7. Cluster moderation sheet (`src/lib/clusterModeration.ts`)

Entry point: `openClusterModerationSheet(id: string, text: string, onHidden?: (id, text) => void)` — called from ClusterBubble (live + fallback wordcloud) and Archive detail via a visible tappable control (App Review Guideline 1.2 requirement — NOT only long-press).

### 7.1 iOS action sheet (verbatim strings, exact order/indices)

```ts
ActionSheetIOS.showActionSheetWithOptions(
  {
    options: ["Cancel", "Hide this answer", "Report this answer", "Block this contributor"],
    destructiveButtonIndex: 3,
    cancelButtonIndex: 0,
    title: `"${text}"`,
  },
  (index) => {
    if (index === 1) doHide();
    if (index === 2) doReport();
    if (index === 3) doBlock();
  },
);
```

- Sheet title: the cluster text wrapped in double quotes, e.g. `"Bitcoin"` (literal `"` characters, no other prefix).
- Buttons in order: `Cancel` (cancel), `Hide this answer`, `Report this answer`, `Block this contributor` (destructive/red).
- SwiftUI: `confirmationDialog` with title `"\"\(text)\""`, `.destructive` on Block, cancel implicit.

### 7.2 Android fallback (verbatim; not needed for iOS port but strings for reference)

```ts
Alert.alert(
  `"${text}"`,
  "Remove from your feed, report it, or block whoever wrote it? Reports are reviewed within 24 hours.",
  [
    { text: "Cancel", style: "cancel" },
    { text: "Hide", onPress: doHide },
    { text: "Report", onPress: doReport },
    { text: "Block", style: "destructive", onPress: doBlock },
  ],
);
```

### 7.3 Action semantics (verbatim — local-first, server best-effort)

```ts
const doHide = async () => {
  try {
    await hideCluster({ id, text });
    onHidden?.(id, text);
  } catch (err) {
    Alert.alert("Couldn't hide", err instanceof Error ? err.message : String(err));
  }
};

const doReport = async () => {
  // Remove from the feed immediately, then report best-effort.
  await hideCluster({ id, text });
  onHidden?.(id, text);
  try {
    const deviceToken = await getDeviceToken();
    await reportContent({ target_type: "cluster", target_id: id, device_token: deviceToken });
  } catch {
    /* anonymous / offline / demo content — local removal already applied */
  }
  Alert.alert("Thanks for reporting", "We removed it from your feed and will review within 24 hours.");
};

const doBlock = async () => {
  // Answers are anonymous aggregates, so "block" works at the contributor
  // level: hide the answer, record a local block so this contributor's
  // content stays out of the feed (visible + reversible under the ME tab),
  // and report it server-side best-effort.
  await hideCluster({ id, text });
  await addBlockedUser({ user_id: `contributor:${id}`, handle: text });
  onHidden?.(id, text);
  try {
    const deviceToken = await getDeviceToken();
    await reportContent({
      target_type: "cluster",
      target_id: id,
      reason: "blocked contributor",
      device_token: deviceToken,
    });
  } catch {
    /* local block already applied */
  }
  Alert.alert("Blocked", "We won't show this contributor's answers again.");
};
```

Alert strings (verbatim, title / message):
- `Couldn't hide` / the error's message text (only shown if the LOCAL hide fails — practically never).
- `Thanks for reporting` / `We removed it from your feed and will review within 24 hours.`
- `Blocked` / `We won't show this contributor's answers again.`

Semantics to preserve exactly:
1. ALL three actions hide locally FIRST and fire `onHidden` immediately (instant removal from the feed, works offline and on demo content — App-Review-critical).
2. Server `reportContent` calls are best-effort: failures are swallowed silently, and the success alert is shown REGARDLESS of whether the server call succeeded.
3. Report payload: `{ target_type: "cluster", target_id: id, device_token }`; Block additionally sends `reason: "blocked contributor"`.
4. Block records a synthetic local blocked user: `user_id = "contributor:" + clusterId`, `handle = <cluster text>` — this is what appears in the ME-tab blocked list, so the SwiftUI ME screen must render these synthetic entries.
5. Plain Hide (`doHide`) makes NO server call at all.

---

## 8. UI note

None of these files define colors, fonts, sizes, paddings, radii, shadows, rotations, or layout. The only UI they own is the native action sheet + three alerts in §7. Visual specs live in `src/theme/tokens.ts`, `src/components/*`, `src/screens/*`, `src/lib/wordcloudLayout.ts`, `src/lib/stickerRotation.ts`, `src/lib/clusterSizeBucket.ts`, `src/lib/shareCard.ts` (out of scope for this extract — flag for companion extracts).

---

## 9. Test vectors (from `.test.ts` files → XCTest fixtures)

### 9.1 api.test.ts

| Call | Given | Expect |
|------|-------|--------|
| `fetchAuthMe()` | token = `id-token-1`; server 200 `{"uid":"u1","handle":null,"is_public":true,"locale":"en","shadowbanned":false}` | method POST; header `authorization: Bearer id-token-1`; result.uid == `u1` |
| `fetchAuthMe()` | `getIdToken()` → null; server 401 `{"error":"unauthorized"}` | request IS still sent (no auth header); throws |
| `requestFriend("u2")` | server 200 `{"id":"fid","status":"pending"}` | body exactly `{"target_user_id":"u2"}`; bearer header; result `{id:"fid",status:"pending"}` |
| `acceptFriend("fid")` | server 200 `{"id":"fid","status":"accepted"}` | body exactly `{"friendship_id":"fid"}` |
| `removeFriend("fid")` | server 200 | HTTP method DELETE |
| `fetchFriends()` | server 200 `{"friendships":[{"id":"f1"}]}` | returns 1 friendship |
| `fetchLeaderboard({period:"daily",scope:"global"})` | server 200 `{"entries":[]}` | URL contains `period=daily` and `scope=global`; NO auth header |
| `fetchLeaderboard({period:"weekly",scope:"friends"})` | token present | auth header `Bearer id-token-1` sent |
| `fetchArchive()` | 200 `{"tiles":[],"next_cursor":null}` | URL ends with `/api/archive` (no `?`); result equals input |
| `fetchArchive("2026-05-08T00:00:00.000Z")` | 200 | URL contains `cursor=2026-05-08T00%3A00%3A00.000Z` |
| `fetchArchive()` | server 500 | throws |
| `fetchArchiveDetail("q1")` | 200 `{"id":"q1","text":"?","created_at":"x","top_clusters":[]}` | URL ends `/api/archive/q1`; result.id == `q1` |
| `fetchArchiveDetail("missing")` | server 404 | throws (contrast: `fetchYesterday` returns nil on 404) |

### 9.2 ads.test.ts

| Given | Expect |
|-------|--------|
| DEV build, no env | `isAdsEnabled()` == false |
| DEV, `EXPO_PUBLIC_ADMOB_ENABLED="true"` | true |
| DEV, `"false"` | false |
| DEV, `"1"` | false (strict string equality with `"true"`) |
| no env | `getAdUnitId("leaderboard_banner")` == `ca-app-pub-3940256099942544/2934735716`; `"archive_banner"` same; `"post_reveal_interstitial"` == `ca-app-pub-3940256099942544/4411468910` (DEV) |
| `EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID="ca-app-pub-1111/leaderboard"` | `getAdUnitId("leaderboard_banner")` == that value |
| ads disabled | `loadInterstitialOnce()` resolves to null |

### 9.3 interstitialGate.test.ts / revealStore.test.ts

| Call | Given | Expect |
|------|-------|--------|
| `hasShownInterstitialFor("q-1")` | store empty | false; reads key `interstitial_seen_q-1` |
| `hasShownInterstitialFor("q-1")` | stored `"1"` | true |
| `markInterstitialShownFor("q-1")` | — | writes key `interstitial_seen_q-1` value `"1"` |
| `hasSeenReveal("q-1")` | never marked | false |
| `hasSeenReveal("q-1")` after `markRevealSeen("q-1")` | — | true |
| `hasSeenReveal("q-2")` after marking only `q-1` | — | false (per-question isolation) |

### 9.4 hiddenContentStore.test.ts

| Scenario | Expect |
|----------|--------|
| fresh store | `getHiddenClusters()` == `[]`; `getHiddenClusterIds()` == empty set |
| `hideCluster({id:"c1",text:"AI"})` | list length 1; `[0].id=="c1"`, `[0].text=="AI"`, `hidden_at` is a number |
| hide `c1` twice | length stays 1 (idempotent) |
| hide `c1`,`c2` ("AI","Bitcoin") | ids set contains c1,c2, not c3 |
| then `unhideCluster("c1")` | set has c2 only |
| `addBlockedUser({user_id:"u1",handle:"alice"})` | length 1; user_id `u1`, handle `alice`, `blocked_at` number |
| handle null | stored as null |
| add u1 twice | length 1 |
| add u1,u2 then `removeBlockedUser("u1")` | ids set has u2 only |

---

## 10. Red flags / surprises recap (port checklist)

1. **Banner ad units have no prod fallback** in code — release builds without env vars would show Google TEST banners. Confirm real unit IDs from build env before shipping the Swift port. Interstitial prod unit IS in code: `ca-app-pub-6563643868702361/2000809540`.
2. **No ATT, ever** — non-personalized ads only (`npa=1`), maxAdContentRating T, App Privacy = "Data Not Used to Track You". Adding an ATT prompt or personalized ads would contradict the App Store privacy declaration.
3. **`fetchAuthMe` is a POST with no body**; `fetchYesterday` treats 404 as `nil` while `fetchArchiveDetail` treats 404 as error; `deleteOwnSubmission` is a DELETE **with a JSON body** (unusual — URLSession supports it, but verify server accepts it from URLSession).
4. **submitAnswer surfaces the server's `error` string verbatim** as the thrown error message (user may see it in an alert upstream).
5. **Moderation is local-first**: success alerts appear even when the server report fails/offline; plain Hide never talks to the server; Block creates a synthetic blocked user `contributor:<clusterId>` with `handle = cluster text` that the ME tab must list and allow unblocking.
6. **Lists are newest-first (unshift) and idempotent**; corrupt persisted JSON must degrade to empty, never crash.
7. **Keychain vs UserDefaults split is deliberate**: device token + one-shot flags in Keychain (survive reinstall), unbounded hidden/blocked lists in AsyncStorage → UserDefaults (Keychain ~2KB/value limit).
8. **Interstitial timing**: 8 s load timeout, first-event-wins settle, `show()` resolves on CLOSED or immediately if `show()` throws; every failure path returns nil so the UX proceeds without the ad.
9. `deviceId` fallback token format is `anon-<base36(random)><base36(now)>` — not crypto-secure; only used when IFV is unavailable.
10. Auth header key is lowercase `authorization` (fine over HTTP/URLSession, but keep casing if any proxy/test asserts it).
