#!/usr/bin/env node
/**
 * Regenerate the favicon / app-icon set from the brand mark (the original mkmovies "mk" film-strip icon).
 *
 *   node scripts/gen-icons.mjs
 *
 * Renders the SVG below in headless Chromium (@playwright/test, already a devDependency) at each target size
 * — rendering per size instead of downscaling keeps 16/32 px crisp — then writes:
 *   src/app/favicon.ico          16 + 32 + 48 px (PNG-in-ICO)     → /favicon.ico
 *   src/app/icon.png             32 px                           → <link rel="icon">
 *   src/app/apple-icon.png       180 px                          → <link rel="apple-touch-icon">
 *   public/icons/icon-192.png, icon-512.png, maskable-512.png    → web manifest (src/app/manifest.ts)
 * Outputs are committed; nothing runs at build or request time.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT = "'Arial Black','Helvetica Neue',Arial,sans-serif";

/** The mark on a 32-unit grid (same geometry as the original 32×32 icon). `bleed` = square, edge-to-edge background. */
function markSvg({ bleed = false, scale = 1 } = {}) {
  const holes = [4, 13, 22]
    .flatMap((x) => [
      `<rect x="${x}" y="3" width="4" height="4" rx="1" fill="#fff" fill-opacity=".35"/>`,
      `<rect x="${x}" y="25" width="4" height="4" rx="1" fill="#fff" fill-opacity=".35"/>`,
    ])
    .join('');
  const inner = `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${holes}
    <text x="16" y="17" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-weight="900"
      font-size="13" letter-spacing="-0.5" fill="#fff">mk</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs>
  <rect width="32" height="32" rx="${bleed ? 0 : 7}" fill="url(#g)"/>${inner}</svg>`;
}

/** PNG-in-ICO container (Vista+; every current browser reads it). */
function toIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(size, opts) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markSvg(opts).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  return page.locator('svg').screenshot({ omitBackground: true, type: 'png' });
}

const write = (rel, buf) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  console.log(`${rel.padEnd(34)} ${buf.length} B`);
};

try {
  const ico = [];
  for (const size of [16, 32, 48]) ico.push({ size, data: await render(size) });
  write('src/app/favicon.ico', toIco(ico));
  write('src/app/icon.png', ico[1].data);
  // Apple applies its own corner mask: give it the full-bleed square.
  write('src/app/apple-icon.png', await render(180, { bleed: true }));
  write('public/icons/icon-192.png', await render(192));
  write('public/icons/icon-512.png', await render(512));
  // Maskable: full-bleed background, mark inside the 80% safe zone.
  write('public/icons/maskable-512.png', await render(512, { bleed: true, scale: 0.78 }));
} finally {
  await browser.close();
}
