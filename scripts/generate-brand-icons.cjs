const fs = require("fs");
const path = require("path");

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    return require("next/node_modules/sharp");
  }
}

function markSvg(size) {
  // Slightly larger mark padding so 16px tabs stay readable
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="11" fill="#0b1f3a"/>
  <circle cx="18" cy="17.5" r="12.5" fill="#38bdf8"/>
  <circle cx="30" cy="17.5" r="12.5" fill="#2563eb"/>
  <circle cx="24" cy="29.5" r="12.5" fill="#94a3b8"/>
</svg>`;
}

async function pngToIco(sharp, sizes) {
  const images = [];
  for (const size of sizes) {
    const png = await sharp(Buffer.from(markSvg(size))).png().toBuffer();
    images.push({ size, png });
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // ICO
  header.writeUInt16LE(images.length, 4);

  const entrySize = 16;
  const dataOffset = 6 + entrySize * images.length;
  const entries = [];
  const blobs = [];
  let offset = dataOffset;
  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry[0] = img.size >= 256 ? 0 : img.size;
    entry[1] = img.size >= 256 ? 0 : img.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    blobs.push(img.png);
    offset += img.png.length;
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

async function writeSet(dir) {
  const sharp = loadSharp();
  fs.mkdirSync(dir, { recursive: true });
  const ico = await pngToIco(sharp, [16, 32, 48]);
  const png32 = await sharp(Buffer.from(markSvg(32))).png().toBuffer();
  const png180 = await sharp(Buffer.from(markSvg(180))).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="TalentBridge">
  <rect width="48" height="48" rx="11" fill="#0b1f3a"/>
  <defs>
    <linearGradient id="a" x1="8" y1="6" x2="28" y2="30" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7dd3fc"/><stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="b" x1="20" y1="6" x2="40" y2="30" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="c" x1="14" y1="20" x2="34" y2="42" gradientUnits="userSpaceOnUse">
      <stop stop-color="#cbd5e1"/><stop offset="1" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <circle cx="18" cy="17.5" r="12.5" fill="url(#a)"/>
  <circle cx="30" cy="17.5" r="12.5" fill="url(#b)"/>
  <circle cx="24" cy="29.5" r="12.5" fill="url(#c)"/>
</svg>`;

  fs.writeFileSync(path.join(dir, "favicon.ico"), ico);
  fs.writeFileSync(path.join(dir, "icon.svg"), svg);
  fs.writeFileSync(path.join(dir, "icon-32.png"), png32);
  fs.writeFileSync(path.join(dir, "apple-touch-icon.png"), png180);
  // Cache-bust filename browsers latch onto
  fs.writeFileSync(path.join(dir, "favicon-v2.ico"), ico);
  console.log("wrote", dir, { ico: ico.length, png32: png32.length, apple: png180.length });
}

(async () => {
  await writeSet(path.join(__dirname, "../public"));
  await writeSet(path.join(__dirname, "../../Admin-Talent-Bridge/public"));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
