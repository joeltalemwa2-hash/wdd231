#!/usr/bin/env node
// Run: node generate-icons.js
// Generates all required PWA icon sizes as SVG-based PNGs

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, 'icons');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Generate SVG icon at each size — saved as .svg (rename to .png or use a converter)
function generateSVG(size) {
  const r = Math.round(size * 0.278); // border-radius ~27.8%
  const scale = size / 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#E8A020"/>
  <g transform="scale(${scale})">
    <path d="M8 10h3l4 10 4-7 4 7 4-10h3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="18" cy="27" r="3" fill="#fff"/>
    <path d="M12 27h12" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  </g>
</svg>`;
}

sizes.forEach(size => {
  const svg = generateSVG(size);
  // Save as SVG — to convert to PNG, use sharp or Inkscape
  fs.writeFileSync(path.join(outputDir, `icon-${size}.svg`), svg);
  console.log(`Generated icon-${size}.svg`);
});

// Also save a favicon.ico placeholder SVG
fs.writeFileSync(path.join(__dirname, 'favicon.svg'), generateSVG(32));

console.log('\nDone! SVG icons saved to /icons/');
console.log('To convert to PNG, run: npm install sharp && node convert-icons.js');
console.log('Or open each SVG in a browser and save as PNG.');