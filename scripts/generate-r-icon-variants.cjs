// 5 variations of the R Sticker Wordmark icon, all 1024x1024.
// Output: ios/assets/screenshots/_icon-options/r-{01..05}-{name}.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SIZE = 1024;
const OUT_DIR = "C:/Users/levin/relatably/ios/assets/screenshots/_icon-options";
fs.mkdirSync(OUT_DIR, { recursive: true });

const HEAD = `<style>
  @import url('https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Hanken+Grotesk:wght@800&display=swap');
  html, body { margin: 0; padding: 0; }
  body {
    width: ${SIZE}px; height: ${SIZE}px;
    background: #FFF7E8; overflow: hidden; position: relative;
    font-family: 'Bagel Fat One', system-ui, sans-serif;
  }
  .paper {
    position: absolute; inset: 0;
    background:
      radial-gradient(circle at 12% 10%, rgba(255, 79, 163, 0.10) 0, transparent 35%),
      radial-gradient(circle at 88% 18%, rgba(122, 230, 195, 0.14) 0, transparent 38%),
      radial-gradient(circle at 50% 92%, rgba(123, 200, 246, 0.12) 0, transparent 42%),
      radial-gradient(circle at 80% 80%, rgba(255, 212, 59, 0.12) 0, transparent 40%),
      #FFF7E8;
  }
  .dots {
    position: absolute; inset: 0;
    background-image:
      radial-gradient(rgba(26,26,26,0.05) 2px, transparent 2px),
      radial-gradient(rgba(26,26,26,0.04) 2px, transparent 2px);
    background-size: 56px 56px, 112px 112px;
    background-position: 0 0, 28px 28px;
    mix-blend-mode: multiply;
  }
  .stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
</style>`;

const ICONS = [
  {
    // Pink R on cream — color inversion of the original. R itself is the brand pink.
    name: "r-01-pink-on-cream",
    title: "Pink R on Cream",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:60px;height:60px;background:#FFDF6B;border:8px solid #1A1A1A;border-radius:999px;top:160px;left:200px;transform:rotate(-15deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:50px;height:50px;background:#7AE6C3;border:8px solid #1A1A1A;border-radius:999px;bottom:200px;right:200px;transform:rotate(12deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:760px;height:760px;background:#1A1A1A;border-radius:120px;transform:translate(40px,40px) rotate(-3deg);"></div>
        <div style="position:relative;width:760px;height:760px;background:#FFF7E8;border:14px solid #1A1A1A;border-radius:120px;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:680px;line-height:1;color:#FF4FA3;letter-spacing:-0.04em;text-shadow:8px 10px 0 #1A1A1A;transform:translate(-12px,30px);">R</span>
          <span style="position:absolute;bottom:60px;right:80px;background:#FFDF6B;color:#1A1A1A;font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:60px;padding:10px 26px;border:6px solid #1A1A1A;border-radius:999px;transform:rotate(8deg);box-shadow:5px 5px 0 #1A1A1A;letter-spacing:0.12em;">.</span>
        </div>
      </div>
    `,
  },
  {
    // Cream R on hot pink — bold inversion, pink dominates
    name: "r-02-cream-on-pink",
    title: "Cream R on Pink",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:60px;height:60px;background:#FFDF6B;border:8px solid #1A1A1A;border-radius:999px;top:160px;left:200px;transform:rotate(-15deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:50px;height:50px;background:#7AE6C3;border:8px solid #1A1A1A;border-radius:999px;bottom:200px;right:200px;transform:rotate(12deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:760px;height:760px;background:#1A1A1A;border-radius:120px;transform:translate(40px,40px) rotate(-3deg);"></div>
        <div style="position:relative;width:760px;height:760px;background:#FF4FA3;border:14px solid #1A1A1A;border-radius:120px;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:680px;line-height:1;color:#FFF7E8;letter-spacing:-0.04em;text-shadow:8px 10px 0 #1A1A1A;transform:translate(-12px,30px);">R</span>
          <span style="position:absolute;bottom:60px;right:80px;background:#FFDF6B;color:#1A1A1A;font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:60px;padding:10px 26px;border:6px solid #1A1A1A;border-radius:999px;transform:rotate(8deg);box-shadow:5px 5px 0 #1A1A1A;letter-spacing:0.12em;">.</span>
        </div>
      </div>
    `,
  },
  {
    // Original layout but with ★ accent replacing the dot — Sticker Pop signature
    name: "r-03-lemon-with-star",
    title: "Lemon R + Star",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:60px;height:60px;background:#7AE6C3;border:8px solid #1A1A1A;border-radius:999px;top:140px;left:170px;transform:rotate(-15deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:50px;height:50px;background:#7BC8F6;border:8px solid #1A1A1A;border-radius:999px;bottom:180px;left:200px;transform:rotate(12deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:760px;height:760px;background:#1A1A1A;border-radius:120px;transform:translate(40px,40px) rotate(-3deg);"></div>
        <div style="position:relative;width:760px;height:760px;background:#FFDF6B;border:14px solid #1A1A1A;border-radius:120px;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:680px;line-height:1;color:#1A1A1A;letter-spacing:-0.04em;transform:translate(-30px,30px);">R</span>
          <!-- pink star sticker top-right of the R -->
          <div style="position:absolute;top:120px;right:90px;width:170px;height:170px;display:flex;align-items:center;justify-content:center;transform:rotate(15deg);">
            <div style="position:absolute;inset:0;background:#FF4FA3;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);"></div>
            <div style="position:absolute;inset:0;background:#1A1A1A;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);transform:translate(8px,8px);z-index:-1;"></div>
          </div>
        </div>
      </div>
    `,
  },
  {
    // Peeling corner — the sticker LITERALLY peels at top-right, revealing cream beneath
    name: "r-04-peeling-corner",
    title: "Peeling Sticker R",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:760px;height:760px;background:#1A1A1A;border-radius:120px;transform:translate(40px,40px) rotate(-3deg);"></div>
        <div style="position:relative;width:760px;height:760px;background:#FFDF6B;border:14px solid #1A1A1A;border-radius:120px;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;overflow:visible;">
          <span style="font-size:680px;line-height:1;color:#1A1A1A;letter-spacing:-0.04em;transform:translate(-12px,30px);">R</span>
          <!-- the peeled corner: a triangular flap rotated outward, bottom = darker yellow (back of sticker) -->
          <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;">
            <!-- shadow under the peel -->
            <div style="position:absolute;inset:0;background:#1A1A1A;clip-path:polygon(0 0,100% 0,100% 100%);transform:translate(8px,12px) rotate(2deg);"></div>
            <!-- back of sticker showing -->
            <div style="position:absolute;inset:0;background:#FBEED1;border:8px solid #1A1A1A;clip-path:polygon(0 0,100% 0,100% 100%);"></div>
            <!-- highlight crease -->
            <div style="position:absolute;top:0;right:0;width:100%;height:6px;background:#1A1A1A;"></div>
          </div>
          <!-- pink dot bottom-right -->
          <span style="position:absolute;bottom:60px;right:80px;background:#FF4FA3;color:#FFF7E8;font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:60px;padding:10px 26px;border:6px solid #1A1A1A;border-radius:999px;transform:rotate(8deg);box-shadow:5px 5px 0 #1A1A1A;letter-spacing:0.12em;">.</span>
        </div>
      </div>
    `,
  },
  {
    // R inside a speech-bubble shape (rounded with a small tail) — combines wordmark + the question-app meaning
    name: "r-05-bubble-tail",
    title: "R in Speech Bubble",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:60px;height:60px;background:#7AE6C3;border:8px solid #1A1A1A;border-radius:999px;top:140px;left:170px;transform:rotate(-12deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:50px;height:50px;background:#7BC8F6;border:8px solid #1A1A1A;border-radius:999px;top:170px;right:170px;transform:rotate(15deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <!-- shadow bubble -->
        <div style="position:absolute;width:760px;height:760px;background:#1A1A1A;border-radius:200px 200px 60px 200px;transform:translate(40px,40px) rotate(-3deg);left:50%;top:50%;margin-left:-380px;margin-top:-380px;"></div>
        <!-- main bubble — note the bottom-left corner is small to form a speech tail -->
        <div style="position:relative;width:760px;height:760px;background:#FFDF6B;border:14px solid #1A1A1A;border-radius:200px 200px 60px 200px;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:680px;line-height:1;color:#1A1A1A;letter-spacing:-0.04em;transform:translate(-12px,20px);">R</span>
          <!-- pink "drop" indicator on the tail-side -->
          <div style="position:absolute;bottom:40px;left:80px;width:80px;height:80px;background:#FF4FA3;border:10px solid #1A1A1A;border-radius:999px;box-shadow:6px 6px 0 #1A1A1A;"></div>
        </div>
      </div>
    `,
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const icon of ICONS) {
    const ctx = await browser.newContext({
      viewport: { width: SIZE, height: SIZE },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const doc = `<!doctype html><html><head>${HEAD}</head><body>${icon.html}</body></html>`;
    await page.setContent(doc, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const out = path.join(OUT_DIR, `${icon.name}.png`);
    await page.screenshot({ path: out, fullPage: false, omitBackground: false, type: "png" });
    console.log(`✔ ${icon.name} (${icon.title}) → ${out}`);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
