// Renders R-2 (Cream R on Pink) at 1024x1024 as the actual app icon.
const { chromium } = require("playwright");
const SIZE = 1024;
const OUT = "C:/Users/levin/relatably/ios/assets/images/icon.png";

const HTML = `<!doctype html><html><head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Hanken+Grotesk:wght@800&display=swap');
  html, body { margin:0; padding:0; }
  body { width:${SIZE}px; height:${SIZE}px; background:#FF4FA3; overflow:hidden; position:relative; font-family:'Bagel Fat One',system-ui,sans-serif; }
  .stage { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
</style>
</head><body>
  <div class="stage">
    <span style="font-size:780px;line-height:1;color:#FFF7E8;letter-spacing:-0.04em;text-shadow:14px 16px 0 #1A1A1A;transform:translate(-12px,40px);">R</span>
    <span style="position:absolute;bottom:140px;right:170px;background:#FFDF6B;color:#1A1A1A;font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:90px;padding:14px 40px;border:10px solid #1A1A1A;border-radius:999px;transform:rotate(8deg);box-shadow:8px 8px 0 #1A1A1A;letter-spacing:0.12em;line-height:1;">.</span>
  </div>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(HTML, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT, fullPage: false, omitBackground: false, type: "png" });
  console.log(`✔ Wrote ${OUT}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
