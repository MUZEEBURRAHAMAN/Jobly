// Builds public/data/world-dots.json: the land as a grid of dots, for the "where the jobs are" map.
// Uses the dotted-map package (MIT, dev dependency only). Run: npm run map
// The map is equirectangular, so the browser can place any latitude and longitude with plain arithmetic:
//   x = (lng - lng.min) / (lng.max - lng.min) * w     y = (lat.max - lat) / (lat.max - lat.min) * h
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import DottedMap from 'dotted-map';

const region = { lat: { min: -56, max: 78 }, lng: { min: -170, max: 180 } };
const map = new DottedMap({ height: 64, grid: 'diagonal', region, projection: { name: 'equirectangular' } });
const pts = map.getPoints();
const { width: w, height: h } = map.image;
const ystep = pts.map((p) => p.y).filter((y) => y > 0).sort((a, b) => a - b)[0];
const dots = pts.map((p) => [Math.round(p.x * 2), Math.round(p.y / ystep)]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const out = { w, h, ystep, lat: [region.lat.min, region.lat.max], lng: [region.lng.min, region.lng.max], dots: dots.flat() };
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/data/world-dots.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${dots.length} land dots on a ${w}x${h} grid -> ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
