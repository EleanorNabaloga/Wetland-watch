import sharp from 'sharp';
async function makeImage(a, b, c, name) {
  const w = 600, h = 400, raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    raw[i]     = 128 + 127 * Math.sin(x * a + y * c);
    raw[i + 1] = 128 + 127 * Math.cos(y * b + x * c);
    raw[i + 2] = 128 + 127 * Math.sin((x + y) * (a + b));
  }
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toFile(name);
}
await makeImage(0.031, 0.017, 0.009, 'sample1.jpg');
await makeImage(0.012, 0.044, 0.027, 'sample2.jpg');
console.log('created sample1.jpg and sample2.jpg');
