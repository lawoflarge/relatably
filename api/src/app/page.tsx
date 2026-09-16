import Image from "next/image";
import styles from "./page.module.css";

const APP_STORE_URL = "https://apps.apple.com/us/app/relatably/id6768082631?pt=128877661&ct=site_relatably&mt=8";

const DESCRIPTION =
  "Relatably asks the entire world one question at the same random moment each day. You type one free-text answer, then watch every answer on Earth cluster into a live wordcloud of the world's collective opinion in real time.";

// Single source of truth for the FAQ: rendered on the page AND emitted as
// FAQPage JSON-LD, so the two can never drift apart.
const faqs: { q: string; a: string }[] = [
  {
    q: "What is Relatably?",
    a: `Relatably is a free iOS app that asks everyone on Earth the same question at one synchronized random moment each day. Players type a single free-text answer, then watch every response cluster into a live wordcloud showing the world's collective opinion in real time. One question, one answer, once a day.`,
  },
  {
    q: "How much does Relatably cost?",
    a: `Relatably is completely free to play on iPhone. There is no subscription, no paywall, and no in-app purchase required to answer the daily question or view the global wordcloud. The app is available on the Apple App Store and requires iOS 17.0 or later.`,
  },
  {
    q: "How does the daily question work?",
    a: `Once per day, at a synchronized random moment in UTC, every Relatably user receives the same question at the same time. You get one shot to type an honest free-text answer, with no multiple choice. All answers then cluster into a Mentimeter-style live wordcloud of the world's opinion.`,
  },
  {
    q: "Do I need an account to play Relatably?",
    a: `No account is required to play the daily ritual, and you can stay anonymous and simply answer each question. Signing in with Apple is optional and unlocks the global daily, weekly, and all-time leaderboards, friending other users, and the "called it" badge for submitting the eventual number-one answer first.`,
  },
  {
    q: "Why can't I see yesterday's wordcloud?",
    a: `To see yesterday's verdict on Relatably, you first have to answer today's question. This gate is deliberate, and it keeps the app a single daily ritual instead of an endless feed. There are no streaks to grind, no XP, and no infinite scroll, just thirty seconds a day.`,
  },
  {
    q: "What data does Relatably collect?",
    a: `Relatably collects the bare minimum: an anonymous device ID, your free-text answer, and a hashed IP used only for rate-limiting. It does not collect location or contacts, and the iOS client runs no third-party analytics. The full privacy policy is available at relatably.vercel.app/privacy.`,
  },
];

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Relatably",
  operatingSystem: "iOS",
  applicationCategory: "SocialNetworkingApplication",
  url: APP_STORE_URL,
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className={styles.page}>
        <main className={styles.main}>
          <section
            data-geo-definition="relatably"
            style={{ maxWidth: 640 }}
          >
            <h1
              style={{
                color: "var(--text-primary)",
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: "-1px",
                lineHeight: 1.15,
                margin: "0 0 14px",
              }}
            >
              Relatably — one global question, once a day
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 18,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Relatably is a free iOS social app that asks everyone on Earth the
              same question at one synchronized random moment each day. You type a
              single free-text answer, then watch the world&apos;s responses
              cluster into a live wordcloud — one daily thirty-second ritual, with
              no feeds, streaks, or infinite scroll.
            </p>
            <a
              className={styles.primary}
              href={APP_STORE_URL}
              style={{ marginTop: 20 }}
            >
              Download on the App Store
            </a>
          </section>

          <Image
            className={styles.logo}
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
          <div className={styles.intro}>
            <h1>To get started, edit the page.tsx file.</h1>
            <p>
              Looking for a starting point or more instructions? Head over to{" "}
              <a
                href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                target="_blank"
                rel="noopener noreferrer"
              >
                Templates
              </a>{" "}
              or the{" "}
              <a
                href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learning
              </a>{" "}
              center.
            </p>
          </div>
          <div className={styles.ctas}>
            <a
              className={styles.primary}
              href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                className={styles.logo}
                src="/vercel.svg"
                alt="Vercel logomark"
                width={16}
                height={16}
              />
              Deploy Now
            </a>
            <a
              className={styles.secondary}
              href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>
          </div>

          <section style={{ maxWidth: 640, width: "100%" }}>
            <h2
              style={{
                color: "var(--text-primary)",
                fontSize: 22,
                fontWeight: 600,
                margin: "0 0 16px",
              }}
            >
              Frequently asked questions
            </h2>
            {faqs.map((f) => (
              <div key={f.q} style={{ marginBottom: 20 }}>
                <h3
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 16,
                    fontWeight: 600,
                    margin: "0 0 6px",
                  }}
                >
                  {f.q}
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 15,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {f.a}
                </p>
              </div>
            ))}
          </section>

          <footer
            style={{
              maxWidth: 640,
              color: "var(--text-secondary)",
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <a href={APP_STORE_URL} style={{ color: "var(--text-secondary)" }}>
              Relatably on the App Store
            </a>
            {" · "}
            <a href="/privacy" style={{ color: "var(--text-secondary)" }}>
              Privacy
            </a>
            {" · "}
            <a href="/support" style={{ color: "var(--text-secondary)" }}>
              Support
            </a>
            {" · "}
            <a href="/tos" style={{ color: "var(--text-secondary)" }}>
              Terms
            </a>
            <div>Last updated: 2026-07-23</div>
            <p style={{ padding: "1rem 1.5rem", margin: 0, fontSize: "0.875rem" }}>
              <a
                href="https://lawoflarge.app/en/apps/relatably"
                style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}
              >
                Relatably in the Law of Large app collection
              </a>
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}
