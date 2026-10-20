// Pure chapter look generator: no DOM, no storage. Deterministic from the chapter number.
import { hash, mulberry32 } from './core.js';

export const SYMBOLS = {
  diamond: 'M12 2 22 12 12 22 2 12Z',
  circle: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
  ring: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  triangle: 'M12 3 22 20H2Z',
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6Z',
  hexagon: 'M7 3h10l5 9-5 9H7l-5-9Z',
  square: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z',
  heart: 'M12 21S3 15.5 3 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 2.5C21 15.5 12 21 12 21Z',
  moon: 'M14 2.5A9.5 9.5 0 1 0 21.5 17 7.5 7.5 0 0 1 14 2.5Z',
  drop: 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13Z',
  leaf: 'M4 20C4 10 10 4 21 3c-1 11-7 17-17 17Z',
  bolt: 'M14 1 4 14h7l-2 9 11-14h-7Z',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
};
const ALIKE = [['circle', 'ring'], ['circle', 'hexagon'], ['ring', 'hexagon'], ['drop', 'leaf']];
const SCHEMES = [[0, 28, 56, -28, -56], [0, 120, 240, 24, 144], [0, 150, 210, 30, 180], [0, 90, 180, 270, 45]];
const STYLES = ['jewel', 'matte', 'line', 'duotone', 'glow'];
const TL = [.62, .52, .72, .47, .66];
const ok = (L, C, h) => `oklch(${+L.toFixed(3)} ${+C.toFixed(3)} ${h})`;
const mod = h => ((h % 360) + 360) % 360;

const CH1 = {
  n: 1, hue: 200,
  light: { bg: '#E4E8E1', ink: '#1E2A2D', muted: '#5E6B68', board: '#C6CEC3', well: '#D7DDD3', track: '#CBD2C8', sheet: '#F2F4EF', accent: '#3B5FA0' },
  dark: { bg: '#141C1F', ink: '#E2E8E4', muted: '#93A19D', board: '#0C1315', well: '#1C272B', track: '#26333A', sheet: '#1C2629', accent: '#5479C2' },
  tiles: { light: ['#5E9E8F', '#3B5FA0', '#C99530', '#A2433C', '#77589A'], dark: ['#6DB3A3', '#5479C2', '#D9A63E', '#BD5148', '#8F6CB5'] },
  tileHues: [177, 261, 80, 27, 305],
  gems: { light: ['#FF4D6D', '#4CC2FF', '#4BE08A', '#FFC83D', '#C792FF'], dark: ['#F23D5E', '#3DB0EE', '#3DCF78', '#EDB52C', '#B67FF0'] },
  gemHues: [15, 235, 154, 86, 305],
  symbols: ['diamond', 'circle', 'triangle', 'star', 'hexagon'], style: 'matte', rad: '20%', gloss: .42,
  neutral: { light: '#9AA39E', dark: '#56635F' },
};

export function chapterTheme(n) {
  if (n <= 1) return CH1;
  const r = mulberry32(hash(n * 7919 + 13)), pick = a => a[Math.floor(r() * a.length)];   // fixed draw order
  const H = Math.floor(r() * 360), sch = pick(SCHEMES), C = .11 + r() * .04;
  const tileHues = sch.map(o => mod(H + o)), gOff = Math.floor(r() * 360);
  const gemHues = [0, 1, 2, 3, 4].map(k => mod(H + gOff + k * 72));
  const rad = pick(['20%', '12%', '30%']), gloss = pick([.42, .25, .55]), style = pick(STYLES);
  const pool = Object.keys(SYMBOLS), symbols = [];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const s of pool) if (symbols.length < 5 && !ALIKE.some(([a, b]) => (s === a && symbols.includes(b)) || (s === b && symbols.includes(a)))) symbols.push(s);
  const tiles = d => tileHues.map((h, i) => ok(TL[i] + d, C, h)), a = tileHues[2];
  return {
    n, hue: H,
    light: { bg: ok(.94, .014, H), ink: ok(.26, .02, H), muted: ok(.46, .03, H), board: ok(.83, .025, H), well: ok(.89, .018, H), track: ok(.86, .02, H), sheet: ok(.97, .01, H), accent: ok(.5, .13, a) },
    dark: { bg: ok(.2, .018, H), ink: ok(.92, .01, H), muted: ok(.7, .02, H), board: ok(.15, .02, H), well: ok(.25, .022, H), track: ok(.3, .022, H), sheet: ok(.24, .02, H), accent: ok(.58, .13, a) },
    tiles: { light: tiles(0), dark: tiles(.06) }, tileHues,
    gems: { light: gemHues.map(h => ok(.84, .16, h)), dark: gemHues.map(h => ok(.84, .16, h)) }, gemHues,
    symbols, style, rad, gloss,
    neutral: { light: ok(.62, .02, H), dark: ok(.55, .02, H) },
  };
}

export const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const SIM = 35;

export function safeTile(t, tile, gem) {
  const g = t.gemHues[gem], gap = i => hueGap(t.tileHues[i], g);
  if (gap(tile) >= SIM) return tile;
  const idx = [0, 1, 2, 3, 4], good = idx.filter(i => gap(i) >= SIM);
  if (good.length) return good.reduce((b, i) => hueGap(t.tileHues[i], t.tileHues[tile]) < hueGap(t.tileHues[b], t.tileHues[tile]) ? i : b);
  return idx.reduce((b, i) => gap(i) > gap(b) ? i : b);
}

export function monoTile(t, gems) {
  const s = hash(t.n * 31 + 7) % 5, order = [0, 1, 2, 3, 4].map(j => (s + j) % 5);
  const score = i => Math.min(180, ...gems.map(g => hueGap(t.tileHues[i], t.gemHues[g])));
  return order.find(i => score(i) >= SIM) ?? order.reduce((b, i) => score(i) > score(b) ? i : b);
}

export function patternPos(kind, r, c) {
  const p = kind === 'rows' ? r / 7 : kind === 'columns' ? c / 7 : kind === 'diagonal' ? (r + c) / 14 : Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)) / 3.5;
  return Math.min(1, Math.max(0, p));
}

export function patternColour(t, scheme, pos) {
  const x = Math.min(1, Math.max(0, pos)) * 4, i = Math.min(3, Math.floor(x)), cs = t.tiles[scheme];
  return `color-mix(in oklch, ${cs[i]} ${Math.round((1 - (x - i)) * 100)}%, ${cs[i + 1]})`;
}

export function symbolSVG(name, style, col, id) {
  const d = SYMBOLS[name], common = 'stroke-linejoin="round" fill-rule="evenodd"';
  const inner = 'transform="translate(12 12) scale(.62) translate(-12 -12)"';
  const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  switch (style) {
    case 'jewel': return svg(`<defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" style="stop-color:#fff"/><stop offset=".35" style="stop-color:${col}"/><stop offset="1" style="stop-color:${col};stop-opacity:.75"/></radialGradient></defs><path d="${d}" style="fill:url(#${id});stroke:rgba(0,0,0,.5)" stroke-width="1.3" ${common}/><circle cx="9" cy="8" r="1.6" style="fill:#fff"/>`);
    case 'line': return svg(`<path d="${d}" style="fill:none;stroke:rgba(0,0,0,.55)" stroke-width="5" ${common}/><path d="${d}" style="fill:none;stroke:${col}" stroke-width="2.6" ${common}/>`);
    case 'duotone': return svg(`<path d="${d}" style="fill:${col};stroke:rgba(0,0,0,.45)" stroke-width="1.4" ${common}/><path d="${d}" ${inner} style="fill:none;stroke:rgba(255,255,255,.85)" stroke-width="1.2" ${common}/>`);
    case 'glow': return svg(`<path d="${d}" style="fill:${col};filter:drop-shadow(0 0 2.5px ${col}) drop-shadow(0 0 1px rgba(0,0,0,.6))" ${common}/>`);
    default: return svg(`<path d="${d}" style="fill:${col};stroke:rgba(0,0,0,.45)" stroke-width="1.4" ${common}/>`);
  }
}
