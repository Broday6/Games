// Themes: each one is a full look (typefaces, palette for light and dark, corner shape, card style, heading case,
// background texture), plus personal options for mode, text size, density and navigation style.
// Fonts load on demand from Google Fonts; every theme falls back to system faces if they cannot load.
import { S } from './store.js';

const T = (light, dark = light) => ({ light, dark });
const pal = (bg, surface, surface2, field, line, fg, muted, accent, accentFg, accentSoft, good, goodSoft, warn, warnSoft, bad, badSoft, info, infoSoft, paper) =>
  ({ bg, surface, 'surface-2': surface2, field, line, fg, muted, accent, 'accent-fg': accentFg, 'accent-soft': accentSoft, good, 'good-soft': goodSoft, warn, 'warn-soft': warnSoft, bad, 'bad-soft': badSoft, info, 'info-soft': infoSoft, paper });

export const THEMES = [
  {
    id: 'chalk', name: 'Chalk Line', blurb: 'Clean slate with chalk-line blue. The original.',
    gf: 'family=Barlow+Condensed:wght@600;700&family=Public+Sans:wght@400;500;600;700;800',
    display: '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif', body: '"Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif', dw: 700,
    r: 12, rs: 10, btn: 10, cards: 'border', headings: 'upper', nav: 'bar', texture: 'none',
    colors: T(
      pal('#eef1f5', '#ffffff', '#e3e8ef', '#f7f9fb', '#d2d9e3', '#142030', '#5a6779', '#1c58cf', '#ffffff', '#dce6fa', '#1d7f48', '#d9f0e2', '#9c5d00', '#f8ead2', '#be3329', '#f9dedb', '#3b5a85', '#e1e8f2', '#ffffff'),
      pal('#0e131a', '#161d27', '#212a37', '#111821', '#2a3443', '#e5eaf1', '#93a0b3', '#6e9bff', '#0a1222', '#1b2b4b', '#52c485', '#15301f', '#f0aa48', '#33260f', '#f2766b', '#3a1a17', '#9db6dc', '#1d2838', '#1b232e')),
  },
  {
    id: 'fieldnotes', name: 'Field Notes', blurb: 'Kraft paper, typewriter headings, red pencil. A foreman’s notebook.',
    gf: 'family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700',
    display: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace', body: '"IBM Plex Sans", system-ui, -apple-system, sans-serif', dw: 600,
    r: 4, rs: 3, btn: 3, cards: 'border', headings: 'upper', nav: 'bar', texture: 'ruled',
    colors: T(
      pal('#e6d9bf', '#f7f0e1', '#e0d1b3', '#fcf7ec', '#c6b28c', '#2a2318', '#6b5d46', '#b3312a', '#ffffff', '#f0d4c6', '#3d7537', '#dce7cd', '#94580a', '#f1dfbb', '#b3312a', '#f0d0c8', '#3c5871', '#dae1e6', '#fffaf0'),
      pal('#1c1914', '#25211a', '#302a21', '#1f1b15', '#423929', '#ece2cd', '#a99b80', '#ef7c60', '#1c1914', '#43261d', '#8fc581', '#233220', '#e6b15e', '#3a2d16', '#f28a74', '#45231c', '#a1b9d2', '#22303d', '#2a251c')),
  },
  {
    id: 'blueprint', name: 'Blueprint', blurb: 'Drafting-table blue with grid lines and a yellow highlighter.',
    gf: 'family=Chakra+Petch:wght@500;600;700&family=Atkinson+Hyperlegible:wght@400;700',
    display: '"Chakra Petch", "Arial Narrow", system-ui, sans-serif', body: '"Atkinson Hyperlegible", system-ui, -apple-system, sans-serif', dw: 700,
    r: 3, rs: 2, btn: 2, cards: 'border', headings: 'upper', nav: 'bar', texture: 'grid', single: 'dark',
    colors: T(pal('#0e3866', '#124274', '#1a4f86', '#0c325c', '#4a7db4', '#eaf3ff', '#a8c4e6', '#ffd447', '#10243c', '#28588a', '#7ee3a9', '#17505a', '#ffc46b', '#4a4a3a', '#ff9a9a', '#5a3550', '#bfe0ff', '#1f4f80', '#124274')),
  },
  {
    id: 'iron', name: 'Iron', blurb: 'Gym-floor graphite, bumper-plate red, heavy poster type.',
    gf: 'family=Anton&family=Manrope:wght@400;500;600;700;800',
    display: 'Anton, Impact, "Arial Narrow", system-ui, sans-serif', body: 'Manrope, system-ui, -apple-system, sans-serif', dw: 400,
    r: 16, rs: 12, btn: 12, cards: 'flat', headings: 'upper', nav: 'float', texture: 'none',
    colors: T(
      pal('#efefec', '#ffffff', '#e4e4e0', '#f6f6f3', '#d4d4cf', '#16181b', '#5b6168', '#cf2f36', '#ffffff', '#f7d8d9', '#1e7f50', '#d6eee1', '#9a5e00', '#f6e6c8', '#cf2f36', '#f7d8d9', '#355d8f', '#dfe7f2', '#ffffff'),
      pal('#141619', '#1e2125', '#292d32', '#181b1f', '#32373e', '#f1f2f4', '#9aa1ab', '#ef4b51', '#ffffff', '#3c1d20', '#4cc38a', '#173326', '#f5a524', '#3a2c12', '#ff6b6b', '#3f1d1d', '#7fb2ff', '#1b2a40', '#1e2125')),
  },
  {
    id: 'sunday', name: 'Sunday', blurb: 'Sage and linen, a soft serif, rounded and calm. For slower days.',
    gf: 'family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@400;600;700;800',
    display: 'Fraunces, Georgia, "Times New Roman", serif', body: '"Nunito Sans", system-ui, -apple-system, sans-serif', dw: 600,
    r: 20, rs: 14, btn: 999, cards: 'shadow', headings: 'normal', nav: 'float', texture: 'none',
    colors: T(
      pal('#edf1e8', '#fbfcf8', '#e0e8da', '#f4f7f0', '#d1dcc8', '#1e2a21', '#5d6d60', '#3d7a58', '#ffffff', '#d5e9da', '#2e7a4c', '#d4ebda', '#9e620c', '#f3e3c6', '#b2463a', '#f4d7d2', '#476784', '#dbe5ee', '#ffffff'),
      pal('#131915', '#1a221c', '#233026', '#161d18', '#2d3a30', '#e6eee7', '#9cb0a1', '#82c79e', '#0f2016', '#1e3a29', '#82c79e', '#1c3525', '#e4b168', '#382b16', '#ef9184', '#3c211d', '#a8c3dc', '#1e2c38', '#1c251f')),
  },
  {
    id: 'jobsite', name: 'Job Site', blurb: 'Maximum contrast, big type and bold borders. Readable in full sun.',
    gf: 'family=Archivo+Black&family=Atkinson+Hyperlegible:wght@400;700',
    display: '"Archivo Black", "Arial Black", system-ui, sans-serif', body: '"Atkinson Hyperlegible", system-ui, -apple-system, sans-serif', dw: 400,
    r: 8, rs: 6, btn: 8, cards: 'bold', headings: 'upper', nav: 'bar', texture: 'none', text: 'large',
    colors: T(
      pal('#ffffff', '#ffffff', '#efefef', '#ffffff', '#111111', '#000000', '#2b2b2b', '#0040c4', '#ffffff', '#ffe14d', '#006b2d', '#c9f5d6', '#7a4500', '#ffe7b3', '#b00020', '#ffd6dc', '#003e7a', '#d6e8ff', '#ffffff'),
      pal('#000000', '#0b0b0b', '#1d1d1d', '#000000', '#bdbdbd', '#ffffff', '#d4d4d4', '#ffd400', '#000000', '#3a3200', '#5dff9a', '#0f3320', '#ffb340', '#3a2600', '#ff6b6b', '#3d1010', '#9cc8ff', '#102a44', '#0b0b0b')),
  },
];
export const theme = () => THEMES.find(t => t.id === S.settings?.skin) || THEMES[0];

const fontLinks = new Set();
export function loadFonts(t) {
  if (fontLinks.has(t.id)) return;
  fontLinks.add(t.id);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?${t.gf}&display=swap`;
  document.head.appendChild(l);
}

// The viewer (or the OS) decides light vs dark unless the person picked one in Appearance.
function wantsDark(t) {
  if (t.single) return t.single === 'dark';
  const mode = S.settings?.mode || 'auto';
  if (mode !== 'auto') return mode === 'dark';
  const host = document.documentElement.getAttribute('data-theme');
  if (host === 'dark' || host === 'light') return host === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

export const tokensCss = (t, dark) => {
  const c = dark ? t.colors.dark : t.colors.light;
  return Object.entries(c).map(([k, v]) => `--${k}:${v}`).join(';')
    + `;--display:${t.display};--body:${t.body};--dw:${t.dw};--r:${t.r}px;--r-sm:${t.rs}px;--btn-r:${t.btn}px;color-scheme:${dark ? 'dark' : 'light'}`;
};

let last = '';
export function applyTheme() {
  const t = theme();
  const dark = wantsDark(t);
  const st = S.settings || {};
  const root = document.documentElement;
  const key = [t.id, dark, st.text, st.density, st.nav].join('|');
  if (key === last) return;
  last = key;
  loadFonts(t);
  let el = document.getElementById('skin-tokens');
  if (!el) { el = document.createElement('style'); el.id = 'skin-tokens'; document.head.appendChild(el); }
  // html:root[data-skin] outranks the stylesheet's own :root and dark-mode blocks.
  el.textContent = `html:root[data-skin]{${tokensCss(t, dark)}}`;
  Object.assign(root.dataset, {
    skin: t.id, cards: t.cards, headings: t.headings, texture: t.texture, dark: dark ? '1' : '0',
    nav: st.nav && st.nav !== 'auto' ? st.nav : t.nav,
    text: st.text && st.text !== 'auto' ? st.text : t.text || 'normal',
    density: st.density || 'comfortable',
  });
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') || Object.assign(document.head.appendChild(document.createElement('meta')), { name: 'theme-color' });
  meta.content = (dark ? t.colors.dark : t.colors.light).bg;
}
// Follow the viewer's and the phone's light/dark switch while on Auto.
export function watchMode() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { last = ''; applyTheme(); });
  new MutationObserver(() => { last = ''; applyTheme(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
