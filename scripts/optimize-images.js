// scripts/optimize-images.js
// originals/  ->  the_collection/display/{name}.jpg  (hero, 1800)
//                 the_collection/large/{name}.jpg    (lightbox, 2800 or 4000)
//                 the_collection/card/{name}.jpg     (related cards, 1000)
//                 the_collection/thumb/{name}.jpg    (peek, nav, gallery, 480)

// node scripts/optimize-images.js            normal run (skips up-to-date files)
// node scripts/optimize-images.js --dry      list what would be done
// node scripts/optimize-images.js --force    regenerate everything
// node scripts/optimize-images.js --no-large skip the 2800px tier

const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const ROOT   = path.join(__dirname, '..');
const SRC    = path.join(ROOT, 'originals');
const OUT    = path.join(ROOT, 'src', 'images', 'the_collection');

const DRY      = process.argv.includes('--dry');
const FORCE    = process.argv.includes('--force');
const NO_LARGE = process.argv.includes('--no-large');

const TIERS = [
  { name: 'display', dir: path.join(OUT, 'display'), prefix: '', edge: 1800, quality: 82 },
  { name: 'large',   dir: path.join(OUT, 'large'),   prefix: '', edge: 2800, quality: 80 },
  { name: 'card',    dir: path.join(OUT, 'card'),    prefix: '', edge: 1000, quality: 82 },
  { name: 'thumb',   dir: path.join(OUT, 'thumb'),   prefix: '', edge: 480,  quality: 80 },
];

const kb = n => (n / 1024).toFixed(0).padStart(6) + ' KB';

async function main() {
  if (!fs.existsSync(SRC)) {
    console.log('Originals folder not found. Skipping image optimization (images are already optimized in src/images).');
    process.exit(0);
  }
  const files = fs.readdirSync(SRC).filter(f => /\.(jpe?g|png)$/i.test(f)).sort();
  console.log(`${DRY ? '[dry run] ' : ''}Found ${files.length} original(s) in ${SRC}\n`);

  if (!DRY) TIERS.forEach(t => fs.mkdirSync(t.dir, { recursive: true }));

  const totals = Object.fromEntries(TIERS.map(t => [t.name, 0]));
  let processed = 0, skipped = 0;

  for (const file of files) {
    const inPath = path.join(SRC, file);
    const base   = path.basename(file, path.extname(file));
    const inTime = fs.statSync(inPath).mtimeMs;

    // Which tiers are missing or older than the original?
    const todo = TIERS.filter(t => {
      const out = path.join(t.dir, t.prefix + base + '.jpg');
      return FORCE || !fs.existsSync(out) || fs.statSync(out).mtimeMs < inTime;
    });
    if (!todo.length) { skipped++; continue; }

    if (DRY) { console.log(`${file.padEnd(20)} -> ${todo.map(t => t.name).join(', ')}`); continue; }

    try {
      // Decode once (auto-orient from EXIF), derive every tier from it
      const base_img = sharp(inPath, { failOn: 'none', sequentialRead: true }).rotate();
      const line = [];

      for (const t of todo) {
        const out = path.join(t.dir, t.prefix + base + '.jpg');
        const tmp = out + '.tmp';
        await base_img.clone()
          .resize({ width: t.edge, height: t.edge, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: t.quality, mozjpeg: true, progressive: true })
          .toFile(tmp);
        fs.renameSync(tmp, out);
        const size = fs.statSync(out).size;
        totals[t.name] += size;
        line.push(`${t.name} ${kb(size)}`);
      }
      processed++;
      console.log(`${file.padEnd(20)} ${line.join('   ')}`);
    } catch (err) {
      console.error(`FAILED ${file}:`, err.message);
    }
  }

  if (!DRY) {
    console.log(`\nDone. ${processed} processed, ${skipped} already up to date.`);
    for (const t of TIERS) console.log(`  ${t.name.padEnd(8)} ${(totals[t.name] / 1048576).toFixed(1)} MB (this run)`);
  }
}

main();