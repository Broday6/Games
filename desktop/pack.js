// Cross-platform portable builds (folders zipped) with @electron/packager. Run from desktop/: `npm run pack`.
// Produces release/Driftwood-win-x64.zip, Driftwood-mac-arm64.zip, Driftwood-mac-x64.zip, Driftwood-linux-x64.zip
const { packager } = require('@electron/packager');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const targets = (process.argv[2] || 'win32:x64,darwin:arm64,darwin:x64,linux:x64').split(',').map(t => t.split(':'));
const names = { win32: 'win', darwin: 'mac', linux: 'linux' };
(async () => {
  fs.mkdirSync('release', { recursive: true });
  for (const [platform, arch] of targets) {
    const out = await packager({ dir: __dirname, out: 'build', platform, arch, overwrite: true, asar: true, name: 'Driftwood', appBundleId: 'com.broday6.driftwood',
      ignore: [/^\/build($|\/)/, /^\/release($|\/)/, /^\/dist($|\/)/, /^\/pack\.js$/, /^\/icon\.js$/, /^\/electron-builder\.yml$/, /^\/node_modules($|\/)/, /^\/package-lock\.json$/, /^\/\.gitignore$/],
      icon: fs.existsSync(path.join(__dirname, 'icon.ico')) ? path.join(__dirname, 'icon') : undefined, win32metadata: { CompanyName: 'Broday6', ProductName: 'Driftwood', FileDescription: 'Driftwood' } });
    const dir = out[0]; const zip = path.join('release', `Driftwood-${names[platform]}-${arch}.zip`);
    if (fs.existsSync(zip)) fs.unlinkSync(zip);
    execSync(`cd "${path.dirname(dir)}" && zip -qry "${path.resolve(zip)}" "${path.basename(dir)}"`);
    console.log('wrote', zip, (fs.statSync(zip).size / 1048576).toFixed(0) + ' MB');
  }
})().catch(e => { console.error(e); process.exit(1); });
