const { PNG } = require('pngjs');
const fs = require('fs');
const { createHash } = require('crypto');

function makeImage(r, g, b, w = 10, h = 10) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const dir = '/tmp/visual-qa-test';
fs.mkdirSync(dir, { recursive: true });

// Baseline: 10x10 red
const baseline = makeImage(255, 0, 0);
fs.writeFileSync(`${dir}/screenshot.baseline.png`, baseline);

// Identical: same as baseline
fs.writeFileSync(`${dir}/screenshot-identical.png`, baseline);

// Full diff: 10x10 blue (100% different)
const fullDiff = makeImage(0, 0, 255);
fs.writeFileSync(`${dir}/screenshot-fulldiff.png`, fullDiff);

// Slight diff: 1 pixel changed
const slightPng = PNG.sync.read(Buffer.from(baseline));
slightPng.data[0] = 0;
slightPng.data[1] = 0;
slightPng.data[2] = 255;
const slightOut = PNG.sync.write(slightPng);
fs.writeFileSync(`${dir}/screenshot-slight.png`, slightOut);

// Big: 20x20 (dimension mismatch)
const big = makeImage(255, 0, 0, 20, 20);
fs.writeFileSync(`${dir}/screenshot-big.png`, big);

// Copy baseline for identical test
fs.copyFileSync(`${dir}/screenshot.baseline.png`, `${dir}/screenshot-identical.baseline.png`);
fs.copyFileSync(`${dir}/screenshot.baseline.png`, `${dir}/screenshot-fulldiff.baseline.png`);
fs.copyFileSync(`${dir}/screenshot.baseline.png`, `${dir}/screenshot-slight.baseline.png`);
fs.copyFileSync(`${dir}/screenshot.baseline.png`, `${dir}/screenshot-big.baseline.png`);

console.log('Test PNGs created');
console.log(`baseline: ${baseline.length} bytes`);
console.log(`hash: ${createHash('sha256').update(baseline).digest('hex').slice(0, 16)}...`);
