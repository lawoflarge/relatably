// Opens a visible Chromium window pointed at App Store Connect with a
// persistent user-data dir so the session sticks across runs. Levin signs
// in once (with 2FA from his iPhone) and the form-fill happens in the
// same window — either driven by a follow-up script or clicked manually
// by Levin while Claude watches the state.
//
// Why headed + persistent: ASC requires Apple ID + 2FA. Headless can't do
// the 2FA push-to-device flow. Persistent userDataDir caches the session
// for subsequent runs.
//
// Usage:
//   node scripts/asc-browser-session.mjs
//
// The script blocks forever; Ctrl-C to close the window.

import { chromium } from "/c/Users/levin/node_modules/playwright/index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA = path.resolve(__dirname, "..", ".asc-playwright-session");
if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });

console.log(`Launching Chromium with userDataDir=${USER_DATA}`);
const context = await chromium.launchPersistentContext(USER_DATA, {
  headless: false,
  viewport: { width: 1400, height: 900 },
  args: ["--start-maximized"],
});

const page = context.pages()[0] || (await context.newPage());

console.log("Navigating to App Store Connect → Relatably v1.0…");
await page.goto("https://appstoreconnect.apple.com/apps/6768082631/distribution/ios/version/inflight", {
  waitUntil: "load",
  timeout: 60_000,
});

console.log("\n────────────────────────────────────────────────────────────");
console.log("Window is open. Levin:");
console.log("  1. Sign in with Apple ID + 2FA from your iPhone");
console.log("  2. In the left sidebar, click 'App Privacy' (under General Information)");
console.log("  3. Fill the questionnaire per MORNING-2026-05-12.md");
console.log("  4. Click 'Publish'");
console.log("  5. Post 'go' in chat to Claude");
console.log("────────────────────────────────────────────────────────────");
console.log("Browser stays open. Ctrl-C in this terminal to close.\n");

// Keep alive
await new Promise(() => {});
