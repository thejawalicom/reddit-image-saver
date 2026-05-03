/**
 * Generate simple PNG icons for the Reddit Image Saver extension.
 * Creates solid-color icons with "HD" text overlay effect.
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG encoder - creates a simple solid-color PNG
function createPNG(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(2, 9);        // color type (RGB)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk - raw image data
  const rawData = Buffer.alloc(size * (1 + size * 3)); // filter byte + RGB per pixel per row
  
  // Create a rounded-rect icon with gradient-like effect
  const center = size / 2;
  const radius = size * 0.15; // corner radius
  
  for (let y = 0; y < size; y++) {
    const rowOffset = y * (1 + size * 3);
    rawData[rowOffset] = 0; // no filter
    
    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      
      // Check if pixel is inside rounded rect
      const margin = Math.floor(size * 0.05);
      const inRect = x >= margin && x < size - margin && y >= margin && y < size - margin;
      
      if (inRect) {
        // Gradient effect: slightly lighter at top
        const gradientFactor = 1.0 - (y / size) * 0.3;
        
        // Check if we're in the "HD" text area (center of icon)
        const textAreaX = x >= size * 0.2 && x <= size * 0.8;
        const textAreaY = y >= size * 0.35 && y <= size * 0.65;
        const inTextArea = textAreaX && textAreaY;
        
        // Simple "block" letters for HD
        let inText = false;
        if (inTextArea && size >= 32) {
          const tx = (x - size * 0.2) / (size * 0.6); // 0-1 within text area
          const ty = (y - size * 0.35) / (size * 0.3); // 0-1 within text area
          
          // H letter (left side)
          if (tx < 0.4) {
            const lx = tx / 0.4; // 0-1 within H
            if (lx < 0.25 || lx > 0.75 || (ty > 0.4 && ty < 0.6)) {
              inText = true;
            }
          }
          // D letter (right side)
          else if (tx > 0.55) {
            const lx = (tx - 0.55) / 0.45; // 0-1 within D
            if (lx < 0.25 || (lx > 0.6 && (ty < 0.25 || ty > 0.75)) || ty < 0.15 || ty > 0.85) {
              inText = true;
            }
          }
        }
        
        if (inText) {
          // White text
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
        } else {
          // Orange gradient background
          rawData[pixelOffset] = Math.min(255, Math.floor(r * gradientFactor));
          rawData[pixelOffset + 1] = Math.min(255, Math.floor(g * gradientFactor));
          rawData[pixelOffset + 2] = Math.min(255, Math.floor(b * gradientFactor));
        }
      } else {
        // Transparent (white for RGB)
        rawData[pixelOffset] = 255;
        rawData[pixelOffset + 1] = 255;
        rawData[pixelOffset + 2] = 255;
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  
  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 32, 48, 128];
// Reddit orange: #FF4500 = rgb(255, 69, 0)
const color = { r: 255, g: 69, b: 0 };

for (const size of sizes) {
  const png = createPNG(size, color.r, color.g, color.b);
  const filepath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filepath, png);
  console.log(`Created ${filepath} (${png.length} bytes)`);
}

console.log('All icons generated!');
