// World in One Day — Sunday 22 November 2026.
// A deterministic poster drawn with a hand-built rasteriser, bitmap font and
// PNG encoder. Pure Node 22 standard library only; no network, no clock,
// no randomness. Two runs write byte-identical output.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette (index -> [r, g, b]) ----
const PALETTE: Array<[number, number, number]> = [
  [246, 241, 227], // 0 paper
  [27, 42, 65],    // 1 ink (dark navy)
  [255, 255, 255], // 2 white
  [179, 38, 30],   // 3 red
  [22, 50, 79],    // 4 navy
  [14, 124, 123],  // 5 teal
  [224, 123, 57],  // 6 orange
  [166, 124, 0],   // 7 gold
  [46, 125, 50],   // 8 green
  [91, 44, 111],   // 9 purple
  [232, 226, 210], // 10 light grey
  [127, 179, 213], // 11 sky
  [139, 90, 43],   // 12 brown
  [120, 20, 16],   // 13 dark red
  [110, 110, 110], // 14 grey
  [240, 200, 60],  // 15 yellow
  [196, 224, 196], // 16 light green
  [206, 226, 240], // 17 light blue
  [255, 214, 170], // 18 light orange
  [255, 240, 200], // 19 light gold
  [232, 200, 220], // 20 light purple
  [31, 78, 121],   // 21 steel blue
  [214, 84, 0],    // 22 deep orange
  [90, 90, 90],    // 23 dark grey
  [250, 230, 120], // 24 pale yellow
  [60, 60, 60],    // 25 charcoal
];
const PAPER = 0, INK = 1, WHITE = 2, RED = 3, NAVY = 4, TEAL = 5, ORANGE = 6,
  GOLD = 7, GREEN = 8, PURPLE = 9, LGREY = 10, SKY = 11, BROWN = 12,
  DRED = 13, GREY = 14, YELLOW = 15, LGREEN = 16, LBLUE = 17, LORANGE = 18,
  LGOLD = 19, LPURPLE = 20, STEEL = 21, DORANGE = 22, DGREY = 23,
  PYELLOW = 24, CHAR = 25;

// ---- 5x7 bitmap font ("#" = on, "." = off) ----
const FONT: Record<string, string[]> = {
  A: ["..#..", ".#.#.", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".....", ".##..", ".....", ".....", "....."],
  ";": [".....", ".##..", ".....", ".##..", ".##..", ".#...", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".####", ".....", ".####", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
};
const BLANK: string[] = [".....", ".....", ".....", ".....", ".....", ".....", "....."];

// ---- CRC32 (PNG chunk checksums) ----
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

// ---- indexed canvas ----
const px = new Uint8Array(W * H).fill(PAPER);
function setPix(x: number, y: number, ci: number): void {
  if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = ci;
}
function fillRect(x: number, y: number, w: number, h: number, ci: number): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) px.fill(ci, yy * W + x0, yy * W + x1);
}
function rectOutline(x: number, y: number, w: number, h: number, t: number, ci: number): void {
  fillRect(x, y, w, t, ci);
  fillRect(x, y + h - t, w, t, ci);
  fillRect(x, y, t, h, ci);
  fillRect(x + w - t, y, t, h, ci);
}
function line(x0: number, y0: number, x1: number, y1: number, ci: number): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    setPix(x, y, ci);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, ci: number): void {
  const r = Math.floor(w / 2);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    fillRect(x - r, y - r, 2 * r + 1, 2 * r + 1, ci);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function fillCircle(cx: number, cy: number, r: number, ci: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - dx, cy + dy, 2 * dx + 1, 1, ci);
  }
}
function circleOutline(cx: number, cy: number, r: number, ci: number): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPix(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), ci);
  }
}
function ellipseOutline(cx: number, cy: number, rx: number, ry: number, ci: number): void {
  let px0 = -1, py0 = -1;
  for (let a = 0; a <= 360; a += 3) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + rx * Math.cos(rad)), y = Math.round(cy + ry * Math.sin(rad));
    if (px0 >= 0) line(px0, py0, x, y, ci);
    px0 = x; py0 = y;
  }
}
function fillPoly(pts: Array<[number, number]>, ci: number): void {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) fillRect(xs[k], y, xs[k + 1] - xs[k] + 1, 1, ci);
  }
}

// ---- text ----
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, ci: number): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? BLANK;
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === "#") fillRect(cx + c * scale, y + r * scale, scale, scale, ci);
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, ci: number): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, ci);
}
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur === "" ? w : cur + " " + w;
    if (textWidth(cand, scale) <= maxW) cur = cand;
    else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---- PNG encode (8-bit palette, filter 0 rows) ----
function encodePNG(): Buffer {
  const raw = Buffer.alloc((W + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0;
    Buffer.from(px.subarray(y * W, (y + 1) * W)).copy(raw, y * (W + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // colour type: palette
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const plte = Buffer.alloc(PALETTE.length * 3);
  PALETTE.forEach(([r, g, b], i) => { plte[i * 3] = r; plte[i * 3 + 1] = g; plte[i * 3 + 2] = b; });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("PLTE", plte),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- pictograms, each drawn inside an 84x84 box at (bx, by) ----

// 1. Climate: thermometer under a hot sun.
function iconClimate(bx: number, by: number): void {
  fillCircle(bx + 62, by + 16, 10, YELLOW);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    line(bx + 62 + Math.round(14 * Math.cos(a)), by + 16 + Math.round(14 * Math.sin(a)),
      bx + 62 + Math.round(19 * Math.cos(a)), by + 16 + Math.round(19 * Math.sin(a)), YELLOW);
  }
  fillRect(bx + 18, by + 14, 12, 44, WHITE);
  rectOutline(bx + 18, by + 14, 12, 44, 2, INK);
  fillRect(bx + 21, by + 34, 6, 24, RED);
  fillCircle(bx + 24, by + 62, 11, RED);
  fillCircle(bx + 24, by + 62, 6, DRED);
  line(bx + 34, by + 26, bx + 44, by + 26, INK);
  line(bx + 34, by + 38, bx + 44, by + 38, INK);
  line(bx + 34, by + 50, bx + 44, by + 50, INK);
}

// 2. Gulf: missile streaking past a burst.
function iconGulf(bx: number, by: number): void {
  const cx = bx + 42, cy = by + 40;
  const burst: Array<[number, number]> = [];
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    const r = k % 2 === 0 ? 30 : 15;
    burst.push([cx + Math.round(r * Math.cos(a)), cy + Math.round(r * Math.sin(a))]);
  }
  fillPoly(burst, YELLOW);
  fillCircle(cx, cy, 12, ORANGE);
  fillCircle(cx, cy, 6, DRED);
  thickLine(bx + 6, by + 74, bx + 40, by + 52, 5, GREY);
  fillPoly([[bx + 40, by + 46], [bx + 52, by + 52], [bx + 40, by + 58]], RED);
  thickLine(bx + 6, by + 74, bx + 24, by + 74, 3, LGREY);
}

// 3. Mexico: a sheriff's star badge.
function iconBadge(bx: number, by: number): void {
  const cx = bx + 42, cy = by + 42;
  const star: Array<[number, number]> = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 === 0 ? 32 : 14;
    star.push([cx + Math.round(r * Math.cos(a)), cy + Math.round(r * Math.sin(a))]);
  }
  fillPoly(star, GOLD);
  fillCircle(cx, cy, 13, NAVY);
  fillCircle(cx, cy, 8, WHITE);
  fillCircle(cx, cy, 4, NAVY);
}

// 4. Ukraine: a shelled apartment block with smoke.
function iconBlock(bx: number, by: number): void {
  fillRect(bx + 20, by + 30, 44, 44, STEEL);
  rectOutline(bx + 20, by + 30, 44, 44, 2, INK);
  for (const wy of [36, 48, 60]) {
    fillRect(bx + 26, by + wy, 8, 7, PYELLOW);
    fillRect(bx + 50, by + wy, 8, 7, PYELLOW);
  }
  thickLine(bx + 42, by + 30, bx + 30, by + 48, 3, INK);
  thickLine(bx + 30, by + 48, bx + 44, by + 62, 3, INK);
  fillCircle(bx + 30, by + 16, 8, GREY);
  fillCircle(bx + 44, by + 10, 10, LGREY);
  fillCircle(bx + 58, by + 16, 7, GREY);
}

// 5. Space: Mercury with its orbit ring and a small craft.
function iconMercury(bx: number, by: number): void {
  ellipseOutline(bx + 42, by + 46, 36, 14, SKY);
  fillCircle(bx + 42, by + 46, 20, ORANGE);
  fillCircle(bx + 36, by + 40, 4, BROWN);
  fillCircle(bx + 50, by + 50, 5, BROWN);
  fillCircle(bx + 46, by + 38, 3, BROWN);
  circleOutline(bx + 42, by + 46, 20, DORANGE);
  fillRect(bx + 64, by + 12, 12, 8, WHITE);
  rectOutline(bx + 64, by + 12, 12, 8, 1, INK);
  fillRect(bx + 58, by + 14, 6, 4, SKY);
  fillRect(bx + 76, by + 14, 6, 4, SKY);
  fillCircle(bx + 70, by + 26, 2, YELLOW);
  fillCircle(bx + 14, by + 12, 2, WHITE);
  fillCircle(bx + 20, by + 70, 2, WHITE);
  fillCircle(bx + 74, by + 68, 2, WHITE);
}

// 6. Indonesia: flame over a factory.
function iconFire(bx: number, by: number): void {
  fillRect(bx + 16, by + 52, 52, 22, DGREY);
  fillRect(bx + 22, by + 34, 8, 18, DGREY);
  fillCircle(bx + 26, by + 28, 6, LGREY);
  fillCircle(bx + 34, by + 22, 7, GREY);
  fillRect(bx + 24, by + 58, 8, 8, PYELLOW);
  fillRect(bx + 52, by + 58, 8, 8, PYELLOW);
  fillPoly([
    [bx + 42, by + 8], [bx + 52, by + 26], [bx + 58, by + 20],
    [bx + 60, by + 40], [bx + 48, by + 52], [bx + 34, by + 52],
    [bx + 26, by + 40], [bx + 32, by + 28], [bx + 30, by + 20],
  ], DORANGE);
  fillPoly([
    [bx + 42, by + 26], [bx + 48, by + 36], [bx + 50, by + 44],
    [bx + 42, by + 50], [bx + 34, by + 44], [bx + 36, by + 34],
  ], YELLOW);
}

// ---- poster layout ----
interface Story {
  num: string;
  kicker: string;
  accent: number;
  tint: number;
  title: string;
  caption: string;
  foot: string;
  icon: (bx: number, by: number) => void;
}

const STORIES: Story[] = [
  {
    num: "1", kicker: "CLIMATE - ANTALYA", accent: GREEN, tint: LGREEN,
    title: "COP31 ENDS WITH NO DEAL",
    caption: "Climate talks in Antalya end with no deal as the EU rejects a draft that never mentions fossil fuels.",
    foot: "NO DEAL AFTER TWO DAYS OF OVERTIME",
    icon: iconClimate,
  },
  {
    num: "2", kicker: "GULF - BAHRAIN", accent: RED, tint: LORANGE,
    title: "IRAN STRIKES BAHRAIN",
    caption: "Missiles hit an industrial site in Bahrain, injuring two, as tankers are struck near the Strait of Hormuz.",
    foot: "GULF SHIPPING AND OIL ON EDGE",
    icon: iconGulf,
  },
  {
    num: "3", kicker: "MEXICO - SINALOA", accent: GOLD, tint: LGOLD,
    title: "CARTEL BOSS CAPTURED",
    caption: "Troops seize 'El Chapo Isidro' in Sinaloa. Eleven die in the raid, including four soldiers.",
    foot: "A BLOW TO THE BELTRAN LEYVA CARTEL",
    icon: iconBadge,
  },
  {
    num: "4", kicker: "UKRAINE - KYIV REGION", accent: STEEL, tint: LBLUE,
    title: "DRONE HITS KYIV FLATS",
    caption: "A Russian drone collapses a five-storey block in Dymer, near Kyiv. Fourteen people are missing in the rubble.",
    foot: "THE WAR GRINDS ON INTO WINTER",
    icon: iconBlock,
  },
  {
    num: "5", kicker: "SPACE - MERCURY", accent: PURPLE, tint: LPURPLE,
    title: "BEPICOLOMBO REACHES MERCURY",
    caption: "After an eight-year cruise, the ESA-JAXA craft enters orbit around Mercury. A thruster glitch is under study.",
    foot: "SCIENCE STARTS IN APRIL 2027",
    icon: iconMercury,
  },
  {
    num: "6", kicker: "INDONESIA - CIKANDE", accent: DORANGE, tint: LORANGE,
    title: "FACTORY FIRE KILLS THREE",
    caption: "A blaze at a candy factory in Cikande leaves three workers dead and dozens more missing.",
    foot: "RESCUERS STILL SEARCH THE RUINS",
    icon: iconFire,
  },
];

function drawPanel(s: Story, x0: number, y0: number, w: number, h: number): void {
  fillRect(x0, y0, w, h, WHITE);
  rectOutline(x0, y0, w, h, 3, INK);
  fillRect(x0 + 3, y0 + 3, 10, h - 6, s.accent);
  // kicker: number disc + category
  fillCircle(x0 + 30, y0 + 24, 11, s.accent);
  drawText(s.num, x0 + 26, y0 + 17, 2, WHITE);
  drawText(s.kicker, x0 + 48, y0 + 17, 2, s.accent);
  // title (2 lines max), leaving room for the pictogram on the right
  const titleLines = wrapText(s.title, w - 22 - 108, 3);
  titleLines.slice(0, 2).forEach((ln, i) => drawText(ln, x0 + 22, y0 + 46 + i * 24, 3, INK));
  // pictogram
  s.icon(x0 + w - 102, y0 + 40);
  // caption
  const capLines = wrapText(s.caption, w - 44, 2);
  capLines.slice(0, 4).forEach((ln, i) => drawText(ln.toUpperCase(), x0 + 22, y0 + 118 + i * 16, 2, CHAR));
  // bottom strip
  fillRect(x0 + 3, y0 + h - 48, w - 6, 45, s.tint);
  fillRect(x0 + 3, y0 + h - 48, w - 6, 3, s.accent);
  drawTextCentered(s.foot, x0 + Math.floor(w / 2), y0 + h - 32, 2, s.accent);
}

function drawPoster(): void {
  fillRect(0, 0, W, H, PAPER);
  rectOutline(0, 0, W, H, 8, INK);
  // masthead
  drawTextCentered("THE WORLD IN ONE DAY", Math.floor(W / 2), 28, 5, INK);
  drawTextCentered("SIX STORIES FROM AROUND THE GLOBE", Math.floor(W / 2), 72, 2, DGREY);
  // date band
  fillRect(20, 96, W - 40, 56, RED);
  drawTextCentered("SUNDAY 22 NOVEMBER 2026", Math.floor(W / 2), 112, 5, WHITE);
  // story grid: 2 columns x 3 rows
  const gx = 20, gy = 166, gap = 12, pw = 486, ph = 266;
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    drawPanel(STORIES[i], gx + col * (pw + gap), gy + row * (ph + gap), pw, ph);
  }
  // footer
  drawTextCentered("SOURCES: REUTERS - AP - AFP - AL JAZEERA - ESA", Math.floor(W / 2), 998, 2, DGREY);
}

function main(): void {
  drawPoster();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
