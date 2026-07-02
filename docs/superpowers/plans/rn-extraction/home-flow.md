# Relatably — Home flow (`app/(tabs)/index.tsx`) extraction for 1:1 SwiftUI port

Source root: `/Users/levinschwab/Data/Claude/relatably/ios`
Files covered: `app/(tabs)/index.tsx`, `src/components/{AnswerInput,SubmitButton,LiveCounter,QuestionText}.tsx`, `src/components/sticker/PaperTexture.tsx`, `src/components/icons/IconPeelCorner.tsx`, `src/theme/tokens.ts`, `src/theme/useStickerFonts.ts`, `src/lib/{api,deviceId,revealStore,interstitialGate,ads,messaging,firebase}.ts`, `src/types/api.ts`, tests.

---

## 0. Design tokens (`src/theme/tokens.ts`) — referenced throughout

```ts
export const palette = {
  cream: "#FFF7E8",
  cream2: "#FBEED1",
  ink: "#1A1A1A",
  inkSoft: "#4A4541",
  pink: "#FF4FA3",
  lemon2: "#FFD43B",
  lemon: "#FFDF6B",
  mint: "#7AE6C3",
  blue: "#7BC8F6",
  red: "#FF5A4F",
} as const;

export const typography = {
  // BagelFatOne is a tall, heavy-ascender display face. On iOS the line box is
  // clamped to lineHeight, so a lineHeight <= fontSize clips the top of the
  // glyphs. Display tokens therefore need headroom (~1.2x size).
  hero:   { size: 52, line: 62, family: "BagelFatOne" },
  h1:     { size: 40, line: 48, family: "BagelFatOne" },
  h2:     { size: 36, line: 44, family: "BagelFatOne" },
  h3:     { size: 22, line: 28, family: "BagelFatOne" },
  bodyL:  { size: 17, line: 24, family: "HankenGrotesk_700" },
  body:   { size: 15, line: 20, family: "HankenGrotesk_700" },
  bodyS:  { size: 13, line: 18, family: "HankenGrotesk_700" },
  label:  { size: 11, line: 14, family: "SpaceGrotesk_600", letterSpacing: 1.1 },
  micro:  { size: 9,  line: 12, family: "SpaceGrotesk_700", letterSpacing: 1.3 },
} as const;

export const sp = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, gutter: 22, section: 24 } as const;

export const radii = { s: 14, m: 22, l: 28, xl: 36, pill: 999 } as const;

export const shadow = {   // hard "sticker" shadows: radius 0, opacity 1, ink color
  s: { color: palette.ink, offset: { width: 2, height: 2 }, radius: 0, opacity: 1, elevation: 2 },
  m: { color: palette.ink, offset: { width: 4, height: 4 }, radius: 0, opacity: 1, elevation: 4 },
  l: { color: palette.ink, offset: { width: 6, height: 6 }, radius: 0, opacity: 1, elevation: 6 },
} as const;

export const motion = {
  tap: { duration: 120, easing: "ease-out" },
  spring: { duration: 200, damping: 0.5 },
  wobble: { duration: 4000, range: 2 },
  popIn: { duration: 600, overshoot: 1.08, stagger: 25 },
  reveal: { duration: 700, overshoot: 1.15 },
  pulse: { duration: 1800, scale: 1.2 },
} as const;
```

Fonts are Google Fonts loaded via `@expo-google-fonts` (`src/theme/useStickerFonts.ts`):
- `BagelFatOne` = Bagel Fat One Regular (400)
- `HankenGrotesk_500/700/800` = Hanken Grotesk Medium/Bold/ExtraBold
- `SpaceGrotesk_500/600/700` = Space Grotesk Medium/SemiBold/Bold
SwiftUI port must bundle these TTFs (Google Fonts, OFL).

---

## 1. User-facing strings (verbatim)

| String | Where | Style |
|---|---|---|
| `preparing today's drop…` | loading phase, centered | bodyL family (HankenGrotesk_700), fontSize 16, color inkSoft |
| `no drop yet` | no_drop card heading | h2 (BagelFatOne 36/44), ink, centered |
| `today's question hasn't unlocked. one question, one global drop — once a day, at a random moment in UTC.` | no_drop card body | bodyL 17/24, inkSoft, centered |
| `CHECK AGAIN` | no_drop pill button | label family (SpaceGrotesk_600), fontSize 13, letterSpacing 1.3, color cream |
| `no signal` | error card heading | h2, ink, centered |
| `couldn't reach the drop. tap to retry.` | error card body | bodyL, inkSoft, centered |
| `RETRY` | error pill button | same as CHECK AGAIN |
| `Today's drop hasn't unlocked yet. Here's the most recent one — answer it to explore the live wordcloud.` | replay hint above question when `exploringPast` (JSX uses `&apos;` — renders as plain apostrophes) | bodyS 13/18, inkSoft, centered, marginBottom sp[3]=12 |
| `your take?` | AnswerInput placeholder | placeholderTextColor `rgba(26,26,26,0.45)` |
| `DROP IT` | SubmitButton label | h3 family (BagelFatOne), fontSize **22** (overrides token size via style) |
| `{count.toLocaleString()} VOTES AND COUNTING` | LiveCounter (e.g. `1,234 VOTES AND COUNTING`; locale-formatted number) | label family, size 11, letterSpacing **1.4**, inkSoft, centered |
| dynamic `errorMsg` | red detail line under card body (error phase) AND under LiveCounter in question phase after failed submit | bodyS 13, color red `#FF5A4F`, centered |

Note: ALL copy is lowercase except the ALL-CAPS button labels/counter. `QuestionText` force-lowercases: `text.toLowerCase()`.

---

## 2. Phase state machine (`app/(tabs)/index.tsx`)

```ts
type Phase = "loading" | "reveal" | "question" | "wordcloud" | "no_drop" | "error";
```

State:
```ts
const [phase, setPhase] = useState<Phase>("loading");
const [yesterday, setYesterday] = useState<Yesterday | null>(null);
const [question, setQuestion] = useState<TodayQuestion | null>(null);
const [text, setText] = useState("");
const [renderedAt, setRenderedAt] = useState(Date.now());
const [clusters, setClusters] = useState<Cluster[]>([]);
const [selfClusterId, setSelfClusterId] = useState<string | null>(null);
const [selfSubmissionId, setSelfSubmissionId] = useState<string | null>(null);
const [errorMsg, setErrorMsg] = useState<string | null>(null);
const [exploringPast, setExploringPast] = useState(false);
const questionInFlight = useRef(false);
```

### 2.1 Launch effects (run once)
```ts
// Spin up the Mobile Ads SDK once on launch. No ATT prompt; ads non-personalized.
useEffect(() => { initAds(); }, []);

// Best-effort messaging registration on first open.
useEffect(() => {
  (async () => {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      const fcmToken = await getFcmToken();
      if (!fcmToken) return;
      const deviceToken = await getDeviceToken();
      await registerDevice({ device_token: deviceToken, fcm_token: fcmToken });
    } catch (e) { console.warn("messaging registration failed", e); }
  })();
}, []);
```
NOTE: in the shipped v1.0, `src/lib/messaging.ts` is a stub: `requestNotificationPermission()` returns `false`, `getFcmToken()` returns `null` — so the whole registration effect is a no-op (RNFB build issue; "Daily push notifications return in v1.0.1"). SwiftUI port can implement real push or keep it off; parity = off.

### 2.2 Boot effect (yesterday-reveal first, then today)
```ts
useEffect(() => {
  (async () => {
    try {
      const deviceToken = await getDeviceToken();
      const y = await fetchYesterday(deviceToken);
      if (y && y.self_cluster_id && !(await hasSeenReveal(y.id))) {
        setYesterday(y);
        setPhase("reveal");
        return;
      }
    } catch (e) {
      console.warn("yesterday fetch failed", e);
    }
    loadQuestion();
  })();
}, [loadQuestion]);
```
Reveal only shows if ALL THREE: yesterday exists (non-404), the user answered it (`self_cluster_id` non-null), and the reveal has not already been seen (SecureStore flag). Any error in the yesterday fetch is swallowed → falls through to `loadQuestion()`.

### 2.3 loadQuestion (with 404→archive fallback)
```ts
const loadQuestion = useCallback(() => {
  // Guard against a second concurrent fetch (e.g. a fast "CHECK AGAIN" tap
  // while the boot fetch is still in flight) racing the phase state.
  if (questionInFlight.current) return;
  questionInFlight.current = true;
  setErrorMsg(null);
  setPhase("loading");
  fetchTodayQuestion()
    .then((q) => {
      setQuestion(q);
      setExploringPast(false);
      setRenderedAt(Date.now());
      setPhase("question");
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "fetch failed";
      // 404 = no live question right now. Instead of dead-ending on a "no
      // drop" screen (which left App Review unable to reach ANY user content
      // or moderation control), fall back to the most recent revealed drop so
      // the app is always interactive: the reviewer — and real users between
      // drops — can answer it, see the live wordcloud, delete their own
      // answer, and hide/report others.
      if (/\b404\b/.test(msg)) {
        fetchArchive()
          .then((page) => {
            const latest = page.tiles[0];
            if (latest) {
              setQuestion({ id: latest.question_id, text: latest.question_text });
              setExploringPast(true);
              setRenderedAt(Date.now());
              setPhase("question");
            } else {
              setPhase("no_drop");
            }
          })
          .catch(() => setPhase("no_drop"));
      } else {
        setErrorMsg(msg);
        setPhase("error");
      }
    })
    .finally(() => { questionInFlight.current = false; });
}, []);
```
The 404 detection is a regex on the thrown error message (`fetchTodayQuestion: 404`). This is the App-Review-critical fallback: 404 → latest archive tile becomes an answerable "past" question with `exploringPast = true` (shows the replay hint). Empty archive or archive fetch failure → `no_drop`.

### 2.4 Firestore live-clusters listener
```ts
useEffect(() => {
  if (!question) return;
  const q = query(
    collection(firestore(), "answer_clusters"),
    where("question_id", "==", question.id),
    orderBy("submission_count", "desc"),
    limit(100),
  );
  const unsub = onSnapshot(
    q,
    (snap) => {
      const next: Cluster[] = snap.docs.map((d) => {
        const data = d.data() as { canonical_text: string; submission_count: number };
        return { id: d.id, canonical_text: data.canonical_text, submission_count: data.submission_count };
      });
      setClusters(next);
    },
    (err) => { console.warn("clusters listener error", err); },
  );
  return () => unsub();
}, [question]);
```
- Collection: `answer_clusters`; filter `question_id ==`, order `submission_count` DESC, limit 100.
- Active during BOTH question and wordcloud phases (any time `question != null`). Listener errors are only logged, never surfaced.
- Firebase Web config (public by design): projectId `relatably-prod`, apiKey `AIzaSyDvBvtlIzCK_9TvNAmPv5l2YyV4jYsu1Fg`, appId `1:460980856315:web:db886b968a140c7dd2975e`, authDomain `relatably-prod.firebaseapp.com`, storageBucket `relatably-prod.firebasestorage.app`, messagingSenderId `460980856315`. Lazy singleton init (crashes occurred with module-load init).

### 2.5 Derived values
```ts
const totalCount = clusters.reduce((s, c) => s + c.submission_count, 0);
const topPad = insets.top + sp[5];   // safe-area top + 24
```
`totalCount` (sum of ALL cluster counts from the live listener) feeds LiveCounter and WordcloudScreen.

### 2.6 Reveal completion → interstitial → today's question
```ts
const handleRevealComplete = useCallback(async () => {
  if (yesterday) {
    await markRevealSeen(yesterday.id);
    try {
      const alreadyShown = await hasShownInterstitialFor(yesterday.id);
      if (!alreadyShown) {
        const controller = await loadInterstitialOnce();
        if (controller) {
          await controller.show();
          await markInterstitialShownFor(yesterday.id);
        }
      }
    } catch (e) { console.warn("interstitial failed", e); }
  }
  loadQuestion();
}, [yesterday, loadQuestion]);
```
Order matters: mark reveal seen FIRST (so a crash during the ad never re-shows the reveal), then at most one interstitial per question id, then load today's question. Interstitial marked shown only AFTER it was actually displayed.

### 2.7 Submit
```ts
const handleSubmit = async () => {
  if (!question) return;
  try {
    const dwellMs = Date.now() - renderedAt;
    const deviceToken = await getDeviceToken();
    const result = await submitAnswer({
      question_id: question.id,
      device_token: deviceToken,
      raw_text: text,
      dwell_ms: dwellMs,
    });
    setSelfClusterId(result.cluster_id);
    setSelfSubmissionId(result.submission_id);
    setPhase("wordcloud");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "submit failed";
    setErrorMsg(msg);
  }
};
```
- `dwell_ms` = wall-clock ms between question render (`renderedAt`) and tap; sent to server (anti-bot signal).
- `raw_text` is sent UN-trimmed (trim is only used for the enable check).
- On failure: stays in question phase, shows server `error` string (from response body `{error}`) or `submit: <status>` in red under the counter. No alert dialogs anywhere on this screen.

### 2.8 Wordcloud → delete-own-answer reset (onDeleted callback passed to WordcloudScreen)
```ts
onDeleted={() => {
  setSelfClusterId(null);
  setSelfSubmissionId(null);
  setPhase("question");
  setText("");
  setRenderedAt(Date.now());
}}
```
Resets dwell timer → user must wait another 3 s before re-submitting.

WordcloudScreen props (for cross-reference; component itself is out of scope here):
`clusters, selfClusterId, totalCount, questionId: question.id, questionText: question.text, userAnswer: text, dateLabel: new Date().toISOString().slice(0, 10)  /* "YYYY-MM-DD" UTC */, selfSubmissionId, onDeleted`.

RevealAnimation props: `questionId: yesterday.id, questionText: yesterday.text, clusters: yesterday.top_clusters, selfClusterId: yesterday.self_cluster_id, onComplete: handleRevealComplete`.

---

## 3. Screen layout per phase

Root (all phases):
```
View root { flex:1, backgroundColor cream #FFF7E8 }
├─ StatusBar style="dark" (dark content on light bg)
├─ PaperTexture (absolute-fill, pointerEvents none — see §7)
└─ phase content
```

### loading
```
View center { flex:1, alignItems:center, justifyContent:center }
└─ Text "preparing today's drop…"  { HankenGrotesk_700 16, inkSoft }
```
No spinner.

### no_drop / error (identical card, mirrored rotation)
```
View center + paddingHorizontal 22 (sp.gutter)
└─ card View — rotate -1.5deg (no_drop) / +1.5deg (error)
   { backgroundColor #FFFFFF, borderColor ink, borderWidth 3, borderRadius 22 (radii.m),
     paddingHorizontal 24, paddingVertical 24 (sp[5]), alignItems center, gap 12 (sp[3]),
     shadow.m (ink, offset 4/4, radius 0, opacity 1), maxWidth 360 }
   ├─ heading Text (h2: BagelFatOne 36/44, ink, centered)
   ├─ body Text (bodyL: HankenGrotesk_700 17/24, inkSoft, centered)
   ├─ [error only, if errorMsg] detail Text (bodyS 13, red, centered)
   └─ pill Pressable role="button" onPress=loadQuestion
      { marginTop 8 (sp[2]), paddingHorizontal 24, paddingVertical 12, borderRadius 999,
        backgroundColor pink #FF4FA3, borderColor ink, borderWidth 3,
        shadow.s (ink, offset 2/2, radius 0, opacity 1) }
      └─ label Text (SpaceGrotesk_600 13, letterSpacing 1.3, cream)
```

### question
```
View container { flex:1, paddingHorizontal 22, paddingTop = safeAreaTop + 24 }
├─ [if exploringPast] replayHint Text (bodyS 13/18, inkSoft, centered, marginBottom 12)
├─ QuestionText  — Text, lowercased, BagelFatOne 52 / lineHeight 62, ink. No margins of its own.
├─ AnswerInput   (see §4)
├─ LiveCounter   — Text centered, SpaceGrotesk_600 11, letterSpacing 1.4, inkSoft
├─ [if errorMsg] errorDetail Text (bodyS 13, red, centered)
└─ SubmitButton  (see §5) — wrapper { alignItems:center }
```
IMPORTANT: the container has NO `gap` and children have no vertical margins (except replayHint's marginBottom 12) → elements stack flush top-aligned, directly under each other. This is the literal layout; the visual breathing room comes from BagelFatOne's 62pt line height, the input's internal padding, and the button's padding. Reproduce as-is for 1:1 (VStack(spacing: 0), top-aligned).

### wordcloud
Entire screen replaced by `WordcloudScreen` (separate extraction). PaperTexture stays underneath.

---

## 4. AnswerInput (`src/components/AnswerInput.tsx`)

```
View wrap (relative)
  { backgroundColor #FFFFFF, borderColor ink, borderWidth 3, borderRadius 22 (radii.m),
    shadow.m (ink 4/4/0/1), paddingVertical 18 (sp[4]+2), paddingHorizontal 24 (sp[5]) }
├─ TextInput
│    { fontFamily HankenGrotesk_700, fontSize 17, color ink, paddingRight 28 }
│    placeholder "your take?"  placeholderTextColor rgba(26,26,26,0.45)
│    autoCapitalize="none"  autoCorrect={false}  maxLength={280}
│    multiline={false}  returnKeyType="send"
└─ peel View { position absolute, top 0, right 0 }
   └─ IconPeelCorner size=22
```
`editable` prop defaults true (never set false by HomeScreen).
Note: `returnKeyType="send"` sets the keyboard key but there is NO `onSubmitEditing` handler — pressing "send" on the keyboard does NOT submit. Reproduce (or flag as intentional-quirk).

IconPeelCorner SVG (top-right sticker peel): viewBox 0 0 24 24, `Path d="M0 0L24 0L0 24Z"` — a triangle covering the top-left half of its box — `fill = lemon2 #FFD43B` (default), `stroke = ink`, `strokeWidth 2`, `strokeLinejoin round`. Rendered at 22×22, pinned to the input's top-right corner (inside the border).

---

## 5. SubmitButton — dwell gate (verbatim, `src/components/SubmitButton.tsx`)

```ts
const MIN_DWELL_MS = 3000;

export function SubmitButton({ hasText, onPress, startedAt }: Props) {
  const [dwellMet, setDwellMet] = useState(false);
  const angle = useSharedValue(-2);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const enabled = dwellMet && hasText;

  useEffect(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= MIN_DWELL_MS) { setDwellMet(true); return; }
    const t = setTimeout(() => setDwellMet(true), MIN_DWELL_MS - elapsed);
    return () => clearTimeout(t);
  }, [startedAt]);
```
- Gate: enabled ⇔ (≥3000 ms since `startedAt`) AND (`text.trim().length > 0` — the trim happens in HomeScreen: `hasText={text.trim().length > 0}`).
- `startedAt` = `renderedAt` from HomeScreen; changes on new question load and after delete-own-answer → timer restarts.
- If `startedAt` changes and elapsed already ≥ 3000, gate opens immediately. Note: once `dwellMet` is true it is never set back to false by the effect (no reset on startedAt change) — after the first 3 s the button never re-locks within the same mount. WordcloudScreen unmounts SubmitButton, so in practice remount resets it, but a strict 1:1 port should mirror "dwellMet latches true".

Press animation (react-native-reanimated):
```ts
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ rotate: `${angle.value}deg` }, { translateX: tx.value }, { translateY: ty.value }],
}));
function handlePressIn() {
  angle.value = withTiming(0, { duration: motion.tap.duration /*120ms*/, easing: Easing.out(Easing.ease) });
  tx.value = withTiming(2, { duration: 120 });
  ty.value = withTiming(2, { duration: 120 });
}
function handlePressOut() {
  angle.value = withTiming(-2, { duration: motion.spring.duration /*200ms*/ });
  tx.value = withSequence(withTiming(0, { duration: 200 }));
  ty.value = withSequence(withTiming(0, { duration: 200 }));
}
function handlePress() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  onPress();
}
```
- Resting rotation **-2°**; on press-in it straightens to 0° and shifts +2pt right/down over 120 ms ease-out ("pressed into the shadow"); on press-out returns over 200 ms. Handlers only attached when enabled.
- Haptic: `UINotificationFeedbackGenerator` success on tap, BEFORE onPress.

Visual states:
```ts
const shadowSpec = enabled ? shadow.l : shadow.s;   // l = 6/6 offset, s = 2/2, both hard ink
// backgroundColor: enabled ? pink #FF4FA3 : cream2 #FBEED1
// opacity: enabled ? 1 : 0.92
// label color: enabled ? cream #FFF7E8 : inkSoft #4A4541
```
Button chrome: `borderColor ink, borderWidth 3, borderRadius 28 (radii.l), paddingVertical 18 (sp[4]+2), paddingHorizontal 28 (sp[5]+sp[1]), alignSelf center`. Label: BagelFatOne fontSize 22, text `DROP IT`. Accessibility: `role="button"`, `accessibilityState.disabled = !enabled`, `disabled={!enabled}`.

---

## 6. Networking contract used by this screen (`src/lib/api.ts`, `src/types/api.ts`)

Base URL: `process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"`; production = `https://relatably.vercel.app` (eas.json).
Auth: optional `authorization: Bearer <firebase id token>` header when signed in (`getIdToken()`); anonymous works for all home-flow calls.

```ts
// GET /api/questions/today  → 200 TodayQuestion { id: string; text: string }
//   non-OK throws Error(`fetchTodayQuestion: ${res.status}`)  ← the "404" regex matches this

// POST /api/submit  (json body SubmitRequest)
interface SubmitRequest  { question_id: string; device_token: string; raw_text: string; dwell_ms: number; }
interface SubmitResponse { cluster_id: string; submission_count: number; normalized_text: string; submission_id: string; }
//   non-OK: parses body JSON, throws Error(body.error ?? `submit: ${res.status}`)

// GET /api/yesterday?device_token=…  → 404 ⇒ null; else Yesterday
interface YesterdayCluster { id: string; canonical_text: string; submission_count: number; final_rank: number; final_pct_of_total: number; }
interface Yesterday { id: string; text: string; top_clusters: YesterdayCluster[]; self_cluster_id: string | null; }

// GET /api/archive[?cursor=…] → ArchivePage
interface ArchiveTile { question_id: string; question_text: string; verdict_text: string; top_clusters: string[]; created_at: string; }
interface ArchivePage { tiles: ArchiveTile[]; next_cursor: string | null; }
//   tiles[0] is the most-recent revealed drop (used by the 404 fallback)

// POST /api/devices/register  { device_token: string; fcm_token: string }  (no-op in v1.0, see §2.1)
```

---

## 7. PaperTexture background (`src/components/sticker/PaperTexture.tsx`)

Full-screen, non-interactive dotted-paper overlay on the cream background:
- SVG sized to window, **opacity 0.06**.
- Repeating pattern tile **12×12** points; each tile draws one circle at (1,1) with **r=1**, fill ink `#1A1A1A`.
- `pointerEvents="none"`, `StyleSheet.absoluteFill`.
SwiftUI: tile a 12×12 pattern of 1pt-radius ink dots at 6% opacity across the screen (Canvas or tiled Image).

---

## 8. Persistence (all `expo-secure-store` ⇒ iOS Keychain, string values)

| Key | Value | Writer/Reader |
|---|---|---|
| `relatably.device_token` | device token string | `deviceId.ts` |
| `reveal_seen_<questionId>` | `"1"` | `revealStore.ts` — checked with `v === "1"` |
| `interstitial_seen_<questionId>` | `"1"` | `interstitialGate.ts` — checked with `v === "1"` |

Device token generation (verbatim, `src/lib/deviceId.ts`):
```ts
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
i.e. identifierForVendor persisted once in Keychain (stable across reinstalls thanks to Keychain), fallback `anon-<base36 random><base36 timestamp>`.

Firebase Auth persistence uses AsyncStorage (`getReactNativePersistence(AsyncStorage)`), not Keychain.

---

## 9. Ads (`src/lib/ads.ts`) — home flow uses only the post-reveal interstitial

- **No ATT prompt ever**; `requestNonPersonalizedAdsOnly: true` on every request; `maxAdContentRating: T`. App Privacy declares "Data Not Used to Track You". (This was the fix for the 6th App Review rejection — do NOT reintroduce ATT/IDFA in the port.)
- Enabled check: `!__DEV__ || EXPO_PUBLIC_ADMOB_ENABLED === "true"` (release: always on; debug: env opt-in), cached.
- Unit IDs: prod interstitial `ca-app-pub-6563643868702361/2000809540` (app `ca-app-pub-6563643868702361~4571132569`); dev/test interstitial `ca-app-pub-3940256099942544/4411468910`; test banner `ca-app-pub-3940256099942544/2934735716`. Env overrides: `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID`, `…_LEADERBOARD_BANNER_ID`, `…_ARCHIVE_BANNER_ID`.
- `loadInterstitialOnce()`: creates the ad, races LOADED vs ERROR vs an **8000 ms timeout** (single-settle `finish` guard); returns `null` on no-fill/timeout/disabled so the caller proceeds silently. `show()` resolves when CLOSED fires; if `ad.show()` throws synchronously it resolves immediately.
- SDK init: exactly once per process (`initStarted` flag), dynamic import, failures only warned.

---

## 10. Test vectors (→ XCTest fixtures)

From `__tests__/components/SubmitButton.test.tsx`:
1. `hasText=true, startedAt=now` → immediately: disabled == true.
2. `hasText=false, startedAt=now`, advance 3500 ms → disabled == true (text gate holds).
3. `hasText=true, startedAt=now`, advance 3500 ms → disabled == false.
4. enabled + tap → onPress called exactly once.
(Boundary: gate uses `elapsed >= 3000`; 3000 ms exactly ⇒ enabled.)

From `src/components/AnswerInput.test.tsx`:
1. typing "hi" into the field with placeholder `your take?` → onChangeText("hi").
2. `editable=false` → field not editable.

Derived vectors for HomeScreen logic (from code, no RN test exists):
- `fetchTodayQuestion` rejects with message `fetchTodayQuestion: 404` → archive fallback path; message `fetchTodayQuestion: 500` → error phase with that message shown.
- `fetchYesterday` 404 → null → skip reveal. `self_cluster_id == null` → skip reveal. `hasSeenReveal(id) == true` → skip reveal.
- `totalCount` = Σ submission_count over snapshot docs; LiveCounter for 1234 renders `1,234 VOTES AND COUNTING` (en locale).
- `dateLabel` = `new Date().toISOString().slice(0,10)` — **UTC** date, not local.

---

## 11. Surprising behaviors / edge cases checklist

1. **404-fallback is App-Review-mandated**: the app must NEVER dead-end when no live question exists — it loads the newest archive question as answerable (`exploringPast` hint shown). Only an empty archive shows `no drop yet`.
2. `questionInFlight` ref prevents double-fetch races from fast CHECK AGAIN taps; SwiftUI equivalent: guard flag around the load task.
3. Reveal gating is per-question-id and persisted; reveal marked seen BEFORE the interstitial so ad crashes can't replay the reveal; interstitial capped at 1 per question id via its own key, marked AFTER successful display.
4. Error copy: submit errors render inline (red bodyS) inside the question layout without leaving the phase; network errors on load flip to the `error` card. No system alerts.
5. Card rotations: no_drop **-1.5°**, error **+1.5°**; SubmitButton rests at **-2°** and straightens on press. Hard-edged shadows (radius 0, opacity 1, ink) — these are drawn OUTSIDE the border like classic sticker offsets.
6. `QuestionText` lowercases the server text; the counter shows even at `0` (`0 VOTES AND COUNTING`) — no hiding at zero.
7. Answer `maxLength` 280; sent untrimmed; keyboard "send" key does nothing (no onSubmitEditing).
8. `dwell_ms` is sent to the server — keep the client-side 3 s gate AND the payload field.
9. `dwellMet` latches true for the lifetime of the button instance (no re-lock when `startedAt` prop changes after the gate opened); resets only via remount (wordcloud round-trip).
10. Dark-content status bar; background always cream; PaperTexture dots under every phase.
11. Firestore listener stays live during wordcloud phase (same effect keyed on `question`), so the cloud updates in real time; unsubscribe on question change/unmount.
12. Messaging is a compiled-in no-op in v1.0 (RNFB/Expo build issue) — the `registerDevice` POST never actually fires in shipped builds.
