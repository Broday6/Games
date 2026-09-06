#!/usr/bin/env node
// Bundles the game into a single self-contained HTML file (dist/driftwood.html)
// so it can be hosted anywhere that serves one static page.
const fs = require('fs'), path = require('path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>');
// embed 3D assets (manifest + GLB files as base64) so the single file needs no fetches
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'models.json'), 'utf8')); const files = {};
  for (const k in manifest) { const f = manifest[k].file; if (f && !files[f]) files[f] = fs.readFileSync(path.join(root, 'assets', f)).toString('base64'); }
  html = html.replace('<script src="js/util.js"></script>', '<script>window.__ASSETS = ' + JSON.stringify({ manifest, files }) + ';</script>\n<script src="js/util.js"></script>');
} catch (e) { console.warn('no assets embedded', e.message); }
// version (from the desktop package) and the third-party licence text (CC-BY attribution must ship inside the product)
let version = 'dev'; try { version = JSON.parse(fs.readFileSync(path.join(root, '..', 'desktop', 'package.json'), 'utf8')).version; } catch (e) { }
let licenses = ''; try { licenses = fs.readFileSync(path.join(root, 'assets', 'LICENSES.md'), 'utf8'); } catch (e) { }
html = html.replace('<script src="js/util.js"></script>', '<script>window.__VERSION = ' + JSON.stringify(version) + '; window.__LICENSES = ' + JSON.stringify(licenses) + ';</script>\n<script src="js/util.js"></script>');
html = html.replace('<script src="vendor/peerjs.min.js"></script>', '<script>\n' + fs.readFileSync(path.join(root, 'vendor', 'peerjs.min.js'), 'utf8') + '\n</script>');
html = html.replace(/<script src="js\/([a-z0-9]+\.js)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(root, 'js', f), 'utf8') + '\n</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'driftwood.html'), html);
// artifact variant: strip the doctype/html/head/body wrapper (the artifact host supplies its own)
const inner = html.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>/g, '').replace(/<link rel="icon"[^>]*>/g, '');
fs.writeFileSync(path.join(root, 'dist', 'driftwood-artifact.html'), '<meta charset="utf-8">\n' + head + '\n' + inner);
console.log('wrote dist/driftwood.html (' + (html.length / 1024).toFixed(0) + ' KB) and dist/driftwood-artifact.html');
