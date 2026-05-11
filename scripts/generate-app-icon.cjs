// Generates 5 candidate Relatably app icon designs at 1024x1024
// in the Sticker Pop brand language.
//
// Output:
//   ios/assets/screenshots/_icon-options/01-bubble-q.png
//   ios/assets/screenshots/_icon-options/02-r-wordmark.png
//   ios/assets/screenshots/_icon-options/03-globe-q.png
//   ios/assets/screenshots/_icon-options/04-cluster.png
//   ios/assets/screenshots/_icon-options/05-you-pill.png
//   ios/assets/screenshots/_icon-options/_compare.png  (1x5 grid for side-by-side)
//
// Usage: node scripts/generate-app-icon.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SIZE = 1024;
const OUT_DIR = "C:/Users/levin/relatably/ios/assets/screenshots/_icon-options";
fs.mkdirSync(OUT_DIR, { recursive: true });

const SHARED_HEAD = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Hanken+Grotesk:wght@800&display=swap');
  html, body { margin: 0; padding: 0; }
  body {
    width: ${SIZE}px;
    height: ${SIZE}px;
    background: #FFF7E8;
    overflow: hidden;
    position: relative;
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

// Each icon: returns the full <body> inner HTML for the Sticker Pop design.
const ICONS = [
  {
    name: "01-bubble-q",
    title: "Pink Bubble Q",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:90px;height:90px;background:#7AE6C3;border:8px solid #1A1A1A;border-radius:999px;top:130px;left:130px;transform:rotate(8deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:70px;height:70px;background:#FFDF6B;border:8px solid #1A1A1A;border-radius:999px;top:160px;right:160px;transform:rotate(-12deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:60px;height:60px;background:#7BC8F6;border:8px solid #1A1A1A;border-radius:999px;bottom:160px;left:160px;transform:rotate(14deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:660px;height:660px;background:#1A1A1A;border-radius:200px 200px 200px 60px;transform:translate(36px,36px) rotate(-4deg);"></div>
        <div style="position:relative;width:660px;height:660px;background:#FF4FA3;border:12px solid #1A1A1A;border-radius:200px 200px 200px 60px;transform:rotate(-4deg);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:460px;line-height:1;color:#FFF7E8;text-shadow:8px 10px 0 #1A1A1A;transform:translate(-6px,18px);">?</span>
        </div>
      </div>
    `,
  },
  {
    name: "02-r-wordmark",
    title: "R Sticker Wordmark",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:60px;height:60px;background:#FFDF6B;border:8px solid #1A1A1A;border-radius:999px;top:160px;left:200px;transform:rotate(-15deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:50px;height:50px;background:#7AE6C3;border:8px solid #1A1A1A;border-radius:999px;bottom:200px;right:200px;transform:rotate(12deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:760px;height:760px;background:#1A1A1A;border-radius:120px;transform:translate(40px,40px) rotate(-3deg);"></div>
        <div style="position:relative;width:760px;height:760px;background:#FFDF6B;border:14px solid #1A1A1A;border-radius:120px;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:680px;line-height:1;color:#1A1A1A;letter-spacing:-0.04em;transform:translate(-12px,30px);">R</span>
          <span style="position:absolute;bottom:60px;right:80px;background:#FF4FA3;color:#FFF7E8;font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:60px;padding:10px 26px;border:6px solid #1A1A1A;border-radius:999px;transform:rotate(8deg);box-shadow:5px 5px 0 #1A1A1A;letter-spacing:0.12em;">.</span>
        </div>
      </div>
    `,
  },
  {
    name: "03-globe-q",
    title: "Globe Q",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <div style="position:absolute;width:80px;height:80px;background:#FFDF6B;border:8px solid #1A1A1A;border-radius:999px;top:130px;left:140px;transform:rotate(-10deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:60px;height:60px;background:#7BC8F6;border:8px solid #1A1A1A;border-radius:999px;bottom:170px;right:140px;transform:rotate(15deg);box-shadow:6px 6px 0 #1A1A1A;"></div>
        <div style="position:absolute;width:680px;height:680px;background:#1A1A1A;border-radius:999px;transform:translate(36px,40px);"></div>
        <div style="position:relative;width:680px;height:680px;background:#7AE6C3;border:14px solid #1A1A1A;border-radius:999px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          <!-- continent stickers, abstract, hand-drawn feel -->
          <div style="position:absolute;width:180px;height:120px;background:#FF4FA3;border:6px solid #1A1A1A;border-radius:60px 80px 50px 70px;top:120px;left:110px;transform:rotate(-12deg);"></div>
          <div style="position:absolute;width:140px;height:160px;background:#FFDF6B;border:6px solid #1A1A1A;border-radius:80px 50px 70px 60px;top:130px;right:90px;transform:rotate(8deg);"></div>
          <div style="position:absolute;width:200px;height:130px;background:#7BC8F6;border:6px solid #1A1A1A;border-radius:60px 90px 50px 70px;bottom:140px;left:160px;transform:rotate(5deg);"></div>
          <span style="position:absolute;font-size:520px;line-height:1;color:#FFF7E8;text-shadow:10px 12px 0 #1A1A1A;z-index:2;">?</span>
        </div>
      </div>
    `,
  },
  {
    name: "04-cluster",
    title: "Cluster Stickers",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <!-- Center hot pink "AI" cluster -->
        <div style="position:absolute;width:340px;height:240px;background:#1A1A1A;border-radius:120px 130px 110px 140px;transform:translate(28px,32px) rotate(-4deg);left:340px;top:380px;"></div>
        <div style="position:absolute;left:340px;top:380px;width:340px;height:240px;background:#FF4FA3;border:14px solid #1A1A1A;border-radius:120px 130px 110px 140px;transform:rotate(-4deg);display:flex;align-items:center;justify-content:center;color:#FFF7E8;font-size:200px;line-height:1;">AI</div>
        <!-- Top-left mint "tiktok" -->
        <div style="position:absolute;width:280px;height:130px;background:#7AE6C3;border:12px solid #1A1A1A;border-radius:80px;top:140px;left:90px;transform:rotate(-8deg);box-shadow:8px 8px 0 #1A1A1A;display:flex;align-items:center;justify-content:center;color:#1A1A1A;font-size:90px;">tiktok</div>
        <!-- Top-right blue "twitter" -->
        <div style="position:absolute;width:300px;height:130px;background:#7BC8F6;border:12px solid #1A1A1A;border-radius:80px;top:160px;right:80px;transform:rotate(6deg);box-shadow:8px 8px 0 #1A1A1A;display:flex;align-items:center;justify-content:center;color:#1A1A1A;font-size:80px;">twitter</div>
        <!-- Bottom-left lemon "nfts" -->
        <div style="position:absolute;width:230px;height:120px;background:#FFDF6B;border:12px solid #1A1A1A;border-radius:80px;bottom:160px;left:120px;transform:rotate(10deg);box-shadow:8px 8px 0 #1A1A1A;display:flex;align-items:center;justify-content:center;color:#1A1A1A;font-size:80px;">nfts</div>
        <!-- Bottom-right pale-pink "linkedin" -->
        <div style="position:absolute;width:300px;height:120px;background:#FFD7E8;border:12px solid #1A1A1A;border-radius:80px;bottom:170px;right:90px;transform:rotate(-7deg);box-shadow:8px 8px 0 #1A1A1A;display:flex;align-items:center;justify-content:center;color:#1A1A1A;font-size:74px;">linkedin</div>
      </div>
    `,
  },
  {
    name: "05-you-pill",
    title: "YOU Pill",
    html: `
      <div class="paper"></div><div class="dots"></div>
      <div class="stage">
        <!-- background lemon flag -->
        <div style="position:absolute;width:840px;height:340px;background:#1A1A1A;border-radius:60px;transform:translate(28px,28px) rotate(-3deg);"></div>
        <div style="position:relative;width:840px;height:340px;background:#FFDF6B;border:14px solid #1A1A1A;border-radius:60px;transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;">
          <span style="font-size:120px;line-height:1;color:#1A1A1A;font-family:'Hanken Grotesk',sans-serif;font-weight:800;letter-spacing:0.04em;">DAILY</span>
          <span style="background:#FF4FA3;color:#FFF7E8;font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:130px;padding:10px 60px;border:10px solid #1A1A1A;border-radius:999px;transform:rotate(5deg);box-shadow:8px 8px 0 #1A1A1A;letter-spacing:0.08em;">YOU</span>
        </div>
        <!-- crown sticker top-left to convey leaderboard win -->
        <div style="position:absolute;top:130px;left:130px;width:140px;height:120px;background:#FFDF6B;border:10px solid #1A1A1A;border-radius:30px 30px 20px 20px;transform:rotate(-15deg);box-shadow:6px 6px 0 #1A1A1A;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;font-size:90px;line-height:1;">♛</div>
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
    const doc = `<!doctype html><html><head>${SHARED_HEAD}</head><body>${icon.html}</body></html>`;
    await page.setContent(doc, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const out = path.join(OUT_DIR, `${icon.name}.png`);
    await page.screenshot({ path: out, fullPage: false, omitBackground: false, type: "png" });
    console.log(`✔ ${icon.name} (${icon.title}) → ${out}`);
    await ctx.close();
  }

  // Build a comparison sheet at smaller size for side-by-side review.
  const previewW = 280;
  const compareW = (previewW + 40) * ICONS.length + 40;
  const compareH = previewW + 120;
  const ctxC = await browser.newContext({
    viewport: { width: compareW, height: compareH },
    deviceScaleFactor: 1,
  });
  const pageC = await ctxC.newPage();
  const cells = ICONS.map((i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
      <img src="file://${path.join(OUT_DIR, i.name + ".png").replace(/\\/g, "/")}"
           style="width:${previewW}px;height:${previewW}px;border-radius:60px;box-shadow:0 8px 18px rgba(0,0,0,0.18);object-fit:cover;" />
      <div style="font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:22px;color:#1A1A1A;letter-spacing:0.04em;text-transform:uppercase;">${i.title}</div>
      <div style="font-family:'Hanken Grotesk',sans-serif;font-size:18px;color:#4A4541;">${i.name}</div>
    </div>`).join("");
  const compareDoc = `<!doctype html><html><head>${SHARED_HEAD}</head>
    <body style="background:#FFF7E8;width:${compareW}px;height:${compareH}px;display:flex;align-items:center;justify-content:center;gap:40px;padding:40px;">
      ${cells}
    </body></html>`;
  await pageC.setContent(compareDoc, { waitUntil: "networkidle" });
  await pageC.evaluate(() => document.fonts.ready);
  await pageC.waitForTimeout(400);
  const compareOut = path.join(OUT_DIR, "_compare.png");
  await pageC.screenshot({ path: compareOut, fullPage: false, omitBackground: false });
  console.log(`✔ comparison sheet → ${compareOut}`);

  await browser.close();
})().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
