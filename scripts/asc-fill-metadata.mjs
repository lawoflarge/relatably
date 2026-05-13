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
  reviewNotes: `RESPONSE TO PRIOR REJECTION (Submission ID 245a9f1f-e626-4232-9908-81e290f7afa4):

We have addressed every issue raised in the prior review. The resubmitted build (28+) includes all of the following:

GUIDELINE 1.2 — User Generated Content safeguards:
1. On first launch the user must tap "I AGREE" on a Terms-of-Service modal that explicitly forbids hate, harassment, sexual content involving minors, personal information about other people, and spam. Acceptance is recorded on-device.
2. Server-side two-tier content filter on every submission: a regex blocklist for slurs + Google Perspective API toxicity scoring (threshold 0.85). Blocked submissions are removed from the wordcloud and the user is shown "that won't fly. try again."
3. Every answer in the live wordcloud can be flagged: long-press the answer bubble → "Report this answer". Reports land in content_reports/ for triage.
4. After submitting, the user can immediately remove their answer from the wordcloud via "DELETE MY ANSWER" on the Today tab.
5. Blocked users: Settings → "Sign out" + the new POST /api/users/:id/block endpoint mute another user's content and remove the friendship.
6. We commit in our Terms of Service and in this submission to act on every report within 24 hours by removing the content and ejecting the offending account.
7. In-app contact: every screen reaches the new Settings tab ("ME") which exposes "Contact support" (mailto: levin.schwab@gmx.de) and "Report inappropriate content" (pre-filled email).
8. Age rating has been pushed to the most-restrictive profile available in App Store Connect (mature/suggestive themes + UGC = 17+). The iOS App Store does not currently expose an explicit "18+" tier via the API; 17+ is the highest selectable category. If a higher tier is required, please advise and we will update.

GUIDELINE 1.1 — Marketing copy scrubbed:
- The prior description contained the phrase "controversial-but-lighthearted question". This has been removed everywhere (description, promotional text, what's-new). The new copy describes only the daily-ritual gameplay; no objectionable references.

GUIDELINE 5.1.1(v) — Account deletion:
- Settings tab → "Delete account" calls the new POST /api/account/delete endpoint. The flow:
  a) confirmation alert "Delete your account?" with clear copy of what's removed
  b) on confirm: revokes Firebase Auth (Sign in with Apple unlink), deletes the user profile, leaderboard entries, friend graph, and anonymises past submissions in-place (raw_text → "[deleted]", user_id → null)
  c) signs out and shows success alert
- Screen recording on a physical device is available on request to levin.schwab@gmx.de.

HOW TO TEST AS A REVIEWER:
- Anonymous: tap I AGREE on first launch → wait for the daily question → type any answer → submit → wordcloud → optionally tap DELETE MY ANSWER or long-press any bubble → Report.
- Signed-in: tap "ME" (Settings tab) → in Friends or via the leaderboard, you can use Sign in with Apple. Once signed in, "ME" → "Delete account" exercises the new endpoint.
- If no question is live at review time, please email levin.schwab@gmx.de and we will trigger one within 5 minutes.

LINKS:
Backend: https://relatably.vercel.app
Privacy: https://relatably.vercel.app/privacy
Terms of Service: https://relatably.vercel.app/tos
Support: https://relatably.vercel.app/support`,
};

(async () => {
  console.log(`ASC metadata fill — App ${APP_ID}\n`);

  // 1. Resolve appInfo + version + their localization IDs
  const infos = await api("GET", `/v1/apps/${APP_ID}/appInfos`);
  const info = infos.body.data?.find(
    (i) => i.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION" || i.attributes?.state === "PREPARE_FOR_SUBMISSION"
  );
  if (!info) throw new Error("No editable appInfo found.");
  console.log(`appInfo: ${info.id}`);

  const versions = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  const version = versions.body.data?.find(
    (v) => v.attributes?.versionString === "1.0" && v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION"
  );
  if (!version) throw new Error("No editable v1.0 appStoreVersion found.");
  console.log(`appStoreVersion: ${version.id}`);

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
  // The declaration's ID equals the appInfo's ID. Profanity infrequent/mild +
  // suggestive infrequent/mild + UGC + no web access → 12+.
  // Attribute names + types from /v1/appInfos/{id}/ageRatingDeclaration probe.
  // ENUMs accept NONE / INFREQUENT_OR_MILD / FREQUENT_OR_INTENSE.
  // BOOLs: gambling, unrestrictedWebAccess, lootBox, messagingAndChat,
  //        userGeneratedContent, parentalControls.
  // Apple App Review rejected v1.0 (sub 245a9f1f) under Guideline 1.2 with
  // "Age rating must reflect 18+". The iOS App Store does not currently
  // surface an 18+ tier via the API; 17+ is the highest selectable category.
  // To force 17+, we set the two strongest UGC-relevant axes to
  // FREQUENT_OR_INTENSE (mature/suggestive + profanity). Combined with
  // userGeneratedContent: true this yields a 17+ rating.
  logResult(
    "PATCH ageRatingDeclaration (17+ — UGC max)",
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
        },
      },
    })
  );

  console.log("\nDone. Re-run scripts/asc-diag.mjs to verify written state.");
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
