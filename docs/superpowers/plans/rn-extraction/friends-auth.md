# Relatably — Friends Screen + Sign in with Apple + Firebase Auth (1:1 port spec)

Source root: `/Users/levinschwab/Data/Claude/relatably/ios`
Files covered: `src/screens/FriendsScreen.tsx`, `src/components/SignInWithApple.tsx`, `src/lib/auth.ts`, `src/lib/firebase.ts`, plus direct dependencies needed for 1:1 fidelity: `src/components/FriendListRow.tsx`, `src/components/sticker/PaperTexture.tsx`, `src/theme/tokens.ts`, `src/lib/hiddenContentStore.ts`, friends-related parts of `src/lib/api.ts`, `Friendship` type from `src/types/api.ts`. Test vectors from `FriendsScreen.test.tsx`, `SignInWithApple.test.tsx`, `auth.test.ts`.

---

## 0. Design tokens (referenced throughout — `src/theme/tokens.ts`)

### palette
| token | hex |
|---|---|
| cream | `#FFF7E8` |
| cream2 | `#FBEED1` |
| ink | `#1A1A1A` |
| inkSoft | `#4A4541` |
| pink | `#FF4FA3` |
| lemon2 | `#FFD43B` |
| lemon | `#FFDF6B` |
| mint | `#7AE6C3` |
| blue | `#7BC8F6` |
| red | `#FF5A4F` |

### typography (size pt / lineHeight pt / font family)
| token | size | line | family | letterSpacing |
|---|---|---|---|---|
| hero | 52 | 62 | BagelFatOne | — |
| h1 | 40 | 48 | BagelFatOne | — |
| h2 | 36 | 44 | BagelFatOne | — |
| h3 | 22 | 28 | BagelFatOne | — |
| bodyL | 17 | 24 | HankenGrotesk_700 | — |
| body | 15 | 20 | HankenGrotesk_700 | — |
| bodyS | 13 | 18 | HankenGrotesk_700 | — |
| label | 11 | 14 | SpaceGrotesk_600 | 1.1 |
| micro | 9 | 12 | SpaceGrotesk_700 | 1.3 |

Comment in source (line-height rationale — matters for SwiftUI too):
> BagelFatOne is a tall, heavy-ascender display face. On iOS the line box is clamped to lineHeight, so a lineHeight <= fontSize clips the top of the glyphs. Display tokens therefore need headroom (~1.2x size).

### spacing `sp`
`sp[1]=4, sp[2]=8, sp[3]=12, sp[4]=16, sp[5]=24, sp[6]=32, sp[7]=48, sp[8]=64, sp.gutter=22, sp.section=24`

### radii
`s=14, m=22, l=28, xl=36, pill=999`

### shadows (hard "sticker" shadows — radius 0, opacity 1, ink-colored)
| token | color | offset (w,h) | radius | opacity |
|---|---|---|---|---|
| s | palette.ink `#1A1A1A` | (2, 2) | 0 | 1 |
| m | palette.ink | (4, 4) | 0 | 1 |
| l | palette.ink | (6, 6) | 0 | 1 |

### motion (not used on this screen but part of tokens file)
`tap {120ms ease-out}, spring {200ms damping 0.5}, wobble {4000ms range 2}, popIn {600ms overshoot 1.08 stagger 25}, reveal {700ms overshoot 1.15}, pulse {1800ms scale 1.2}`

---

## 1. User-facing strings (VERBATIM — all lowercase where written lowercase)

### FriendsScreen (`src/screens/FriendsScreen.tsx`)
| String | Where |
|---|---|
| `your people` | CTA card heading (signed-out state) |
| `sign in to see friends and compare answers.` | CTA card body (signed-out state) |
| `your friends` | List section header when `friendships.length === 0` |
| `` `your friends (${friendships.length})` `` — e.g. `your friends (3)` | List section header when count > 0 |
| `no friends yet. share your link to invite someone!` | ListEmptyComponent text |
| `couldn't accept` | Alert TITLE when acceptFriend fails |
| `could not accept request` | Alert message fallback when the caught error is not an `Error` instance |
| `sign in failed` | Alert TITLE when SIWA errors (only if message does NOT match `/canceled/i`) |
| `sign-in failed` | Alert message fallback when the caught error is not an `Error` instance |

### FriendListRow (`src/components/FriendListRow.tsx`)
| String | Where |
|---|---|
| `ACCEPT` | Accept button label (pink pill) |
| `PENDING` | Status tag when `status === "pending"` |
| `INCOMING` / `OUTGOING` | Status tag otherwise: `friendship.direction.toUpperCase()` |
| `@` + first 6 chars of `friend_user_id` | Display name fallback when `handle` is null: `` `@${friendship.friend_user_id.slice(0, 6)}` `` |
| `?` | Avatar initial fallback when no first char |
| `Cancel` | ActionSheet option index 0 (cancel) |
| `Remove from friends` | ActionSheet option index 1 |
| `Block this user` | ActionSheet option index 2 (destructive) — iOS |
| (sheet title) = `display` (the handle or @-fallback) | ActionSheet title |
| `Blocked` | Alert TITLE after successful block |
| `We won't show their content again.` | Alert message after successful block |
| `Couldn't block` | Alert TITLE on block failure |
| `Couldn't remove` | Alert TITLE on remove failure |
| `Block` | Non-iOS Alert fallback destructive button (note: differs from iOS "Block this user") |
| `Long-press to remove or block this user` | accessibilityHint on the row |

### SignInWithApple (`src/components/SignInWithApple.tsx`)
- No custom strings. The label is drawn by the native `ASAuthorizationAppleIDButton` with type SIGN_IN ("Sign in with Apple") and style BLACK. SwiftUI equivalent: `SignInWithAppleButton(.signIn)` / `ASAuthorizationAppleIDButton(type: .signIn, style: .black)`.

### auth.ts
| String | Where |
|---|---|
| `Apple Sign-in returned no identity token` | Error thrown when `credential.identityToken` is falsy |

Casing note: all Sticker-Pop UI copy is deliberately lowercase (`your people`, `couldn't accept`, `sign in failed`); FriendListRow alerts are sentence-case (`Blocked`, `Couldn't block`). Preserve exactly.

---

## 2. Numeric constants

### FriendsScreen
| Value | Applies to |
|---|---|
| `-1.5deg` | rotation of the signed-out CTA card (`transform: [{ rotate: "-1.5deg" }]`) |
| 3 | CTA card borderWidth |
| radii.m = 22 | CTA card borderRadius |
| sp[5] = 24 | CTA card paddingVertical AND paddingHorizontal |
| sp[3] = 12 | CTA card internal gap (between heading/body/spacer/button) |
| 360 | CTA card maxWidth |
| shadow.m | CTA card shadow: ink, offset (4,4), radius 0, opacity 1 |
| sp[2] = 8 | explicit spacer `<View style={{height: sp[2]}}/>` between body text and SIWA button (stacks with the 12pt gap → 20pt total visual space + gap on both sides of the spacer: effectively 12+8+12 = 32pt between body and button if gap applies around spacer — in RN `gap` applies between every child, so body→spacer 12, spacer 8 tall, spacer→button 12 ⇒ 32pt total) |
| sp.gutter = 22 | `center` container paddingHorizontal; sectionHeader + emptyText paddingHorizontal |
| `insets.top + sp[5]` (safe-area top + 24) | FlatList contentContainer paddingTop |
| 120 | FlatList contentContainer paddingBottom (clears floating tab bar) |
| sp[3] = 12 | sectionHeader paddingBottom; emptyText paddingTop |
| `large` | ActivityIndicator size (color = palette.pink) |

### FriendListRow
| Value | Applies to |
|---|---|
| sp[3] = 12 | row gap, row paddingHorizontal, row paddingVertical |
| sp[1] = 4 | row marginVertical (rows are 8pt apart stacked) |
| 2 | row borderWidth; avatar borderWidth; accept-pill borderWidth |
| radii.m = 22 | row borderRadius |
| shadow.s | row + accept pill shadow: ink, offset (2,2), radius 0, opacity 1 |
| 32 × 32, borderRadius 16 | avatar circle (mint bg, ink border) |
| 12 | avatarInitial fontSize (family BagelFatOne via typography.h3.family) |
| 15 | handle fontSize (HankenGrotesk_700), `numberOfLines={1}`, flex 1 |
| 10 / 1.3 | tag fontSize / letterSpacing (SpaceGrotesk_600 via typography.label.family) |
| 44 | accept pill minHeight (Apple tap-target minimum) |
| radii.pill = 999 | accept pill borderRadius (capsule) |
| sp[4]=16 / sp[2]=8 | accept pill paddingHorizontal / paddingVertical |
| 12 / 1 | acceptLabel fontSize / letterSpacing (HankenGrotesk_700 via typography.body.family), color palette.cream |
| 2 (index) | destructiveButtonIndex in ActionSheet; 0 = cancelButtonIndex |

### SignInWithApple
| Value | Applies to |
|---|---|
| 240 × 48 | Apple button width × height (HIG minimum is 140×30; 240×48 chosen to match the pill scale of the design) |
| 12 | cornerRadius passed to the native Apple button |
| BLACK | button style; SIGN_IN button type |
| alignSelf center | wrapper alignment |

### PaperTexture (full-screen background overlay, rendered on every state of the screen)
| Value | Applies to |
|---|---|
| 0.06 | opacity of the whole SVG dot layer |
| 12 × 12 | repeating pattern tile size (userSpaceOnUse) |
| cx=1, cy=1, r=1 | dot circle within each tile, fill = palette.ink |
| full window width/height | Rect filled with the pattern; `pointerEvents="none"`, absolute-fill |

SwiftUI port hint: a `Canvas`/tiled `Image` of a 12×12pt tile with a 1pt-radius ink dot at (1,1), opacity 0.06, `allowsHitTesting(false)`, ignoring safe area.

### firebase.ts
| Value | Applies to |
|---|---|
| `http://localhost:9099` | Auth emulator URL (only when `EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1"`) |
| `localhost`, 8080 | Firestore emulator host/port (same gate) |

---

## 3. Colors / fonts per element (summary)

| Element | bg | border | text color | font |
|---|---|---|---|---|
| Screen background (all states) | cream `#FFF7E8` | — | — | — |
| CTA card | `#FFFFFF` | ink 3pt, radius 22 | — | — |
| CTA heading "your people" | — | — | ink | BagelFatOne 36/44, centered |
| CTA body | — | — | inkSoft `#4A4541` | HankenGrotesk_700 17/24, centered |
| Loading spinner | — | — | pink `#FF4FA3` | size large |
| Section header "your friends (n)" | — | — | ink | BagelFatOne 36/44, left, padH 22, padBottom 12 |
| Empty text | — | — | inkSoft | HankenGrotesk_700 17/24, centered, padH 22, padTop 12 |
| Friend row | `#FFFFFF` | ink 2pt, radius 22 | — | — |
| Avatar | mint `#7AE6C3` | ink 2pt, circle 32 | ink | BagelFatOne 12 |
| Handle | — | — | ink | HankenGrotesk_700 15 |
| Tag (PENDING/INCOMING/OUTGOING) | — | — | inkSoft | SpaceGrotesk_600 10, ls 1.3 |
| ACCEPT pill | pink | ink 2pt, capsule | cream | HankenGrotesk_700 12, ls 1 |
| Apple button | native BLACK style | — | native white label | native, cornerRadius 12 |

---

## 4. Algorithms & state logic (verbatim TypeScript)

### 4.1 FriendsScreen state machine
Props: `{ isSignedIn: boolean }` (passed by parent tab wrapper which observes Firebase auth state).

```tsx
const [friendships, setFriendships] = useState<Friendship[]>([]);
const [loading, setLoading] = useState(true);
// Locally-tracked auth bump so the CTA re-renders to the list after sign-in
// without waiting for the parent tab wrapper to detect Firebase state change.
const [authBump, setAuthBump] = useState(0);
const effectiveSignedIn = isSignedIn || authBump > 0;

useEffect(() => {
  if (!effectiveSignedIn) {
    setLoading(false);
    return;
  }
  fetchFriends()
    .then((res) => setFriendships(res.friendships))
    .catch(() => setFriendships([]))
    .finally(() => setLoading(false));
}, [effectiveSignedIn]);

const onAccept = async (id: string) => {
  try {
    await acceptFriend(id);
    const next = await fetchFriends();
    setFriendships(next.friendships);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "could not accept request";
    Alert.alert("couldn't accept", msg);
  }
};
```

Render gates, in order:
1. `!effectiveSignedIn` → signed-out CTA card (with SIWA button).
2. `loading` → centered large pink ActivityIndicator over cream + PaperTexture.
3. else → FlatList of rows.

SIWA wiring inside the CTA:
```tsx
<SignInWithApple
  onSignedIn={() => setAuthBump((n) => n + 1)}
  onError={(err) => {
    const msg = err instanceof Error ? err.message : "sign-in failed";
    if (!/canceled/i.test(msg)) Alert.alert("sign in failed", msg);
  }}
/>
```
Key behaviors:
- `loading` starts `true`; when signed out the effect immediately sets it `false` (no spinner flash for signed-out users).
- Successful sign-in bumps `authBump` → `effectiveSignedIn` flips → effect re-runs → friends fetched. Note `loading` is NOT reset to true on the bump, but it is still `true` from mount only if user was signed in initially; after a bump from signed-out state, `loading` is already `false`, so the list renders immediately (briefly empty) while the fetch runs. Replicate this exact behavior or consciously deviate.
- Fetch failure is swallowed → empty list + empty-state text (no error alert).
- Cancel detection is a case-insensitive regex on the error MESSAGE: `/canceled/i` (matches "canceled"/"Canceled"; would NOT match British "cancelled" — expo throws `ERR_REQUEST_CANCELED` code, message typically contains "canceled").

Accept button visibility rule (per row):
```tsx
onAccept={item.direction === "incoming" && item.status === "pending" ? () => onAccept(item.id) : undefined}
```
i.e. ACCEPT pill shown ONLY for incoming+pending.

### 4.2 FriendListRow display + menu logic
```tsx
const display = friendship.handle ?? `@${friendship.friend_user_id.slice(0, 6)}`;
const initial = (friendship.handle ?? friendship.friend_user_id)[0]?.toUpperCase() ?? "?";
```
Note asymmetry: the `display` fallback prepends `@`, but the `initial` uses the raw first char of handle-or-userid (never the `@`).

Long-press menu (iOS): `ActionSheetIOS.showActionSheetWithOptions` with `options: ["Cancel", "Remove from friends", "Block this user"]`, `destructiveButtonIndex: 2`, `cancelButtonIndex: 0`, `title: display`. Callback: `index===1 → doRemove()`, `index===2 → doBlock()`.

```tsx
const doBlock = async () => {
  try {
    await blockUser(friendship.friend_user_id);
    await addBlockedUser({ user_id: friendship.friend_user_id, handle: friendship.handle ?? null });
    if (onBlocked) onBlocked(friendship);
    Alert.alert("Blocked", "We won't show their content again.");
  } catch (err) {
    Alert.alert("Couldn't block", err instanceof Error ? err.message : String(err));
  }
};

const doRemove = async () => {
  try {
    await removeFriend(friendship.id);
    if (onBlocked) onBlocked(friendship);
  } catch (err) {
    Alert.alert("Couldn't remove", err instanceof Error ? err.message : String(err));
  }
};
```
IMPORTANT: FriendsScreen does not pass `onBlocked`, so after block/remove the row is NOT removed from the visible list until the next fetch. (`onBlocked` is reused for both block and remove.) Block = server block + local persistence + alert; remove = server delete, no alert on success.

### 4.3 SignInWithApple button (component)
```tsx
const [busy, setBusy] = useState(false);
const handlePress = async () => {
  if (busy) return;          // re-entrancy guard, no visual busy state
  setBusy(true);
  try {
    const { uid } = await signInWithApple();
    onSignedIn(uid);
  } catch (err) {
    onError?.(err);
  } finally {
    setBusy(false);
  }
};
```
- iOS: renders native `AppleAuthenticationButton` (type SIGN_IN, style BLACK, cornerRadius 12, 240×48) inside a `View accessibilityRole="button"`, self-centered.
- Non-iOS/jest: empty `View testID="siwa-fallback"` (renders nothing tappable in production Android — SIWA is iOS-only in this app).
- Source comment: "Per Expo docs, style MUST NOT include backgroundColor or borderRadius" (native button draws itself).

### 4.4 SIWA → Firebase credential flow (`src/lib/auth.ts`, verbatim, complete)
```ts
import * as AppleAuthentication from "expo-apple-authentication";
import {
  OAuthProvider,
  signInWithCredential,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

export interface SignedInUser {
  uid: string;
}

export async function signInWithApple(): Promise<SignedInUser> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-in returned no identity token");
  }

  const provider = new OAuthProvider("apple.com");
  const firebaseCredential = provider.credential({
    idToken: credential.identityToken,
    rawNonce: (credential as { nonce?: string }).nonce ?? "",
  });
  const userCredential = await signInWithCredential(auth(), firebaseCredential);
  return { uid: userCredential.user.uid };
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth());
}

export async function getIdToken(): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}
```
Swift port notes:
- Scopes requested: `.fullName` and `.email`.
- Provider id `"apple.com"`; Firebase credential built from Apple `identityToken` + `rawNonce` (falls back to `""` if expo doesn't surface a nonce — see Red Flags).
- Return value to callers is ONLY the Firebase `uid`.
- `getIdToken()` never throws: returns `nil` on no user or on token-refresh failure. All authed API calls depend on it.

### 4.5 Firebase init (`src/lib/firebase.ts`, verbatim, complete)
```ts
// Public-by-design Firebase Web SDK config (every Firebase JS app exposes
// these in its bundle; security comes from Firestore Security Rules).
const firebaseConfig = {
  apiKey: "AIzaSyDvBvtlIzCK_9TvNAmPv5l2YyV4jYsu1Fg",
  authDomain: "relatably-prod.firebaseapp.com",
  projectId: "relatably-prod",
  storageBucket: "relatably-prod.firebasestorage.app",
  messagingSenderId: "460980856315",
  appId: "1:460980856315:web:db886b968a140c7dd2975e",
};

// Lazy singletons. Initialised on first use, NOT at module import.
// Doing the init at module-load time was crashing the iOS bundle when
// any error in initializeApp/initializeAuth bubbled to Hermes before
// our error boundary could catch it.
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _firestore: Firestore | null = null;

function getApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
  return _app;
}

function getAuthInstance(): Auth {
  if (_auth) return _auth;
  const app = getApp();
  try {
    _auth = initializeAuth(app, {
      persistence: getReactNativePersistence
        ? getReactNativePersistence(AsyncStorage)
        : undefined,
    });
  } catch {
    _auth = getAuth(app);
  }
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1") {
    try { connectAuthEmulator(_auth, "http://localhost:9099"); } catch { /* hot reload */ }
  }
  return _auth;
}

function getFirestoreInstance(): Firestore {
  if (_firestore) return _firestore;
  _firestore = getFirestore(getApp());
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1") {
    try { connectFirestoreEmulator(_firestore, "localhost", 8080); } catch { /* hot reload */ }
  }
  return _firestore;
}

export const firestore: () => Firestore = getFirestoreInstance;
export const auth: () => Auth = getAuthInstance;
```
Port notes:
- Uses Firebase **Web JS SDK** (not react-native-firebase). A SwiftUI port would use the native FirebaseAuth iOS SDK; the config values above map to `GoogleService-Info.plist` fields (API_KEY, PROJECT_ID `relatably-prod`, STORAGE_BUCKET, GCM_SENDER_ID `460980856315`; the `appId` shown is the **web** app id — a native port needs the iOS app id from the Firebase console).
- Auth session persistence = AsyncStorage (native SDK persists to Keychain automatically — behavioral parity is fine).
- Emulator gating: single env flag `EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1"` switches BOTH Auth (localhost:9099) and Firestore (localhost:8080).
- Everything is lazy: first call to `auth()`/`firestore()` initializes.

---

## 5. Persistence keys & stored JSON shapes

### AsyncStorage (≈ UserDefaults/file storage in Swift)
| Key | Shape | Writer |
|---|---|---|
| `ugc_hidden_clusters_v1` | `HiddenCluster[]` = `[{ "id": string, "text": string, "hidden_at": number(ms epoch) }]`, newest first (unshift) | hiddenContentStore.hideCluster |
| `ugc_blocked_users_v1` | `BlockedUser[]` = `[{ "user_id": string, "handle": string \| null, "blocked_at": number(ms epoch) }]`, newest first (unshift) | hiddenContentStore.addBlockedUser (called by FriendListRow.doBlock) |
| (Firebase auth session) | opaque Firebase Web SDK auth persistence blob under Firebase's own AsyncStorage keys | firebase.ts via getReactNativePersistence(AsyncStorage) |

hiddenContentStore semantics (relevant to blocking from this screen):
- Read: `JSON.parse`; non-array or parse error → `[]` (corruption-safe).
- Add is idempotent: if `user_id` already present, no-op (no timestamp refresh).
- New entries `unshift`ed to the FRONT.
- Deliberately AsyncStorage, NOT SecureStore/Keychain — source comment: "Keychain has a ~2KB-per-value limit on iOS that can fail for power users."

### Network API contract used by this screen (`src/lib/api.ts`)
- `BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"`
- Auth header on all friend calls: `authorization: Bearer <firebase-id-token>`; if `getIdToken()` returns null, header is simply OMITTED (request still fires and will 401).
- `GET  {BASE}/api/friends` → `{ "friendships": Friendship[] }`; non-OK throws `Error("fetchFriends: <status>")`.
- `POST {BASE}/api/friends/accept`, JSON body `{ "friendship_id": "<id>" }` → `{ "id": string, "status": string }`; non-OK throws `Error("acceptFriend: <status>")` (this message surfaces verbatim in the "couldn't accept" alert).
- `DELETE {BASE}/api/friends/{friendshipId}` (URL-encoded) → 200, no body used; non-OK throws `Error("removeFriend: <status>")`.
- `POST {BASE}/api/users/{targetUserId}/block` (URL-encoded) → 200; non-OK throws `Error("blockUser failed: <status>")`.
- `POST {BASE}/api/friends/request`, body `{ "target_user_id": "<uid>" }` → `{ id, status }` (not called from this screen, listed for completeness).

### Friendship type (`src/types/api.ts` lines 48–55, verbatim)
```ts
export interface Friendship {
  id: string;
  friend_user_id: string;
  handle: string | null;
  locale: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
}
```

---

## 6. Component tree / layout per state

Screen prop: `isSignedIn: boolean` (from parent tab wrapper observing Firebase auth).

### State A — signed out (CTA)
```
View (flex 1, bg cream #FFF7E8, alignItems center, justifyContent center, paddingHorizontal 22)
├─ PaperTexture (absolute-fill dot grid, opacity 0.06, non-interactive)
└─ View "ctaCard" (bg #FFFFFF, border ink 3pt, radius 22, padV 24, padH 24,
   │              alignItems center, child gap 12, shadow ink (4,4) r0 o1,
   │              maxWidth 360, rotated -1.5°)
   ├─ Text "your people"        (BagelFatOne 36/44, ink, centered)
   ├─ Text "sign in to see friends and compare answers." (HankenGrotesk_700 17/24, inkSoft, centered)
   ├─ View spacer height 8
   └─ SignInWithApple
      └─ View (alignSelf center, accessibilityRole button)
         └─ native Apple SIGN_IN button, BLACK, cornerRadius 12, 240×48
```

### State B — signed in, loading
```
View (same "center" container as A, bg cream)
├─ PaperTexture
└─ ActivityIndicator (size large, color pink #FF4FA3)
```

### State C — signed in, loaded
```
View (flex 1, bg cream)
├─ PaperTexture
└─ FlatList (flex 1, bg cream)
   contentContainer: paddingTop = safeAreaTop + 24, paddingBottom 120
   ├─ Header: Text "your friends" | "your friends (N)"
   │          (BagelFatOne 36/44, ink, padH 22, padBottom 12, left-aligned)
   ├─ Rows: FriendListRow per friendship (key = friendship.id)
   │  └─ Pressable row (horizontal, alignItems center, gap 12,
   │     │  bg #FFFFFF, border ink 2pt, radius 22, pad 12, marginV 4,
   │     │  shadow ink (2,2) r0 o1, longPress → action sheet)
   │     ├─ avatar: 32×32 circle, mint bg, ink 2pt border, centered
   │     │  └─ Text initial (BagelFatOne 12, ink, uppercased)
   │     ├─ Text handle/display (HankenGrotesk_700 15, ink, flex 1, 1 line)
   │     ├─ Text tag "PENDING"/"INCOMING"/"OUTGOING" (SpaceGrotesk_600 10, ls 1.3, inkSoft)
   │     └─ [only incoming+pending] Pressable ACCEPT pill
   │        (pink bg, ink 2pt border, capsule, minH 44, padH 16, padV 8, shadow (2,2))
   │        └─ Text "ACCEPT" (HankenGrotesk_700 12, ls 1, cream)
   └─ Empty: Text "no friends yet. share your link to invite someone!"
             (HankenGrotesk_700 17/24, inkSoft, centered, padH 22, padTop 12)
```
Notes:
- No FlatList horizontal padding at the list level — rows own no horizontal margin either, so rows span full width minus nothing; header/empty text carry their own padH 22. Rows have padH 12 internally. (Rows really are edge-to-edge; their hard shadow (2,2) extends right/down.)
- List rows are NOT tappable except long-press (menu) and the ACCEPT pill.
- No pull-to-refresh, no pagination.

---

## 7. Surprising behaviors & edge cases (port checklist)

1. **`authBump` double-source-of-truth**: screen flips to signed-in immediately on SIWA success via local counter, without waiting for the parent's Firebase listener. Once `authBump > 0`, the screen stays "signed in" even if `isSignedIn` prop stays false. After bump, `loading` is already false → list shows empty state momentarily while fetch is in flight.
2. **Cancel suppression is regex-on-message**: `/canceled/i` against `err.message`. Non-Error rejections become the string `"sign-in failed"` which doesn't match → alert shows. If expo's cancel error ever says "cancelled" (double-l) the alert would wrongly show. In Swift, match on `ASAuthorizationError.canceled` instead, but preserve "no alert on user cancel; alert titled `sign in failed` otherwise".
3. **Fetch errors are silent**: `fetchFriends` failure → `friendships = []` → empty-state copy shown; user cannot distinguish "no friends" from "network error". Intentional (1:1 port keeps it).
4. **Accept flow refetches the whole list** (`acceptFriend` then `fetchFriends`) rather than patching the row. Race: the test expects the row to disappear if the refetch returns `[]`.
5. **`onBlocked` not wired** by FriendsScreen → blocked/removed rows stay visible until next screen load. Block still persists locally (`ugc_blocked_users_v1`) and server-side.
6. **Block ≠ remove**: "Block this user" does NOT delete the friendship row server-side (only `/users/:id/block` + local list); "Remove from friends" DELETEs the friendship, no success alert.
7. **Empty-token requests**: `authHeaders()` silently omits `authorization` when there is no user or the token refresh fails → API returns 401 → generic thrown error message like `fetchFriends: 401`, which on this screen is swallowed (see 3) but in `onAccept` would alert `couldn't accept / acceptFriend: 401`.
8. **rawNonce fallback `""`**: expo's credential may not include `nonce`; code passes empty string to Firebase. Works because the Apple ID token was requested WITHOUT a nonce. In native Swift, standard practice is generating a SHA256 nonce and passing it in the request — Firebase iOS SDK REQUIRES a nonce for `OAuthProvider.appleCredential`. You cannot copy the "" behavior 1:1 with the native SDK; generate a random nonce, pass its SHA256 to `ASAuthorizationAppleIDRequest.nonce`, and the raw nonce to Firebase. (Behavioral outcome identical; mechanism necessarily differs.)
9. **Lazy Firebase init** was a crash fix: never initialize Firebase at static-init time; first access wins. Emulator connect wrapped in try/catch because hot reload re-connects throw.
10. **initializeAuth try/catch fallback**: if `initializeAuth` throws (already initialized), falls back to `getAuth(app)`. Native SDK: not applicable.
11. **Platform fork in FriendListRow menu**: iOS uses ActionSheetIOS (options exactly `["Cancel", "Remove from friends", "Block this user"]`, destructive index 2); other platforms use a 3-button Alert where the destructive button is labelled just `Block`. Port only needs the iOS branch (confirmation dialog / `confirmationDialog` in SwiftUI titled with the display name).
12. **Apple HIG constraint** (source comment): the SIWA button must be the official Apple button (Guideline 4). SwiftUI: `SignInWithAppleButton` with `.signInWithAppleButtonStyle(.black)`, frame 240×48, cornerRadius 12.
13. **Busy guard has no visual state**: while a sign-in is in flight, further taps are ignored but the button does not dim/spin.
14. **Rotation**: the CTA card's -1.5° rotation is part of the "sticker" look; shadow rotates with it (RN transform applies to shadow too — in SwiftUI apply `.rotationEffect` to the whole card including its shadow).
15. **paddingBottom 120** on list content exists to clear a floating tab bar; keep it or match your tab bar height.
16. **Section header count**: header omits "(0)" — plain `your friends` when empty, with the empty-state line below it.

---

## 8. Test vectors (from *.test.tsx / *.test.ts → XCTest fixtures)

### FriendsScreen.test.tsx
| # | Setup / Input | Expected |
|---|---|---|
| 1 | `isSignedIn=false` | View contains text matching `/sign in/i` (the CTA body "sign in to see friends and compare answers.") |
| 2 | `isSignedIn=true`; fetchFriends → `{friendships:[{id:"f1", friend_user_id:"u-2", handle:"alice", locale:"en", status:"accepted", direction:"outgoing"}]}` | text `alice` appears |
| 3 | `isSignedIn=true`; first fetchFriends → `[{id:"f2", friend_user_id:"u-3", handle:"bob", locale:"de", status:"pending", direction:"incoming"}]`; press `ACCEPT` | `acceptFriend` called with `"f2"`; second fetchFriends returns `[]` (list refreshes to empty) |

### SignInWithApple.test.tsx
| # | Input | Expected |
|---|---|---|
| 1 | Platform iOS, render | native Apple button present |
| 2 | signInWithApple resolves `{uid:"user-z"}`; tap | `onSignedIn("user-z")` called |
| 3 | signInWithApple rejects `Error("user-cancelled")`; tap | `onError` called (note: at the FriendsScreen level, "user-cancelled" does NOT match `/canceled/i` — double-l — so it WOULD alert; the component itself always forwards) |

### auth.test.ts
| # | Input | Expected |
|---|---|---|
| 1 | Apple signIn resolves `{identityToken:"apple-id-token-xyz", nonce:"the-nonce", user:"apple-user-id"}`; Firebase signInWithCredential resolves `{user:{uid:"firebase-uid-1"}}` | provider `"apple.com"` credential built with exactly `{idToken:"apple-id-token-xyz", rawNonce:"the-nonce"}`; result `{uid:"firebase-uid-1"}` |
| 2 | Apple signIn resolves `{identityToken:null, nonce:"n"}` | `signInWithApple()` throws (message `Apple Sign-in returned no identity token`) |
| 3 | currentUser.getIdToken resolves `"firebase-id-token-abc"` | `getIdToken()` → `"firebase-id-token-abc"` |
| 4 | `signOut()` | Firebase signOut invoked on the auth instance |

### Derived (untested but deterministic) fixtures for FriendListRow
| Input `friendship` | display | initial | tag | ACCEPT shown (when parent passes handler per rule) |
|---|---|---|---|---|
| `{handle:"alice", friend_user_id:"u-2", status:"accepted", direction:"outgoing"}` | `alice` | `A` | `OUTGOING` | no |
| `{handle:null, friend_user_id:"abcdef1234", status:"pending", direction:"incoming"}` | `@abcdef` | `A` | `PENDING` | yes |
| `{handle:"bob", ...status:"pending", direction:"outgoing"}` | `bob` | `B` | `PENDING` | no (outgoing) |
