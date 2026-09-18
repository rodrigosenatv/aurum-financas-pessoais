const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generate() {
  const publicDir = path.join(__dirname, '..', 'public');
  const svgPath = path.join(publicDir, 'icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Generating PWA icons from', svgPath);

  // 1. icon-192.png
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ icon-192.png');

  // 2. icon-512.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ icon-512.png');

  // 3. apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // 4. Maskable icons (requires ~10-15% padding with background color #060807 so icon is not cropped when circle-masked)
  // For 512x512 maskable: inner icon 410x410 centered on 512x512 canvas with background #060807
  const inner512 = await sharp(svgBuffer)
    .resize(410, 410)
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 6, g: 8, b: 7, alpha: 1 }
    }
  })
  .composite([{ input: inner512, gravity: 'center' }])
  .png()
  .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('✓ icon-maskable-512.png');

  // For 192x192 maskable: inner icon 154x154 centered on 192x192 canvas with background #060807
  const inner192 = await sharp(svgBuffer)
    .resize(154, 154)
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 6, g: 8, b: 7, alpha: 1 }
    }
  })
  .composite([{ input: inner192, gravity: 'center' }])
  .png()
  .toFile(path.join(publicDir, 'icon-maskable-192.png'));
  console.log('✓ icon-maskable-192.png');

  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
