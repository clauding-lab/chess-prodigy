import sharp from "sharp";
// Original geometric rook, entirely local vector source, no font or external artwork.
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#1d212b"/><circle cx="256" cy="256" r="180" fill="#d7b377"/><path d="M160 144h48v48h32v-48h32v48h32v-48h48v88l-40 24v80l32 16v24H168v-24l32-16v-80l-40-24z" fill="#101218"/><path d="M224 264h64v72h-64z" fill="#d7b377"/></svg>';
for(const [file,size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512],['apple-touch-icon.png',180]])await sharp(Buffer.from(file.startsWith("maskable")?svg.replace('rx="96"','rx="0"'):svg)).resize(size,size).png().toFile('public/icons/'+file);
