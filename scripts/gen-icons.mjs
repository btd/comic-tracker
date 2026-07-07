import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const svg = readFileSync(join(pub, 'favicon.svg'));

const targets = [
  ['pwa-192x192.png', 192, false],
  ['pwa-512x512.png', 512, false],
  ['maskable-512x512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon-48x48.png', 48, false],
];

for (const [name, size, maskable] of targets) {
  let img = sharp(svg).resize(size, size);
  if (maskable) {
    const inner = Math.round(size * 0.8);
    img = sharp({
      create: { width: size, height: size, channels: 4, background: '#0b0b0f' },
    }).composite([{ input: await sharp(svg).resize(inner, inner).png().toBuffer() }]);
  }
  await img.png().toFile(join(pub, name));
  console.log('wrote', name);
}
console.log('done');
