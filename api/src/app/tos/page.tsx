export const metadata = {
  title: "Terms of Service — Relatably",
  description: "Terms of use for Relatably, including the user-generated content policy.",
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
  margin: "0 0 12px",
  fontSize: 16,
};

const liStyle: React.CSSProperties = { margin: "6px 0" };

export default function TermsOfServicePage(): React.ReactElement {
  return (
    <main style={wrap}>
      <h1 style={h1}>Terms of Service</h1>
      <p style={sub}>Last updated: 13 May 2026</p>

      <p style={p}>
        By using Relatably (the &quot;app&quot;) you agree to these terms. If you do not agree, do not use the app.
      </p>

      <h2 style={h2}>1. The service</h2>
      <p style={p}>
        Relatably is a once-a-day question app. Each day a single question drops at a synchronized
        moment. You submit a short free-text answer; answers are clustered into a wordcloud. Sign in
        with Apple is optional and only unlocks the leaderboard and friend graph.
      </p>

      <h2 style={h2}>2. Eligibility</h2>
      <p style={p}>
        You must be 17 years of age or older to use Relatably. By using the app you confirm that you
        meet this minimum age requirement.
      </p>

      <h2 style={h2}>3. Acceptable use &mdash; zero tolerance for objectionable content</h2>
      <p style={p}>
        Relatably has zero tolerance for objectionable content or abusive users. You agree not to
        submit, share, or attempt to share content that is:
      </p>
      <ul>
        <li style={liStyle}>illegal, threatening, harassing, hateful, or defamatory;</li>
        <li style={liStyle}>sexual or pornographic, including content that sexualises minors;</li>
        <li style={liStyle}>promoting self-harm, violence, or terrorism;</li>
        <li style={liStyle}>infringing copyrights or trademarks you do not own;</li>
        <li style={liStyle}>containing personal information about other people without their consent;</li>
        <li style={liStyle}>spam, scams, or attempts to manipulate the wordcloud at scale.</li>
      </ul>
      <p style={p}>
        We reserve the right to remove any content that violates this policy and to remove
        (&quot;eject&quot;) accounts that submit it. We act on reports of objectionable content or abusive
        behaviour within 24 hours of receipt.
      </p>

      <h2 style={h2}>4. Reporting content</h2>
      <p style={p}>
        Any answer in the live wordcloud can be reported from inside the app. We review every
        report and, when we agree it violates these terms, we remove the content and disable the
        account that submitted it within 24 hours. You can also report from outside the app by
        emailing <a href="mailto:levin.schwab@gmx.de" style={{ color: "#bbb" }}>levin.schwab@gmx.de</a>.
      </p>

      <h2 style={h2}>5. Your content</h2>
      <p style={p}>
        You retain all rights to the text you submit. You grant Relatably a non-exclusive,
        worldwide, royalty-free licence to display and cluster your submission inside the daily
        wordcloud and the archive of past wordclouds. You can immediately delete your own
        submission from the wordcloud at any time using the &quot;delete my answer&quot; control on the
        question screen.
      </p>

      <h2 style={h2}>6. Account deletion</h2>
      <p style={p}>
        You can delete your account at any time from inside the app under
        Settings &rarr; Delete account. Deleting an account permanently removes your profile,
        leaderboard entries, friend graph, and revokes your Sign in with Apple link to Relatably.
        Past submissions are anonymised in-place so historical wordclouds remain accurate.
      </p>

      <h2 style={h2}>7. Disclaimer of warranties</h2>
      <p style={p}>
        Relatably is provided &quot;as is&quot;, without warranty of any kind. We do not guarantee that
        the daily drop will happen on any specific day or that the service will be uninterrupted.
      </p>

      <h2 style={h2}>8. Limitation of liability</h2>
      <p style={p}>
        To the maximum extent permitted by law, Relatably is not liable for any indirect,
        incidental, or consequential damages arising from your use of the app.
      </p>

      <h2 style={h2}>9. Changes</h2>
      <p style={p}>
        We may update these terms. The &quot;last updated&quot; date at the top of this page reflects the
        most recent change. Continued use of the app after a change constitutes acceptance.
      </p>

      <h2 style={h2}>10. Contact</h2>
      <p style={p}>
        Questions or content reports: <a href="mailto:levin.schwab@gmx.de" style={{ color: "#bbb" }}>levin.schwab@gmx.de</a>.
      </p>
    </main>
  );
}
