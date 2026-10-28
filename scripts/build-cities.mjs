// Builds public/cities.json from GeoNames cities15000.txt (CC BY 4.0, https://www.geonames.org). Run: node scripts/build-cities.mjs /path/cities15000.txt
import fs from 'node:fs';
const rows = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
const out = rows.map((c) => [Number(c[0]), c[1], c[2] === c[1] ? '' : c[2], c[8], Math.round(c[4] * 100) / 100, Math.round(c[5] * 100) / 100, Number(c[14])]).sort((a, b) => b[6] - a[6]).map((r) => r.slice(0, 6));
fs.writeFileSync('public/cities.json', JSON.stringify(out));
console.log(out.length, 'cities');
