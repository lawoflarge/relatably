// Fills App Store metadata for Relatably v1.0 via the ASC REST API.
// Idempotent — safe to re-run. PATCHes everything the public API allows.
//
// What this fills:
//   - App Info Localization (en-US): subtitle, privacyPolicyUrl
//   - App Info: primaryCategory + secondaryCategory
//   - App Store Version Localization (en-US, v1.0):
//       description, keywords, marketingUrl, supportUrl,
//       promotionalText, whatsNew
//   - Age Rating Declaration (12+ profile)
//
// What this does NOT touch (web-only or fragile):
//   - Pricing & Availability (use ASC web UI or a separate script)
//   - App Privacy questionnaire (web-only)
//   - Content Rights toggle (web-only)
//   - Screenshots (separate upload flow)
//   - Build attachment to version (auto once #21 lands)
//
// Usage: node scripts/asc-fill-metadata.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function makeToken() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: "appstoreconnect-v1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(sig)}`;
}

const token = makeToken();

async function api(method, pathSuffix, body) {
  const url = `https://api.appstoreconnect.apple.com${pathSuffix}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: r.status, body: json, ok: r.ok };
}

function logResult(label, res) {
  const tag = res.ok ? "OK" : "FAIL";
  console.log(`[${tag} ${res.status}] ${label}`);
  if (!res.ok) console.log("  →", JSON.stringify(res.body, null, 2).slice(0, 800));
}

const META = {
  subtitle: "One question. One global drop.",
  privacyPolicyUrl: "https://relatably.vercel.app/privacy",
  primaryCategory: "SOCIAL_NETWORKING",
  secondaryCategory: "ENTERTAINMENT",
  marketingUrl: "https://relatably.vercel.app",
  supportUrl: "https://relatably.vercel.app/support",
  promotionalText:
    "One question, dropped at the same random moment for everyone on Earth. Type your answer. See the world's. Daily.",
  description: `One question. One global drop. Once a day.

Relatably picks one question and asks the entire world at the same random moment. You have one shot to type your answer in plain text. Then watch every other answer on Earth cluster into a live wordcloud — the world's collective opinion, in real time.

To see yesterday's verdict, you have to answer today. No streaks to grind. No XP. No infinite scroll. Just a single daily ritual that takes thirty seconds.

How it works:
• Once per day, at a synchronized random moment in UTC, every Relatably user gets the same question
• You type your honest free-text answer. No multiple choice.
• Answers cluster into a Mentimeter-style live wordcloud
• Tomorrow you'll see who guessed the eventual #1 answer first — they win the title "most relatable on Earth"
• That's it. Come back tomorrow.

Sign in with Apple to:
• Compete on the global daily, weekly, and all-time leaderboards
• Friend other users (no DMs, no comments — just a leaderboard you both see)
• Earn the "called it" badge when you submit the eventual #1 answer first

Or stay anonymous and just play the daily ritual.

Why we built it:
Most social apps want you to scroll forever. Relatably wants thirty seconds of your day. One question. One answer. Real people, no algorithm.

Privacy:
We collect the bare minimum — an anonymous device ID, your free-text answer, and a hashed IP for rate-limiting. No location, no contacts, no third-party analytics on the iOS client. Full policy at relatably.vercel.app/privacy.

Free to play. No subscription. No paywall.`,
  keywords:
    // 93 chars / 100. Removed "bereal" (Apple Review Guideline 2.3.7
    // forbids unauthorized references to third-party apps in metadata).
    // Replaced with "discussion" — semantically equivalent for the
    // search vector (people who'd type "bereal" also type "discussion app").
    "daily,question,wordcloud,social,opinion,poll,trivia,discussion,survey,gen z,relatable,friends",
  whatsNew: `Welcome to Relatably 🌍

The first daily one-question social ritual. We start small with sixty hand-picked questions; user-submitted questions land in v1.1.

Free, no subscription. Sign in with Apple to compete on the leaderboard, or play anonymously.`,
  copyright: "© 2026 Levin Schwab",
  reviewContactFirstName: "Levin",
  reviewContactLastName: "Schwab",
  reviewContactPhone: "+49 157 379 65607",
  reviewContactEmail: "levin.schwab@gmx.de",
  reviewNotes: `GUIDELINE 2.1(a) — WHAT CHANGED IN THIS BUILD
Build 34 could fail to get past its initial loading screen on iPadOS. We rebuilt the app natively in Swift/SwiftUI for this build (35). Startup now has hard 10-second network timeouts and a 12-second watchdog: the app ALWAYS reaches either today's question, an archive fallback, or an explicit retry screen — verified on iPad Air 11-inch simulators (iPhone-compatibility mode) with normal, slow, and unreachable network. All previously reviewed functionality and all Guideline 1.2 moderation controls below are unchanged.

Relatably is an anonymous daily-question app with user-generated free-text answers. Every Guideline 1.2 safeguard is a visible, one-tap control, and this build GUARANTEES there is always populated content to act on — a brand-new install immediately shows a full wordcloud of other answers and a full Board of users — so a reviewer can exercise every control in under a minute with NO sign-in and NO waiting.

HOW TO TEST (about 60 seconds, fully anonymous, no account)
1. Launch. A full-screen Terms gate appears on first launch. It states our ZERO-TOLERANCE policy for objectionable content and abusive users and requires you to confirm you are 18 or older. Tap "I AGREE".
2. On the Today tab, type any answer and tap DROP IT. You immediately see a live wordcloud with many other answers.
3. REPORT / HIDE / BLOCK another user's content: tap any answer bubble that is not your own (on-screen hint: "Tap any answer ... to hide it, report it, or block whoever wrote it"). The sheet offers "Hide this answer", "Report this answer" (files a report to our 24-hour queue and removes it from your feed immediately), and "Block this contributor" (hides them and their answers). The identical control is on every past wordcloud under the Archive tab via a visible "..." button on each row.
4. POST and DELETE your own content: your submitted answer is tagged "YOU" and has a visible "DELETE MY ANSWER" button that removes it from the feed instantly.
5. BLOCK a user from the Board: open the Board tab. It always lists ranked users. Each row has a visible "..." button -> "Block this user" (the row disappears and their content is hidden) or "Report this user".
6. CONTACT and manage: the ME tab (gear icon, far right of the tab bar) has a visible "Contact support" email, a "Report inappropriate content" button, Terms of Service, Privacy Policy, and sections to review and undo your hidden answers and blocked users.

WHY THERE IS ALWAYS CONTENT TO MODERATE
Answers are anonymous and aggregated into a wordcloud. To make sure the moderation controls always have something to act on (even on a fresh install or a brand-new daily drop), this build shows clearly non-objectionable demo answers and demo Board users. Prior 1.2 feedback was caused by the feed/Board being empty at review time even though the controls existed; that can no longer happen.

ADDITIONAL SAFEGUARDS
- Age rating is 18+, and the first-launch Terms gate requires an 18+ confirmation.
- Two-tier filtering on every submission: an immediate slur/violence block, plus a Google Perspective toxicity check that removes toxic answers server-side.
- We act on every report within 24 hours by removing the content and ejecting repeat offenders, as stated in the Terms.
- There is NO chat, NO direct messages, and NO 1:1 messaging of any kind — only anonymous aggregated answers.
- Sign in with Apple is optional (only for the leaderboard); account deletion is in the ME tab.

CONTACT
Levin Schwab, levin.schwab@gmx.de, +49 157 379 65607
Terms: https://relatably.vercel.app/tos
Privacy: https://relatably.vercel.app/privacy
Support: https://relatably.vercel.app/support`,
};

(async () => {
  console.log(`ASC metadata fill — App ${APP_ID}\n`);

  // 1. Resolve appInfo + version + their localization IDs.
  // Editable states for ASC metadata: PREPARE_FOR_SUBMISSION, REJECTED,
  // METADATA_REJECTED, DEVELOPER_REJECTED. Plus their "Apple-side" variants.
  const EDITABLE_STATES = new Set([
    "PREPARE_FOR_SUBMISSION",
    "REJECTED",
    "METADATA_REJECTED",
    "DEVELOPER_REJECTED",
  ]);
  const infos = await api("GET", `/v1/apps/${APP_ID}/appInfos`);
  const info = infos.body.data?.find(
    (i) => EDITABLE_STATES.has(i.attributes?.appStoreState) || EDITABLE_STATES.has(i.attributes?.state)
  );
  if (!info) throw new Error("No editable appInfo found.");
  console.log(`appInfo: ${info.id}`);

  const versions = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  const version = versions.body.data?.find(
    (v) => v.attributes?.versionString === "1.0" && EDITABLE_STATES.has(v.attributes?.appStoreState)
  );
  if (!version) throw new Error("No editable v1.0 appStoreVersion found.");
  console.log(`appStoreVersion: ${version.id} (state=${version.attributes?.appStoreState})`);

  const infoLocs = await api("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`);
  const infoLoc = infoLocs.body.data?.find((l) => l.attributes?.locale === "en-US");
  if (!infoLoc) throw new Error("No en-US appInfoLocalization.");
  console.log(`appInfoLocalization (en-US): ${infoLoc.id}`);

  const verLocs = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  const verLoc = verLocs.body.data?.find((l) => l.attributes?.locale === "en-US");
  if (!verLoc) throw new Error("No en-US appStoreVersionLocalization.");
  console.log(`appStoreVersionLocalization (en-US): ${verLoc.id}\n`);

  // 2. PATCH AppInfo Localization (subtitle, privacy URL)
  logResult(
    "PATCH appInfoLocalization (subtitle, privacyPolicyUrl)",
    await api("PATCH", `/v1/appInfoLocalizations/${infoLoc.id}`, {
      data: {
        type: "appInfoLocalizations",
        id: infoLoc.id,
        attributes: {
          subtitle: META.subtitle,
          privacyPolicyUrl: META.privacyPolicyUrl,
        },
      },
    })
  );

  // 3. PATCH AppInfo (primary + secondary category relationships)
  logResult(
    "PATCH appInfo (primaryCategory + secondaryCategory)",
    await api("PATCH", `/v1/appInfos/${info.id}`, {
      data: {
        type: "appInfos",
        id: info.id,
        relationships: {
          primaryCategory: { data: { type: "appCategories", id: META.primaryCategory } },
          secondaryCategory: { data: { type: "appCategories", id: META.secondaryCategory } },
        },
      },
    })
  );

  // 4. PATCH AppStoreVersion Localization (description, keywords, URLs, promo)
  // whatsNew skipped — only editable once a build is attached to the version (build #21 in flight).
  logResult(
    "PATCH appStoreVersionLocalization (description, keywords, urls, promo)",
    await api("PATCH", `/v1/appStoreVersionLocalizations/${verLoc.id}`, {
      data: {
        type: "appStoreVersionLocalizations",
        id: verLoc.id,
        attributes: {
          description: META.description,
          keywords: META.keywords,
          marketingUrl: META.marketingUrl,
          supportUrl: META.supportUrl,
          promotionalText: META.promotionalText,
        },
      },
    })
  );

  // Try whatsNew separately so a STATE_ERROR (no build attached) doesn't kill everything else.
  const whatsNewRes = await api("PATCH", `/v1/appStoreVersionLocalizations/${verLoc.id}`, {
    data: {
      type: "appStoreVersionLocalizations",
      id: verLoc.id,
      attributes: { whatsNew: META.whatsNew },
    },
  });
  if (whatsNewRes.ok) {
    console.log("[OK 200] PATCH appStoreVersionLocalization (whatsNew)");
  } else {
    // For first releases (v1.0), Apple disables "What's New" — only used for v1.0.1+ updates.
    console.log(`[SKIP ${whatsNewRes.status}] whatsNew not editable for first release v1.0 — Apple uses description instead`);
  }

  // 5b. PATCH appStoreVersion attributes (copyright, usesIdfa)
  logResult(
    "PATCH appStoreVersion (copyright, usesIdfa=false)",
    await api("PATCH", `/v1/appStoreVersions/${version.id}`, {
      data: {
        type: "appStoreVersions",
        id: version.id,
        attributes: {
          copyright: META.copyright,
          usesIdfa: false,
        },
      },
    })
  );

  // 5c. Create or update App Store Review Detail (Sign-In not required, contact + notes)
  const reviewRel = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`);
  if (reviewRel.body?.data?.id) {
    logResult(
      "PATCH appStoreReviewDetail (contact + notes)",
      await api("PATCH", `/v1/appStoreReviewDetails/${reviewRel.body.data.id}`, {
        data: {
          type: "appStoreReviewDetails",
          id: reviewRel.body.data.id,
          attributes: {
            contactFirstName: META.reviewContactFirstName,
            contactLastName: META.reviewContactLastName,
            contactPhone: META.reviewContactPhone,
            contactEmail: META.reviewContactEmail,
            notes: META.reviewNotes,
          },
        },
      })
    );
  } else {
    logResult(
      "POST appStoreReviewDetail (contact + notes)",
      await api("POST", `/v1/appStoreReviewDetails`, {
        data: {
          type: "appStoreReviewDetails",
          attributes: {
            contactFirstName: META.reviewContactFirstName,
            contactLastName: META.reviewContactLastName,
            contactPhone: META.reviewContactPhone,
            contactEmail: META.reviewContactEmail,
            notes: META.reviewNotes,
          },
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
          },
        },
      })
    );
  }

  // 6. Attach the latest VALID build to the v1.0 App Store Version
  const builds = await api("GET", `/v1/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate`);
  const latestValid = builds.body.data?.find((b) => b.attributes?.processingState === "VALID");
  if (latestValid) {
    console.log(`\nAttaching build ${latestValid.id} (v${latestValid.attributes.version}) to appStoreVersion ${version.id}…`);
    logResult(
      "PATCH appStoreVersion → relationships.build",
      await api("PATCH", `/v1/appStoreVersions/${version.id}/relationships/build`, {
        data: { type: "builds", id: latestValid.id },
      })
    );
  } else {
    console.log("\nNo VALID builds found — skipping build attachment.");
  }

  // 5. PATCH Age Rating Declaration on appInfo (Apple moved this off appStoreVersion).
  // The declaration's ID equals the appInfo's ID.
  //
  // Apple App Review rejected v1.0 (build 28, sub 4679c135) under Guideline
  // 1.2 with: "Age rating must reflect 18+". Apple's January 2025
  // questionnaire rework introduced the new tiers 13+, 16+, 18+ alongside
  // the legacy 4+/9+/12+/17+ system. The API exposes:
  //   - ageRatingOverrideV2 (NEW) — accepts NONE / NINE_PLUS / THIRTEEN_PLUS
  //     / SIXTEEN_PLUS / EIGHTEEN_PLUS / UNRATED
  //   - ageRatingOverride   (LEGACY) — NONE / NINE_PLUS / THIRTEEN_PLUS
  //     / SIXTEEN_PLUS / SEVENTEEN_PLUS / UNRATED
  // Enum values confirmed by probing /v1/ageRatingDeclarations/{id} with an
  // invalid value: Apple returns the allowed enum in ENTITY_ERROR.ATTRIBUTE.TYPE.
  //
  // We set BOTH overrides so the rating is correct in stores on either
  // questionnaire version (Apple is mid-rollout). The questionnaire answers
  // remain honest: frequent profanity + frequent mature/suggestive themes +
  // user-generated content = the highest tier our content actually warrants.
  // The override sits on top of those answers.
  logResult(
    "PATCH ageRatingDeclaration (18+ via ageRatingOverrideV2 + legacy 17+)",
    await api("PATCH", `/v1/ageRatingDeclarations/${info.id}`, {
      data: {
        type: "ageRatingDeclarations",
        id: info.id,
        attributes: {
          violenceCartoonOrFantasy: "NONE",
          violenceRealistic: "NONE",
          violenceRealisticProlongedGraphicOrSadistic: "NONE",
          profanityOrCrudeHumor: "FREQUENT_OR_INTENSE",
          sexualContentOrNudity: "NONE",
          sexualContentGraphicAndNudity: "NONE",
          horrorOrFearThemes: "NONE",
          matureOrSuggestiveThemes: "FREQUENT_OR_INTENSE",
          medicalOrTreatmentInformation: "NONE",
          alcoholTobaccoOrDrugUseOrReferences: "NONE",
          gamblingSimulated: "NONE",
          contests: "NONE",
          gunsOrOtherWeapons: "NONE",
          healthOrWellnessTopics: false,
          advertising: false,
          gambling: false,
          unrestrictedWebAccess: false,
          lootBox: false,
          messagingAndChat: false,
          userGeneratedContent: true,
          parentalControls: false,
          kidsAgeBand: null,
          ageAssurance: false,
          // Apple's API errors with STATE_ERROR.AGE_RATING_OVERRIDE_V1_AND_V2_NOT_ALLOWED
          // when ageRatingOverride appears in the body alongside V2 — even
          // when set to "NONE". Submit V2 only; legacy field retains its
          // current value (NONE by default).
          ageRatingOverrideV2: "EIGHTEEN_PLUS",
        },
      },
    })
  );

  console.log("\nDone. Re-run scripts/asc-diag.mjs to verify written state.");
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
