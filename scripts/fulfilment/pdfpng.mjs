import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs'; import path from 'path';

const targetW = 1400;
for (const f of process.argv.slice(2)) {
  const data = new Uint8Array(fs.readFileSync(f));
  const doc = await pdfjs.getDocument({ data, disableFontFace: false }).promise;
  const pg = await doc.getPage(1);
  const base = pg.getViewport({ scale: 1 });
  const vp = pg.getViewport({ scale: targetW / base.width });
  const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height);
  await pg.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  const out = f.replace(/\.pdf$/, '.png');
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log('png', path.basename(out), Math.round(vp.width) + 'x' + Math.round(vp.height));
}
