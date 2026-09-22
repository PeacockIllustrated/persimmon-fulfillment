// Render each sign's HTML to a PDF at exact millimetres.
//
// Chromium is found in this order: PLAYWRIGHT_CHROMIUM_PATH, then playwright's
// own resolution, then the newest build under PLAYWRIGHT_BROWSERS_PATH. The
// path used to be hard-coded to one Chromium build, which meant a pack could
// only be built on the machine that path happened to be right on.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function fallbackChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root).filter(d => d.startsWith('chromium')).sort().reverse();
  for (const dir of dirs) {
    for (const rel of ['chrome-linux/chrome',
                       'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
                       'chrome-win/chrome.exe']) {
      const exe = path.join(root, dir, rel);
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

async function launch() {
  const args = ['--no-sandbox'];
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args });
  }
  try {
    return await chromium.launch({ args });
  } catch (e) {
    const exe = fallbackChromium();
    if (!exe) throw e;
    return chromium.launch({ executablePath: exe, args });
  }
}

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await launch();
for (const job of spec) {
  const page = await browser.newPage();
  await page.setContent(job.html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: job.out, width: job.w + 'mm', height: job.h + 'mm',
                   printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  console.log('pdf', path.basename(job.out), job.w + 'x' + job.h + 'mm');
  await page.close();
}
await browser.close();
