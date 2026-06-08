import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

const svgIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0a0a0a"/>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#grad)" opacity="0.15"/>
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#C9A84C;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C6A2D;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Balance scale icon -->
  <line x1="${size*0.5}" y1="${size*0.18}" x2="${size*0.5}" y2="${size*0.82}" stroke="#C9A84C" stroke-width="${size*0.04}" stroke-linecap="round"/>
  <line x1="${size*0.5}" y1="${size*0.28}" x2="${size*0.18}" y2="${size*0.38}" stroke="#C9A84C" stroke-width="${size*0.035}" stroke-linecap="round"/>
  <line x1="${size*0.5}" y1="${size*0.28}" x2="${size*0.82}" y2="${size*0.38}" stroke="#C9A84C" stroke-width="${size*0.035}" stroke-linecap="round"/>
  <circle cx="${size*0.18}" cy="${size*0.5}" r="${size*0.13}" fill="none" stroke="#C9A84C" stroke-width="${size*0.035}"/>
  <circle cx="${size*0.82}" cy="${size*0.5}" r="${size*0.13}" fill="none" stroke="#C9A84C" stroke-width="${size*0.035}"/>
  <line x1="${size*0.38}" y1="${size*0.82}" x2="${size*0.62}" y2="${size*0.82}" stroke="#C9A84C" stroke-width="${size*0.04}" stroke-linecap="round"/>
</svg>`

for (const size of [192, 512]) {
  await sharp(Buffer.from(svgIcon(size)))
    .png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`Generated icon-${size}.png`)
}
