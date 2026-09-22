// Render every page of a pack to PNG, for the proof sheet.
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const [file, outdir] = process.argv.slice(2);
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
for (let i = 1; i <= doc.numPages; i++) {
  const pg = await doc.getPage(i);
  const base = pg.getViewport({ scale: 1 });
  const vp = pg.getViewport({ scale: 900 / base.width });
  const c = createCanvas(Math.round(vp.width), Math.round(vp.height));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height);
  await pg.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
  fs.writeFileSync(`${outdir}/page${String(i).padStart(2, '0')}.png`, c.toBuffer('image/png'));
}
console.log('rendered', doc.numPages, 'pages');
