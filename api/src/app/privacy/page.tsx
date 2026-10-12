export const metadata = {
  title: "Privacy Policy — Relatably",
  description: "How Relatably collects, uses, and protects your data.",
};

const wrap: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "48px 20px 96px",
  fontFamily: "system-ui, -apple-system, Arial, sans-serif",
  color: "#ededed",
  background: "#0a0a0a",
  minHeight: "100vh",
  lineHeight: 1.55,
};

const h1: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: -0.5,
  marginBottom: 8,
};

const sub: React.CSSProperties = {
  color: "#888",
  fontSize: 14,
  marginBottom: 40,
};

const h2: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginTop: 32,
  marginBottom: 12,
};

const p: React.CSSProperties = {
  marginBottom: 12,
  fontSize: 16,
};

const ul: React.CSSProperties = {
  marginLeft: 20,
  marginBottom: 12,
};

const code: React.CSSProperties = {
  background: "#1a1a1a",
  padding: "2px 6px",
  borderRadius: 4,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 14,
};

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <div style={sub}>Effective 2026-10-11. Operator: Levin Schwab (Germany). Contact: <a style={{ color: "#aaff00" }} href="mailto:levin.schwab@gmx.de">levin.schwab@gmx.de</a>.</div>

      <p style={p}>
        Relatably is a daily one-question app. We try to collect as little as
        possible while still running the daily drop, the wordcloud, the
        leaderboard, and push notifications. This page explains exactly what
        data we touch and why.
      </p>

<h2 style={h2}>Recommendations for our other apps</h2>
<p style={p}>In Settings, the app can fetch up to three recommendations for our other apps. The choices depend on the app you are using, App Store availability and iOS compatibility, not on your personal data or activity inside the app. App icons load from Apple’s image servers. Opening a recommendation takes you to the App Store with a campaign label identifying the source app and placement, never a person.</p>
<p style={p}>We count qualified views and successful opens in aggregate. Our service stores daily counts with the source app, recommended app, placement, configuration revision and optional presentation variant. It does not store an account, advertising identifier, device identifier, persistent visitor identifier or personal profile, and it does not receive the app’s private content. These counts cannot tell us who installed an app.</p>
<p style={p}>The recommendation service is hosted by Supabase. Network requests necessarily expose an IP address to the hosting provider for delivery and security; our aggregate counter does not store it. See <a href="https://supabase.com/privacy" rel="noopener noreferrer" target="_blank">Supabase’s privacy policy</a>. Apple processes icon requests and App Store visits under <a href="https://www.apple.com/legal/privacy/" rel="noopener noreferrer" target="_blank">Apple’s privacy policy</a>.</p>

      <h2 style={h2}>1. What we collect</h2>
      <ul style={ul}>
        <li><b>Anonymous device ID</b> — a random ID generated on first launch and stored locally on your device (Expo SecureStore). The server only ever sees a SHA-256 hash of this ID. It is used to deduplicate submissions and gate the daily reveal.</li>
        <li><b>Your free-text answer</b> — what you type into today&apos;s question. We aggregate it into the wordcloud and store it in our database (Firestore).</li>
        <li><b>Submission timestamp + dwell time</b> — when you submitted and how long you spent before tapping submit. Used for anti-cheat scoring.</li>
        <li><b>IP address (hashed)</b> — used only to rate-limit submissions per IP. We never store your raw IP.</li>
        <li><b>Push token (FCM)</b> — if you grant notification permission, we store the token so the daily drop can ping you. You can revoke this in iOS settings at any time.</li>
        <li><b>Apple ID (only if you sign in)</b> — if you tap &quot;Sign in with Apple&quot; we receive a stable user identifier from Apple and an opaque email (Apple may relay it). We use this to score the leaderboard and link the friend graph. You can use Relatably entirely without signing in.</li>
        <li><b>Friend graph (only if you sign in)</b> — the user IDs of accounts you friend, plus pending friend requests.</li>
      </ul>

      <h2 style={h2}>2. What we do NOT collect</h2>
      <ul style={ul}>
        <li>No name, address, phone number, or birthday.</li>
        <li>No location.</li>
        <li>No contacts.</li>
        <li>No camera, microphone, or photo-library access.</li>
        <li>No third-party analytics SDK on the iOS client (no PostHog, no Mixpanel, no Firebase Analytics).</li>
      </ul>

      <h2 style={h2}>3. Third parties that process your data</h2>
      <ul style={ul}>
        <li><b>Google Firebase</b> (Firestore, Auth, Cloud Messaging, Remote Config) — stores submissions, the wordcloud, the friend graph, and routes push notifications. Subprocessor agreement: <a style={{ color: "#aaff00" }} href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">firebase.google.com/support/privacy</a>.</li>
        <li><b>Vercel</b> — hosts our backend; receives request metadata (URL, hashed IP, anonymous device ID hash). <a style={{ color: "#aaff00" }} href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a>.</li>
        <li><b>Sentry</b> (server-side only) — receives stack traces from our backend if it crashes. No PII attached. <a style={{ color: "#aaff00" }} href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer">sentry.io/privacy</a>.</li>
        <li><b>Google Perspective API</b> — your submitted answer text is sent to Google for toxicity scoring. Google&apos;s policy: <a style={{ color: "#aaff00" }} href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>.</li>
        <li><b>Google AdMob</b> — when ads are enabled, AdMob shows display ads using Apple&apos;s SKAdNetwork (privacy-preserving attribution). We do not pass user identifiers. <a style={{ color: "#aaff00" }} href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">policies.google.com/technologies/ads</a>.</li>
        <li><b>Branch.io</b> — used for install attribution when you tap a referral link. Branch may collect anonymous device fingerprints. <a style={{ color: "#aaff00" }} href="https://branch.io/policies/" target="_blank" rel="noopener noreferrer">branch.io/policies</a>.</li>
      </ul>

      <h2 style={h2}>4. Data retention</h2>
      <p style={p}>
        Submissions, hashed device IDs, and aggregated wordclouds are retained
        indefinitely so that the public archive of past questions stays
        readable. If you delete your account (see §6) we delete your signed-in
        identity and friend graph; we do <i>not</i> retroactively scrub your
        anonymized historical answers from the wordcloud, because they are
        already aggregated and not tied to you in any retrievable way.
      </p>

      <h2 style={h2}>5. Children</h2>
      <p style={p}>
        Relatably is rated 12+. We do not knowingly collect data from children
        under 13. Parents who believe their child has used Relatably can email
        the address above and we will delete any associated identifier.
      </p>

      <h2 style={h2}>6. Your rights (GDPR / CCPA)</h2>
      <p style={p}>
        You can request access to, rectification of, or erasure of your
        personal data by emailing <code style={code}>levin.schwab@gmx.de</code>.
        Account deletion: if you signed in with Apple, you can revoke Relatably
        in <i>Settings → Apple ID → Sign in with Apple</i> on your iPhone, OR
        email us. We will permanently delete your signed-in identity, friend
        graph, and leaderboard entries within 30 days.
      </p>

      <h2 style={h2}>7. Changes to this policy</h2>
      <p style={p}>
        We will post any changes to this URL. Material changes will be
        announced in-app at next launch.
      </p>

      <h2 style={h2}>8. Contact</h2>
      <p style={p}>
        Levin Schwab<br />
        <a style={{ color: "#aaff00" }} href="mailto:levin.schwab@gmx.de">levin.schwab@gmx.de</a><br />
        Germany
      </p>
    </div>
  );
}
