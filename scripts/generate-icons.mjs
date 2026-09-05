import sharp from "sharp";
// Original knight silhouette on the dark theme's background; no fonts or external artwork.
// Keep the silhouette inside the central safe area for rounded and circular app masks.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#101218"/><path d="M177 354c5-53 38-84 78-111l-45 7-25 20-38-22 16-42 55-47 12-52 35 30c65 3 110 58 109 130l-3 87z" fill="#eef0f4"/><path d="M266 170c50 22 70 70 58 142" fill="none" stroke="#101218" stroke-width="13" stroke-linecap="round"/><path d="m224 168-22 27 33-9z" fill="#101218"/><path d="m159 236 26 7" fill="none" stroke="#101218" stroke-width="9" stroke-linecap="round"/><path d="M172 368h202l14 27H158z" fill="#eef0f4"/></svg>';
for (const [file, size] of [
  ["knight-192.png", 192],
  ["knight-512.png", 512],
  ["knight-maskable-512.png", 512],
  ["knight-apple-touch.png", 180],
])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile("public/icons/" + file);
