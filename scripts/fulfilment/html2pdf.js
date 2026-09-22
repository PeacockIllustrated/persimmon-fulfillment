const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const job of spec) {
    const page = await browser.newPage();
    await page.setContent(job.html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: job.out, width: job.w + 'mm', height: job.h + 'mm',
                     printBackground: true, margin: {top:0,right:0,bottom:0,left:0} });
    console.log('pdf', path.basename(job.out), job.w + 'x' + job.h + 'mm');
    await page.close();
  }
  await browser.close();
})();
