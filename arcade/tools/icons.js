// Rasterises an app's icon.svg into the PNG sizes phones need (Android manifest + iOS home screen).
// Usage: node arcade/tools/icons.js arcade/<app>   (run from the repo root; needs the preinstalled Playwright)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = path.resolve(process.argv[2] || '.');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const SIZES = { 'icon-512.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180 };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size] of Object.entries(SIZES)) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body></html>`);
    await page.screenshot({ path: path.join(dir, name), omitBackground: true });
    console.log('wrote', path.join(dir, name));
  }
  await browser.close();
})();
