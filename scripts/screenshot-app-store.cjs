// Generates App Store screenshots from the Sticker Pop HTML mockups.
// Renders each of the 4 designed screens at 6.9" (1290x2796) and
// 6.5" (1242x2688) iPhone resolutions using headless Chromium.
//
// The mockup's .rb-phone-screen is 369x828 logical px (iPhone 15 Pro
// inner viewport after the 12px bezel padding). We strip the phone
// frame chrome, isolate just one screen at a time, scale it to fill
// the App Store viewport width (preserving aspect; the slight excess
// height crops naturally at the bottom which is the safest UX), and
// snapshot.
//
// Output: ios/assets/screenshots/{6.9,6.5}/{01..04}-{name}.png
//
// Usage: node scripts/screenshot-app-store.cjs
const { chromium } = require("playwright");
const path = require("path");

const MOCKUP_URL = "file:///C:/Users/levin/relatably/mockups/01-sticker-pop/index.html";

const SIZES = {
  "6.9": { width: 1290, height: 2796 }, // iPhone 16 Pro Max (also valid for 6.7")
  "6.5": { width: 1242, height: 2688 }, // iPhone 11 Pro Max
};

const SCREENS = [
  { id: "screen-1", name: "01-question" },
  { id: "screen-2", name: "02-wordcloud" },
  { id: "screen-3", name: "03-leaderboard" },
  { id: "screen-4", name: "04-archive" },
];

const OUT_ROOT = "C:/Users/levin/relatably/ios/assets/screenshots";

// .rb-phone-screen logical dimensions inside .rb-phone (393x852 with 12px padding)
const SCREEN_W = 369;
const SCREEN_H = 828;

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const [sizeKey, { width, height }] of Object.entries(SIZES)) {
    for (const { id, name } of SCREENS) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      await page.goto(MOCKUP_URL, { waitUntil: "networkidle" });

      // Wait for screens to populate (they are filled by inline JS).
      await page.waitForFunction(() => {
        const s = document.getElementById("screen-1");
        return s && s.children.length > 0;
      }, { timeout: 15000 });

      // Wait for Google Fonts to load.
      await page.evaluate(() => document.fonts.ready);

      // Strip page chrome, isolate the chosen screen, scale it to viewport width.
      await page.evaluate(({ screenId, w, h, sw, sh }) => {
        const screen = document.getElementById(screenId);
        if (!screen) throw new Error("screen not found: " + screenId);

        const scale = w / sw;
        const scaledH = sh * scale;

        // Reset doc.
        document.documentElement.style.cssText = "margin:0;padding:0;background:#FFF7E8;";
        document.body.innerHTML = "";
        document.body.style.cssText = `margin:0;padding:0;background:#FFF7E8;width:${w}px;height:${h}px;overflow:hidden;position:relative;`;

        // Wrapper to apply the transform without disturbing the screen's own styles.
        const wrap = document.createElement("div");
        wrap.style.cssText = `
          position:absolute;
          left:0;
          top:0;
          width:${sw}px;
          height:${sh}px;
          transform: scale(${scale});
          transform-origin: top left;
        `;
        wrap.appendChild(screen);

        // Force the screen to fill its wrapper (no border-radius, no overflow-hidden round corners).
        screen.style.cssText = `
          position:relative;
          width:${sw}px;
          height:${sh}px;
          border-radius:0;
          overflow:hidden;
          background:#FFF7E8;
        `;

        document.body.appendChild(wrap);

        // If scaled height < viewport height, fill the remaining strip with cream.
        if (scaledH < h) {
          const filler = document.createElement("div");
          filler.style.cssText = `
            position:absolute;
            left:0;
            top:${scaledH}px;
            width:${w}px;
            height:${h - scaledH}px;
            background:#FFF7E8;
          `;
          document.body.appendChild(filler);
        }
      }, { screenId: id, w: width, h: height, sw: SCREEN_W, sh: SCREEN_H });

      // Allow re-layout + font swap.
      await page.waitForTimeout(400);

      const outPath = path.join(OUT_ROOT, sizeKey, `${name}.png`);
      await page.screenshot({ path: outPath, fullPage: false, omitBackground: false });
      console.log(`✔ ${sizeKey}/${name}.png`);

      await context.close();
    }
  }

  await browser.close();
})().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
