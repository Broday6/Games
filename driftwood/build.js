#!/usr/bin/env node
// Bundles the game into a single self-contained HTML file (dist/driftwood.html)
// so it can be hosted anywhere that serves one static page.
const fs = require('fs'), path = require('path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>');
html = html.replace(/<script src="js\/([a-z0-9]+\.js)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(root, 'js', f), 'utf8') + '\n</script>');
// embed 3D assets (manifest + GLB files as base64) so the single file needs no fetches
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'models.json'), 'utf8')); const files = {};
  for (const k in manifest) { const f = manifest[k].file; if (f && !files[f]) files[f] = fs.readFileSync(path.join(root, 'assets', f)).toString('base64'); }
  html = html.replace('<script src="https://cdnjs', '<script>window.__ASSETS = ' + JSON.stringify({ manifest, files }) + ';</script>\n<script src="https://cdnjs');
} catch (e) { console.warn('no assets embedded', e.message); }
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'driftwood.html'), html);
// artifact variant: strip the doctype/html/head/body wrapper (the artifact host supplies its own)
const inner = html.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>/g, '').replace(/<link rel="icon"[^>]*>/g, '');
fs.writeFileSync(path.join(root, 'dist', 'driftwood-artifact.html'), head + '\n' + inner);
console.log('wrote dist/driftwood.html (' + (html.length / 1024).toFixed(0) + ' KB) and dist/driftwood-artifact.html');
