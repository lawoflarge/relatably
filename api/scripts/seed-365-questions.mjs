// Seeds 365 curated questions into Firestore as `status='scheduled'` docs with
// no `scheduled_drop_at`. `prepareNextDrop` assigns the random drop time on its
// daily turn, one question per day — roughly a year of runway.
//
// Written 2026-08-02, after /api/cron/prepare-next-drop answered
// {"ok":true,"scheduled":null}: the 60-question launch pool from
// firebase/scripts/seed-launch-questions.ts had run dry.
//
// Voice, inherited from that launch set and deliberately unchanged: Gen Z
// lighthearted (BuzzFeed / TikTok energy), all-lowercase opener. No politics,
// no real-world tragedy. Controversial-but-lighthearted only.
//
// The functional constraint matters more than the voice. Answers are free text
// and get aggregated into a wordcloud, so every question needs a SMALL set of
// popular answers that many people reach independently. "what's the worst pizza
// topping?" clusters (pineapple, anchovies). "what's your favourite memory?"
// does not — it yields thousands of singletons and renders an empty cloud.
// Every entry below was picked against that test, and 14 candidates were cut
// for failing it.
//
// Validate without credentials or network:
//   node scripts/seed-365-questions.mjs --dry-run
//
// Seed (creds come from a Vercel-style env file, same as clear-cron-bucket.mjs):
//   cd api && vercel env pull /tmp/.relatably-env --environment production
//   ENV_FILE=/tmp/.relatably-env node scripts/seed-365-questions.mjs
import fb from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

export const QUESTIONS_365 = [
  "what's the worst thing to put on a burger?",
  "which fast food chain is the most overrated?",
  "what's a vegetable that's beyond saving?",
  "what's the worst candy to get on halloween?",
  "what's a drink that's only good in summer?",
  "which breakfast food is genuinely the best?",
  "what's the most disappointing dessert?",
  "what condiment do people use way too much of?",
  "what's the worst thing to bring to a potluck?",
  "which fruit is the most annoying to eat?",
  "what's a food that looks way better than it tastes?",
  "what's the most overrated snack?",
  "which pasta shape is objectively superior?",
  "what's the worst flavour of chips?",
  "what's a food you refused as a kid and love now?",
  "which ice cream flavour is a red flag?",
  "what's the most overrated restaurant chain?",
  "what food is always better as leftovers?",
  "what's the worst thing about eating out?",
  "which cuisine is the hardest to cook badly?",
  "what's a topping that ruins a salad?",
  "what's the most useless thing on a menu?",
  "which fizzy drink is the worst?",
  "what's a food that's impossible to eat gracefully?",
  "what's the best food to eat at 3am?",
  "what's a sandwich ingredient people get wrong?",
  "which cheese is overrated?",
  "what's the worst thing to microwave at work?",
  "what's a breakfast cereal that's basically dessert?",
  "which pizza chain deserves more respect?",
  "what's the most divisive holiday dish?",
  "what's a drink order that says too much about a person?",
  "what food do people ruin by overcooking?",
  "what's the worst thing to find in your food?",
  "which kitchen smell is the worst?",
  "what's a kitchen tool you use every single day?",
  "what's the most overrated health food?",
  "what's a meal that's better as a snack?",
  "what's a movie sequel that should never have happened?",
  "which movie genre is the most overrated?",
  "what's a film everyone says is deep but isn't?",
  "which actor is in way too many films?",
  "what's the worst movie trope?",
  "what tv character was written to be liked but isn't?",
  "what's a show that got worse after season one?",
  "which film has the worst ending?",
  "what's a film you'd never watch twice?",
  "what's the most annoying thing in a cinema?",
  "what's a childhood film that's actually terrifying?",
  "which superhero is the most boring?",
  "what's the worst part of a cinema trip?",
  "what's a film line everyone misquotes?",
  "what's a remake that was pointless?",
  "what's the most unrealistic thing in films?",
  "what's a tv format that's the same on every channel?",
  "what's a show everyone recommends that's mid?",
  "what's the worst reality show concept?",
  "which fictional job looks fun but would be awful?",
  "what's a plot twist you saw coming instantly?",
  "what's the most overused film soundtrack song?",
  "which animated film made you cry hardest?",
  "what's a horror cliché that needs to stop?",
  "what's a cartoon that hits different as an adult?",
  "which sitcom character would be unbearable in real life?",
  "what's the worst thing about binge-watching?",
  "what film is way too long?",
  "what's a book-to-film adaptation that failed?",
  "what's a documentary topic nobody needed?",
  "what's a song that's ruined by its music video?",
  "which music genre do people pretend to like?",
  "what's the worst song to have stuck in your head?",
  "what's an album everyone praises that's boring?",
  "which instrument is the most annoying to hear practised?",
  "what's a song that was everywhere for one summer?",
  "what's the worst karaoke song choice?",
  "which artist is carried entirely by one song?",
  "what's a song that instantly ages you?",
  "what's the most overplayed wedding song?",
  "which concert behaviour should be banned?",
  "what's a lyric that makes no sense?",
  "what's the worst thing about music festivals?",
  "which decade had the worst music?",
  "what song do people always get the words wrong to?",
  "what's a band name that's genuinely terrible?",
  "which cover is better than the original?",
  "what's a genre that's better live than recorded?",
  "what's the worst part of going to a gig?",
  "what's a song that's physically impossible to sing?",
  "what's the most annoying type of instagram post?",
  "which app is the biggest time sink?",
  "what's an internet trend that got old fastest?",
  "what's the worst kind of youtube video?",
  "which emoji do people misuse the most?",
  "what's the most annoying notification?",
  "what's a phrase that ruins any comment section?",
  "which app has the worst redesign of all time?",
  "what's the worst thing about group chats?",
  "what's an online argument nobody ever wins?",
  "what's the most annoying thing influencers do?",
  "what's a password rule that makes no sense?",
  "what's the worst website design choice?",
  "which platform has the worst comment section?",
  "what's the most useless smartphone feature?",
  "what's a tech term people use wrong?",
  "what's the worst thing about online shopping?",
  "what's an ad format that makes you close the tab?",
  "which subscription is hardest to cancel?",
  "what's the most annoying autocorrect fail?",
  "what's a username style that instantly dates someone?",
  "what's the worst thing about video calls?",
  "what's a meme format that overstayed its welcome?",
  "what's the most pointless smart home device?",
  "what's an email phrase that means the opposite?",
  "what's the worst thing about wifi?",
  "what's a notification sound that gives you anxiety?",
  "what's the most annoying loading screen?",
  "what's a website that was better ten years ago?",
  "what's the worst thing about phone batteries?",
  "what's a setting everyone changes immediately?",
  "what's the most useless charging cable?",
  "what's the worst school subject?",
  "what's a teacher habit that drove you insane?",
  "what's the most useless thing you learned at school?",
  "what's the worst part of exam season?",
  "which school lunch was genuinely good?",
  "what's the worst part of a school assembly?",
  "what's a school rule that made no sense?",
  "what's the worst time for a class to start?",
  "what's a subject that should be taught but isn't?",
  "what's the worst part about presentations?",
  "what's the most annoying type of classmate?",
  "what's the worst school trip destination?",
  "what's the most pointless homework type?",
  "what's the worst thing about student housing?",
  "what's a study method that never works?",
  "what's the most overrated degree?",
  "what's the worst part of the first day of school?",
  "what's a club that's secretly brutal?",
  "what's the most useless meeting type?",
  "what's the worst office snack situation?",
  "what's a work phrase that means nothing?",
  "what's the worst part of monday?",
  "what's the most annoying coworker habit?",
  "what's the worst job interview question?",
  "what's the most overrated job perk?",
  "what's the worst thing about open plan offices?",
  "what's an email sign-off that's passive aggressive?",
  "what's the worst shift to work?",
  "what's a job that looks easy but isn't?",
  "what's the most dreaded work task?",
  "what's the worst part of working from home?",
  "what's a job title nobody understands?",
  "what's the most annoying thing about printers?",
  "what's the worst team building activity?",
  "what's the most useless piece of office equipment?",
  "what's a workplace rule everyone ignores?",
  "what's the worst thing about commuting?",
  "what's the worst kind of customer?",
  "what's a first job everyone should have?",
  "what's the worst part of quitting a job?",
  "what's the most overrated career advice?",
  "what's the worst thing about your first week anywhere?",
  "what's a work perk that should be standard?",
  "what's the biggest red flag on a first date?",
  "what's the worst place for a first date?",
  "what's a green flag people underrate?",
  "what's the worst thing to text after a date?",
  "what's the most overrated romantic gesture?",
  "what's a dealbreaker that seems petty but isn't?",
  "what's a dating app photo cliché?",
  "what's the most awkward part of dating apps?",
  "what's a couple habit that's genuinely annoying?",
  "what's the worst anniversary gift?",
  "what's an argument every couple has?",
  "what's the worst thing about long distance?",
  "what's a pet name that should be retired?",
  "what's the most unromantic place to be proposed to?",
  "what's the worst wedding tradition?",
  "what's the most overrated love song?",
  "what's a lie everyone tells on dating profiles?",
  "what's the worst thing to bring up on date one?",
  "what's a small gesture that means the most?",
  "what's the worst place to have a serious talk?",
  "what's the most awkward thing about meeting the parents?",
  "what's a compliment that lands wrong?",
  "what's the worst thing about being single at a wedding?",
  "what's a couple photo pose that needs to stop?",
  "what's the most overrated date night idea?",
  "what's the most annoying thing siblings do?",
  "what's a family argument that never ends?",
  "what's the worst chore to be assigned?",
  "what's a parent phrase everyone heard?",
  "what's the worst thing about family holidays?",
  "what's a household item everyone loses?",
  "what's the worst room to clean?",
  "what's the most satisfying thing to clean?",
  "what's the worst part of moving house?",
  "what's a home smell that means someone's cooking?",
  "what's the most annoying household sound?",
  "what's the worst piece of furniture to assemble?",
  "what's the most chaotic part of the morning routine?",
  "what's the worst thing about sharing a bathroom?",
  "what's the most useless drawer in the house?",
  "what's the worst thing to run out of?",
  "what's the most annoying thing about laundry?",
  "what's the worst thing about having guests?",
  "what's a family tradition worth keeping?",
  "what's the most cursed piece of home decor?",
  "what's a room that's always messy?",
  "what's the worst seat on a plane?",
  "what's the most stressful part of travelling?",
  "what's a travel item everyone overpacks?",
  "what's the worst thing about public transport?",
  "what's the most overrated city to visit?",
  "what's the worst part of a road trip?",
  "what's a tourist behaviour that's embarrassing?",
  "what's the most annoying thing plane passengers do?",
  "what's the worst hotel room feature?",
  "what's the most useless souvenir?",
  "what's the worst part of a long train ride?",
  "what's a travel rule everyone breaks?",
  "what's the most annoying thing about driving?",
  "what's the worst kind of driver?",
  "what's the most overrated beach destination?",
  "what's the worst thing about camping?",
  "what's a packing mistake everyone makes?",
  "what's the worst part of jet lag?",
  "what's the most overrated landmark?",
  "what's the worst thing about renting a car?",
  "what's a travel snack that never fails?",
  "what's the worst part of border control?",
  "what's the most annoying hotel policy?",
  "what's the best part of coming home?",
  "what's the most overpriced everyday item?",
  "what's a purchase that felt smart and wasn't?",
  "what's the worst thing to cheap out on?",
  "what's a subscription nobody needs?",
  "what's the most useless thing you own?",
  "what's the worst shopping experience?",
  "what's an item that's worth every cent?",
  "what's the most overrated luxury brand?",
  "what's the worst thing about sales season?",
  "what's a hidden fee that should be illegal?",
  "what's the most pointless warranty?",
  "what's the worst thing about self-checkout?",
  "what's an impulse buy everyone makes?",
  "what's the most overrated gadget?",
  "what's a gift that's always a safe bet?",
  "what's a shop layout designed to trap you?",
  "what's the most annoying packaging?",
  "what's the worst thing about returns?",
  "what's a cheap thing that changed your life?",
  "what's a small luxury worth the money?",
  "what's a clothing item that's never comfortable?",
  "what's the most overrated shoe brand?",
  "what's a hairstyle that should stay in the past?",
  "what's the worst thing to wear in summer?",
  "what's an accessory that's always too much?",
  "what's the most impractical piece of clothing?",
  "what's a colour combination that never works?",
  "what's the worst thing about shopping for jeans?",
  "what's a fashion rule worth breaking?",
  "what's the most uncomfortable formal wear?",
  "what's a trend that came back too soon?",
  "what's the worst thing about winter clothing?",
  "what's an outfit that's basically a personality?",
  "what's the most overrated fabric?",
  "what's the most boring sport to watch?",
  "what's the worst gym behaviour?",
  "what's the hardest exercise to do properly?",
  "what's the worst part of running?",
  "what's a sport that's harder than it looks?",
  "what's the most pointless piece of gym equipment?",
  "what's the worst thing about team sports?",
  "what's the most annoying thing about swimming pools?",
  "what's the worst weather to exercise in?",
  "what's a fitness trend that made no sense?",
  "what's the hardest part of starting a workout habit?",
  "what's the worst part of losing?",
  "what's a sport that should be in the olympics?",
  "what's the most exhausting everyday activity?",
  "what's the best excuse to skip the gym?",
  "what's the most overrated pet?",
  "what's the worst thing about owning a dog?",
  "what's an animal that's way scarier than people think?",
  "what's the most annoying bird?",
  "what's a pet name that's overused?",
  "what's the worst animal to have as a neighbour?",
  "what's the most underrated animal?",
  "what's the worst thing about cats?",
  "what's an insect that serves no purpose?",
  "what's the cutest baby animal?",
  "what's the most dramatic animal?",
  "what's an animal that would be a terrible pet?",
  "what's a toy that every kid had?",
  "what's the worst part of being a kid?",
  "what's a childhood snack that disappeared?",
  "what's a game everyone played at break?",
  "what's a cartoon theme song you still know?",
  "what's the worst childhood haircut?",
  "what's a childhood fear that made no sense?",
  "what's a phrase kids don't say anymore?",
  "what's a birthday party staple?",
  "what's the worst thing about school holidays ending?",
  "what's a smell that means summer?",
  "what's a childhood injury everyone got?",
  "what's the best thing about being a kid?",
  "what's a toy that was secretly dangerous?",
  "what's a lie every kid was told?",
  "what's the worst part of long car trips as a kid?",
  "what's a childhood show that doesn't hold up?",
  "what's a habit that's impossible to break?",
  "what's a small thing that instantly improves your mood?",
  "what's the most irrational thing you're afraid of?",
  "what's a superstition you secretly follow?",
  "what's a sound that makes your skin crawl?",
  "what's the worst thing about mornings?",
  "what's a thing everyone does but won't admit?",
  "what's the worst time to get a good idea?",
  "what's a chore that's oddly satisfying?",
  "what's the most procrastinated task?",
  "what's a habit that looks weird but works?",
  "what's the worst thing about being tired?",
  "what's a thing you always forget?",
  "what's an excuse everyone uses?",
  "what's the most satisfying everyday sound?",
  "what's a smell that's weirdly comforting?",
  "what's the worst thing about waiting?",
  "what's the worst small talk topic?",
  "what's the hardest part of leaving a party?",
  "what's a social rule everyone silently agrees on?",
  "what's the worst thing about running into someone?",
  "what's the most uncomfortable seating arrangement?",
  "what's the worst kind of party guest?",
  "what's an unwritten rule of lifts?",
  "what's the most awkward goodbye?",
  "what's the worst thing about birthdays as an adult?",
  "what's a compliment that's hard to accept?",
  "what's the worst thing about being the new person?",
  "what's the most awkward thing about queues?",
  "what's a phrase that ends a conversation instantly?",
  "what's the worst thing about group photos?",
  "what's the most stressful part of hosting?",
  "what's a talent you wish you had?",
  "what's the most useless world record?",
  "what's a job that shouldn't exist?",
  "what's the worst thing about winter?",
  "what's the best thing about rain?",
  "what's a smell that should be a candle but isn't?",
  "what's the most overrated season?",
  "what's a word that sounds fake but isn't?",
  "what's the worst name for a pet?",
  "what's the most useless invention?",
  "what's a thing that's better in theory?",
  "what's the worst thing to lose?",
  "what's an everyday task that should be easier?",
  "what's a board game that ends friendships?",
  "what's the most annoying thing about public toilets?",
  "what's the worst day of the week?",
  "what's a colour that's weirdly hard to describe?",
  "what's the most pointless piece of paperwork?",
  "what's a number that feels lucky?",
  "what's the worst thing about summer?",
  "what's the most overrated form of self-care?",
  "what's a thing people collect for no reason?",
];

const LAUNCH_PATH = path.resolve(
  import.meta.dirname,
  "../../firebase/scripts/seed-launch-questions.ts",
);

/** Pull the launch question strings out of the TS source, for overlap checks. */
function launchQuestions() {
  const src = fs.readFileSync(LAUNCH_PATH, "utf8");
  const body = src.split("export const LAUNCH_QUESTIONS: string[] = [")[1].split("\n];")[0];
  return [...body.matchAll(/^\s*"((?:[^"\\]|\\.)*)",\s*$/gm)].map((m) => m[1]);
}

function validate() {
  const problems = [];

  const seen = new Map();
  for (const [i, q] of QUESTIONS_365.entries()) {
    const key = q.trim().toLowerCase();
    if (seen.has(key)) problems.push(`duplicate: "${q}" (#${seen.get(key)} and #${i})`);
    else seen.set(key, i);
  }

  const launch = new Set(launchQuestions().map((q) => q.trim().toLowerCase()));
  for (const q of QUESTIONS_365) {
    if (launch.has(q.trim().toLowerCase())) problems.push(`already in launch set: "${q}"`);
  }

  for (const q of QUESTIONS_365) {
    if (q[0] !== q[0].toLowerCase()) problems.push(`not lowercase: "${q}"`);
    if (!q.trimEnd().endsWith("?")) problems.push(`not a question: "${q}"`);
  }

  if (QUESTIONS_365.length !== 365) {
    problems.push(`expected 365 questions, got ${QUESTIONS_365.length}`);
  }

  console.log(`count: ${QUESTIONS_365.length}, launch set: ${launch.size}`);
  problems.forEach((p) => console.error(`  ! ${p}`));
  if (problems.length) throw new Error(`${problems.length} validation problem(s); refusing to seed`);
  console.log("validation OK");
}

/**
 * Vercel writes FIREBASE_SERVICE_ACCOUNT_JSON on one line with literal `\n`
 * for BOTH structural whitespace and the PEM newlines, which JSON.parse
 * rejects. Lifted verbatim from clear-cron-bucket.mjs: isolate private_key,
 * swap it for a placeholder, normalise the rest, then restore it.
 */
function parseInlineJson(raw) {
  const m = raw.match(
    /"private_key":\s*"(-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----[\\n]*)"/,
  );
  if (!m) throw new Error("could not isolate private_key");
  const pk = m[1].replace(/\\n/g, "\n");
  const obj = JSON.parse(raw.replace(m[0], '"private_key":"__PK__"').replace(/\\n/g, "\n"));
  obj.private_key = pk;
  return obj;
}

function readEnvFile(p) {
  const env = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

async function main() {
  validate();
  if (process.argv.includes("--dry-run")) {
    console.log("--dry-run: not writing to Firestore.");
    return;
  }

  const envPath = process.env.ENV_FILE;
  if (!envPath) throw new Error("ENV_FILE is required (see header comment)");
  const env = readEnvFile(envPath);
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");

  fb.initializeApp({
    credential: fb.credential.cert(parseInlineJson(env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    projectId: env.FIREBASE_PROJECT_ID,
  });
  const db = fb.firestore();

  // This script is not idempotent, and a second accidental run would queue a
  // year of duplicates. Refuse if the batch is already there.
  const existing = await db
    .collection("questions")
    .where("source", "==", "curated_365")
    .limit(1)
    .get();
  if (!existing.empty) {
    throw new Error("questions with source='curated_365' already exist; refusing to seed again");
  }

  const CHUNK = 400; // Firestore allows 500 writes per batch.
  let seeded = 0;
  for (let i = 0; i < QUESTIONS_365.length; i += CHUNK) {
    const slice = QUESTIONS_365.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const text of slice) {
      batch.set(db.collection("questions").doc(), {
        text,
        status: "scheduled",
        source: "curated_365",
        created_at: fb.firestore.FieldValue.serverTimestamp(),
        // scheduled_drop_at intentionally omitted; prepareNextDrop fills it in.
      });
    }
    await batch.commit();
    seeded += slice.length;
    console.log(`committed ${seeded}/${QUESTIONS_365.length}`);
  }
  console.log(`done. seeded ${seeded} questions with source='curated_365'.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
