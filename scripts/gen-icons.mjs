#!/usr/bin/env node
/**
 * Regenerate the favicon / app-icon set from the brand mark ("Noir & Gold": ink tile, gold frame, gold play glyph).
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
/**
 * "Noir & Gold" mark on a 64-unit grid — same geometry as <LogoMark> in src/components/layout/Logo.tsx.
 * `bleed`: square edge-to-edge tile without the hairline frame (Apple / maskable icons get masked by the OS).
 * `scale`: shrink the play glyph toward the centre (maskable safe zone).
 */
function markSvg({ bleed = false, scale = 1 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#23232c"/><stop offset="1" stop-color="#07070a"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0bf"/><stop offset=".45" stop-color="#f5b83d"/><stop offset="1" stop-color="#a86a0c"/></linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <rect width="64" height="64" rx="${bleed ? 0 : 15}" fill="url(#bg)"/>
  ${bleed ? '' : '<rect x="1.25" y="1.25" width="61.5" height="61.5" rx="13.8" fill="none" stroke="url(#gold)" stroke-opacity=".55" stroke-width="1.5"/>'}
  <rect width="64" height="32" rx="${bleed ? 0 : 15}" fill="url(#sheen)"/>
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <path d="M25 18.5 L47 32 L25 45.5 Z" fill="url(#gold)" stroke="url(#gold)" stroke-width="5" stroke-linejoin="round"/>
    <path d="M25 18.5 L47 32 L36 32 Z" fill="#fff" fill-opacity=".22"/></g></svg>`;
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
