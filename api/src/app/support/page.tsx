export const metadata = {
  title: "Support — Relatably",
  description: "Help, FAQ, and account deletion for the Relatably iOS app.",
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

const link: React.CSSProperties = {
  color: "#aaff00",
};

export default function SupportPage() {
  return (
    <div style={wrap}>
      <h1 style={h1}>Support</h1>
      <div style={sub}>Need help with Relatably? Email <a style={link} href="mailto:levin.schwab@gmx.de">levin.schwab@gmx.de</a>.</div>

      <h2 style={h2}>What is Relatably?</h2>
      <p style={p}>
        One controversial-but-lighthearted question, dropped at the same random
        moment for everyone on Earth, once per day. You type a free-text
        answer; the world&apos;s answers cluster into a live wordcloud. Tomorrow
        you&apos;ll see who guessed the #1 answer first.
      </p>

      <h2 style={h2}>I didn&apos;t get a notification today</h2>
      <p style={p}>
        Make sure notifications are enabled for Relatably in
        <i> Settings → Relatably → Notifications</i>. If you opened the app
        before the daily drop fired, you&apos;ll see &quot;come back later&quot; until the
        scheduled time.
      </p>

      <h2 style={h2}>Why can&apos;t I see yesterday&apos;s wordcloud?</h2>
      <p style={p}>
        Yesterday&apos;s reveal is gated behind submitting today&apos;s answer. This is
        deliberate — it keeps the daily ritual a daily ritual.
      </p>

      <h2 style={h2}>The leaderboard says I&apos;m not on it</h2>
      <p style={p}>
        Leaderboard scoring requires you to be signed in with Apple. Anonymous
        users still play the daily ritual but don&apos;t get scored. Tap the
        Leaderboard tab and follow &quot;Sign in to compete&quot;.
      </p>

      <h2 style={h2}>Delete my account</h2>
      <p style={p}>
        Two paths:
      </p>
      <ol style={{ marginLeft: 20, marginBottom: 12 }}>
        <li>
          <b>From your iPhone:</b> <i>Settings → Apple ID → Sign in with Apple
          → Relatably → Stop using Apple ID.</i> This revokes our access. We
          delete your signed-in identity within 30 days.
        </li>
        <li>
          <b>By email:</b> send a message to{" "}
          <a style={link} href="mailto:levin.schwab@gmx.de?subject=Delete%20my%20Relatably%20account">levin.schwab@gmx.de</a>
          {" "}with subject &quot;Delete my Relatably account&quot;. Include the email
          tied to your Apple ID. We&apos;ll confirm deletion within 7 days.
        </li>
      </ol>
      <p style={p}>
        Anonymous (not-signed-in) users have no account to delete — your random
        device ID stops being meaningful as soon as you uninstall the app.
      </p>

      <h2 style={h2}>Report inappropriate content</h2>
      <p style={p}>
        We run an automated profanity + toxicity filter on every submission.
        If you still see something that shouldn&apos;t be in the wordcloud, email
        the question text + the answer to{" "}
        <a style={link} href="mailto:levin.schwab@gmx.de?subject=Report%20content">levin.schwab@gmx.de</a>
        . We will investigate within 48 hours.
      </p>

      <h2 style={h2}>Privacy</h2>
      <p style={p}>
        Full privacy policy at{" "}
        <a style={link} href="/privacy">relatably.vercel.app/privacy</a>.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Levin Schwab<br />
        <a style={link} href="mailto:levin.schwab@gmx.de">levin.schwab@gmx.de</a><br />
        Germany
      </p>
    </div>
  );
}
