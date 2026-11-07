// Renders poster.html at 2x with headless Chromium, then downscales to 1080x1080 (see render.py-free flow: sharp text).
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 });
  await pg.goto('file://' + path.resolve('poster.html'));
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: 'output/_2x.png' });
  await b.close();
})();
