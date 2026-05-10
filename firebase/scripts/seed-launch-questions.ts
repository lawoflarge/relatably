/**
 * Seeds the 60 hand-curated Phase 6 launch questions into Firestore as
 * `status='scheduled'` documents with no `scheduled_drop_at`. The minute-cron
 * `prepareNextDrop` fills in the random drop time on its turn.
 *
 * Run ONCE against production at launch time:
 *   FIREBASE_PROJECT_ID=relatably-prod \
 *   FIREBASE_SERVICE_ACCOUNT_PATH=../../.secrets/service-account.json \
 *     pnpm seed:launch-questions
 *
 * Run against the local emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod \
 *     pnpm seed:launch-questions
 *
 * The 60 question backlog gives Relatably ~2 months of daily drops before
 * the AI-assisted candidate pipeline (admin console, Phase 5) needs to take over.
 *
 * Voice: Gen Z lighthearted (BuzzFeed / TikTok energy). All lowercase opener.
 * Free-text aggregation, so each question must have many natural cluster answers.
 * No politics, no real-world tragedy. Controversial-but-lighthearted only.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

export const LAUNCH_QUESTIONS: string[] = [
  "what's the most overrated tourist trap?",
  "what's the worst breakup line of all time?",
  "what's a movie everyone loves that you secretly hate?",
  "what's the most useless app on your phone?",
  "what's a food everyone calls disgusting that you actually love?",
  "what's a song that's secretly kind of bad?",
  "what's the worst icebreaker question of all time?",
  "what's the most boring household chore?",
  "what's a TV show ending that ruined the whole series?",
  "what's the most overrated celebrity?",
  "what's the weirdest thing you do when you're home alone?",
  "what's the worst part about being an adult?",
  "what's a snack that's better cold than hot?",
  "what's the most unnecessary kitchen gadget?",
  "what's the worst pizza topping?",
  "what's the most cringe dating app opener?",
  "what's a song that always slaps no matter what?",
  "what's the most overrated holiday?",
  "what's the worst part of going to the airport?",
  "what's the dumbest thing you've ever spent money on?",
  "what's the most pointless college class?",
  "what's a popular drink that secretly tastes like soap?",
  "what's the worst time of day?",
  "what's a luxury thing that's actually mid?",
  "what's the most overrated coffee order?",
  "what's the worst thing to be late to?",
  "what's a fictional character you'd actually want as a friend?",
  "what's the most useless superpower?",
  "what's the worst cereal of all time?",
  "what's a TikTok trend that needs to die immediately?",
  "what's the most awkward family tradition?",
  "what's a hill you'd actually die on?",
  "what's the worst kind of phone call to receive?",
  "what's a food that's only good when someone else makes it?",
  "what's the most overrated streaming service?",
  "what's the worst smell that's somehow still legal?",
  "what's a piece of clothing that's basically a red flag?",
  "what's the most annoying ringtone ever invented?",
  "what's a chore that takes 5 minutes but feels like 5 hours?",
  "what's a classic book that's actually unreadable?",
  "what's the worst thing about group projects?",
  "what's a meme that aged terribly?",
  "what's the most overrated tech billionaire?",
  "what's a small thing that ruins your whole day?",
  "what's the worst kind of weather?",
  "what's a guaranteed vibe-killer at a party?",
  "what's the most useless emoji?",
  "what's a habit you swore you'd never have but absolutely do?",
  "what's the worst word in the English language?",
  "what's a gift that secretly means 'i don't know you'?",
  "what's a trend from 2010 that aged the worst?",
  "what's the most pointless workout?",
  "what's a movie you quote way too much?",
  "what's the worst thing about big cities?",
  "what's the worst thing about small towns?",
  "what's a Netflix genre that should not exist?",
  "what's a smell that instantly takes you back to childhood?",
  "what's the worst icebreaker a teacher ever made you do?",
  "what's a trend rich people invented just to flex?",
  "what's a fictional villain you actually agree with?",
];

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId });
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_PATH is required when not running against the emulator",
      );
    }
    const credentials = JSON.parse(
      fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"),
    );
    initializeApp({ credential: cert(credentials), projectId });
  }

  const db = getFirestore();
  let seeded = 0;
  for (const text of LAUNCH_QUESTIONS) {
    const ref = db.collection("questions").doc();
    await ref.set({
      text,
      status: "scheduled",
      source: "curated_launch",
      created_at: FieldValue.serverTimestamp(),
      // scheduled_drop_at intentionally omitted; prepareNextDrop fills it in.
    });
    seeded += 1;
    console.log(`seeded ${seeded}/${LAUNCH_QUESTIONS.length}: ${ref.id} - "${text}"`);
  }
  console.log(`done. seeded ${seeded} launch questions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
