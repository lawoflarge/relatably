// Shared seed content for all 7 Relatably design mockups.
// Identical data across all 7 — only the visual language changes.
// This makes side-by-side comparison fair: design ≠ content.

window.RELATABLY = {
  brand: {
    name: "Relatably",
    tagline: "what does the world think?",
  },

  meta: {
    todayLabel: "MON · MAY 11",
    dropTimeLabel: "6:34 PM UTC",
    secondsSinceDrop: 1847,
    totalAnswers: 12847,
    countriesAnswered: 87,
    timeLeftLabel: "21h 42m left",
  },

  question: {
    id: "q_2026-05-11",
    text: "what's the most overrated thing on the internet right now?",
    droppedAt: "2026-05-11T18:34:00Z",
  },

  user: {
    handle: "levin",
    answer: "AI generated everything",
    selfClusterId: "c_ai",
    rank: 4,
    streak: 4,
    calledIt: false,
  },

  // 20 clusters, sorted desc by count. Realistic free-text distribution
  // with one dominant cluster + long tail. Use to sanity-check the
  // wordcloud at every scale.
  clusters: [
    { id: "c_ai",            text: "AI",              count: 3204 },
    { id: "c_tiktok",        text: "tiktok",          count: 1892 },
    { id: "c_twitter",       text: "twitter",         count: 1421 },
    { id: "c_podcasts",      text: "podcasts",        count:  987 },
    { id: "c_nfts",          text: "nfts",            count:  743 },
    { id: "c_influencers",   text: "influencers",     count:  612 },
    { id: "c_linkedin",      text: "linkedin",        count:  543 },
    { id: "c_crypto",        text: "crypto",          count:  487 },
    { id: "c_dating_apps",   text: "dating apps",     count:  432 },
    { id: "c_reddit",        text: "reddit",          count:  389 },
    { id: "c_threads",       text: "threads",         count:  312 },
    { id: "c_instagram",     text: "instagram",       count:  287 },
    { id: "c_substack",      text: "substack",        count:  198 },
    { id: "c_chatgpt",       text: "chatgpt",         count:  167 },
    { id: "c_discord",       text: "discord",         count:  134 },
    { id: "c_yt_shorts",     text: "youtube shorts",  count:  121 },
    { id: "c_snapchat",      text: "snapchat",        count:   87 },
    { id: "c_bereal",        text: "bereal",          count:   54 },
    { id: "c_clubhouse",     text: "clubhouse",       count:   23 },
    { id: "c_bluesky",       text: "bluesky",         count:   18 },
  ],

  leaderboard: {
    period: "daily",          // daily | weekly | alltime
    scope: "global",          // global | friends
    entries: [
      { rank:  1, handle: "ace.exe",     score: 1284, streak: 12, isSelf: false, crown: true  },
      { rank:  2, handle: "mira_dot",    score: 1198, streak:  8, isSelf: false, crown: false },
      { rank:  3, handle: "void.kid",    score: 1067, streak:  6, isSelf: false, crown: false },
      { rank:  4, handle: "levin",       score:  982, streak:  4, isSelf: true,  crown: false },
      { rank:  5, handle: "nina.rs",     score:  921, streak:  3, isSelf: false, crown: false },
      { rank:  6, handle: "tom.draws",   score:  887, streak:  5, isSelf: false, crown: false },
      { rank:  7, handle: "rin_42",      score:  802, streak:  2, isSelf: false, crown: false },
      { rank:  8, handle: "sora.bit",    score:  754, streak:  1, isSelf: false, crown: false },
      { rank:  9, handle: "kobi.lol",    score:  698, streak:  4, isSelf: false, crown: false },
      { rank: 10, handle: "jules.x",     score:  641, streak:  2, isSelf: false, crown: false },
    ],
  },

  archive: [
    { id: "a1", date: "may 10", text: "what's a movie everyone loved that you secretly hated?", verdict: "the notebook",            count: 14203 },
    { id: "a2", date: "may 9",  text: "would you rather be famous for a day or invisible for a year?", verdict: "invisible",         count: 11891 },
    { id: "a3", date: "may 8",  text: "what's the worst pizza topping?",                       verdict: "pineapple",                  count: 13742 },
    { id: "a4", date: "may 7",  text: "most embarrassing song on your playlist right now?",    verdict: "barbie girl",                count:  9821 },
    { id: "a5", date: "may 6",  text: "what's a take that would get you cancelled?",           verdict: "tipping culture is broken",  count: 17234 },
    { id: "a6", date: "may 5",  text: "if you could uninvent one technology what would it be?",verdict: "social media",               count: 12918 },
    { id: "a7", date: "may 4",  text: "what's the most useless skill you have?",               verdict: "perfect parallel parking",   count:  8472 },
    { id: "a8", date: "may 3",  text: "weirdest thing you do when you're alone?",              verdict: "narrate my life",            count: 11432 },
  ],
};
