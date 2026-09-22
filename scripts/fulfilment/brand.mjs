// Classify the brand on a PDF page from the logo band.
//
// Buckets are measured from rendered artwork, quantised to 16 so small
// anti-aliasing differences do not matter. Persimmon's mid and light greens
// and Charles Church's crest navy separate cleanly; the near-black both use
// does not, so it is ignored.
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
const BUCKETS = { persimmon: ['32,128,96', '64,192,144'], charleschurch: ['16,48,80'] };
const out = [];
for (const arg of process.argv.slice(2)) {
  const [file, pageNo] = arg.split('#');
  let rec = { file, page: +(pageNo || 1), brand: 'unknown', score: {} };
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
    const pg = await doc.getPage(rec.page);
    const base = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: 600 / base.width });
    const c = createCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height);
    await pg.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
    const d = ctx.getImageData(0, 0, c.width, Math.max(1, Math.round(c.height * 0.22))).data;
    const score = { persimmon: 0, charleschurch: 0 };
    for (let i = 0; i < d.length; i += 4) {
      const k = [d[i], d[i+1], d[i+2]].map(v => Math.round(v/16)*16).join(',');
      for (const [b, ks] of Object.entries(BUCKETS)) if (ks.includes(k)) score[b]++;
    }
    const lead = score.persimmon > score.charleschurch ? 'persimmon' : 'charleschurch';
    const total = score.persimmon + score.charleschurch;
    // Require a clear majority; a near-tie means we should not guess.
    rec.brand = (total < 100 || Math.max(...Object.values(score)) < 0.7 * total) ? 'unknown' : lead;
    rec.score = score;
  } catch (e) { rec.error = String(e).slice(0, 90); }
  out.push(rec);
}
console.log(JSON.stringify(out));
