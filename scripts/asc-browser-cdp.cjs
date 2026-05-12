// Keep-alive Chromium window exposed on CDP port 9222 so a separate
// driver process can connect via chromium.connectOverCDP().
//
// Persistent userDataDir at ../.asc-playwright-session/ keeps Levin's
// signed-in ASC session. Apple's trusted-browser cookie typically
// persists 30+ days so re-launching with the same dir avoids re-2FA.
//
// Usage: node scripts/asc-browser-cdp.cjs  (runs forever; Ctrl-C to stop)

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("C:\\Users\\levin\\node_modules\\playwright");

const USER_DATA = path.resolve(__dirname, "..", ".asc-playwright-session");
const CDP_PORT = 9222;

if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });

(async () => {
  console.log(`Launching Chromium (CDP=${CDP_PORT}) userDataDir=${USER_DATA}`);
  const context = await chromium.launchPersistentContext(USER_DATA, {
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: [`--remote-debugging-port=${CDP_PORT}`, "--start-maximized"],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(
    "https://appstoreconnect.apple.com/apps/6768082631/distribution/ios/version/inflight",
    { waitUntil: "load", timeout: 60_000 },
  );
  console.log(`Ready. CDP at http://localhost:${CDP_PORT}. Browser stays open.`);
  // Keep alive
  await new Promise(() => {});
})();
