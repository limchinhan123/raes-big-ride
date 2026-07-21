import * as THREE from 'three';
import { mulberry32, fbm2 } from './prng.js';

// All textures are generated on canvases at load — zero downloaded assets.

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  return { c, x: c.getContext('2d', { willReadFrequently: true }) };
}

function tex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Sobel height->normal. strength ~ 0.6-3.
export function normalFromHeight(srcCanvas, strength = 1.2) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const sctx = srcCanvas.getContext('2d');
  const src = sctx.getImageData(0, 0, w, h).data;
  const { c, x } = canvas(w, h);
  const out = x.createImageData(w, h);
  const hgt = (px, py) => {
    px = (px + w) % w; py = (py + h) % h;
    const i = (py * w + px) * 4;
    return (src[i] + src[i + 1] + src[i + 2]) / 765;
  };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dx = (hgt(px + 1, py) - hgt(px - 1, py)) * strength;
      const dy = (hgt(px, py + 1) - hgt(px, py - 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (py * w + px) * 4;
      out.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      out.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      out.data[i + 2] = inv * 255;
      out.data[i + 3] = 255;
    }
  }
  x.putImageData(out, 0, 0);
  return c;
}

function noiseFill(x, size, fn) {
  const img = x.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const [r, g, b, a] = fn(px, py);
      const i = (py * size + px) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a ?? 255;
    }
  }
  x.putImageData(img, 0, 0);
}

const lerp = (a, b, t) => a + (b - a) * t;
const mixc = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

// ---------- Ground ----------

export function groundGrassTexture() {
  const size = 512;
  const { c, x } = canvas(size);
  const base = [104, 126, 66], lush = [76, 108, 52], dry = [148, 142, 82], moss = [88, 118, 70];
  noiseFill(x, size, (px, py) => {
    const u = px / size, v = py / size;
    // wrap-friendly noise via 2 samples
    const n1 = fbm2(u * 8, v * 8, 4, 11);
    const n2 = fbm2(u * 23 + 40, v * 23, 4, 12);
    const n3 = fbm2(u * 90 + 80, v * 90, 3, 13);
    let col = mixc(base, lush, n1);
    col = mixc(col, dry, Math.max(0, n2 - 0.55) * 1.6);
    col = mixc(col, moss, Math.max(0, 0.45 - n2) * 1.2);
    const fine = (n3 - 0.5) * 46;
    return [col[0] + fine, col[1] + fine, col[2] + fine * 0.8];
  });
  // scatter tiny highlights (blade glints) and clover dots
  const rand = mulberry32(77);
  for (let i = 0; i < 900; i++) {
    const px = rand() * size, py = rand() * size;
    x.fillStyle = rand() < 0.7 ? 'rgba(170,190,90,0.35)' : 'rgba(60,84,40,0.4)';
    x.fillRect(px, py, 1.6, 1.2 + rand() * 1.6);
  }
  return tex(c);
}

export function dirtTexture() {
  const size = 256;
  const { c, x } = canvas(size);
  const a = [128, 106, 82], b = [96, 78, 60], st = [150, 132, 104];
  noiseFill(x, size, (px, py) => {
    const u = px / size, v = py / size;
    const n1 = fbm2(u * 10, v * 10, 4, 21);
    const n2 = fbm2(u * 44, v * 44, 3, 22);
    let col = mixc(a, b, n1);
    col = mixc(col, st, Math.max(0, n2 - 0.6) * 1.5);
    return col;
  });
  return tex(c);
}

export function sandTexture() {
  const size = 256;
  const { c, x } = canvas(size);
  const a = [214, 197, 160], b = [188, 170, 134];
  noiseFill(x, size, (px, py) => {
    const u = px / size, v = py / size;
    const n1 = fbm2(u * 12, v * 12, 4, 31);
    const n2 = fbm2(u * 70, v * 70, 3, 32);
    const col = mixc(a, b, n1 * 0.7 + n2 * 0.3);
    const fine = (n2 - 0.5) * 22;
    return [col[0] + fine, col[1] + fine, col[2] + fine];
  });
  return tex(c);
}

// ---------- Asphalt ----------

export function asphaltTextures() {
  const size = 512;
  const { c, x } = canvas(size);
  const hCan = canvas(size);
  const hx = hCan.x;
  noiseFill(x, size, (px, py) => {
    const u = px / size, v = py / size;
    const n1 = fbm2(u * 6, v * 6, 3, 41);
    const n2 = fbm2(u * 60, v * 60, 3, 42);
    const n3 = fbm2(u * 160, v * 160, 2, 43);
    let g = 96 + (n1 - 0.5) * 26 + (n2 - 0.5) * 18 + (n3 - 0.5) * 26;
    const warm = (n1 - 0.5) * 6;
    return [g + warm, g + warm * 0.4, g + 2 - warm];
  });
  noiseFill(hx, size, (px, py) => {
    const u = px / size, v = py / size;
    const n = fbm2(u * 90, v * 90, 3, 44) * 0.65 + fbm2(u * 18, v * 18, 3, 45) * 0.35;
    const g = n * 255;
    return [g, g, g];
  });
  // sparse fine cracks
  const rand = mulberry32(99);
  x.strokeStyle = 'rgba(48,48,52,0.5)';
  hx.strokeStyle = 'rgba(30,30,30,0.8)';
  for (let i = 0; i < 10; i++) {
    const sx = rand() * size, sy = rand() * size;
    x.beginPath(); hx.beginPath();
    x.moveTo(sx, sy); hx.moveTo(sx, sy);
    let cx2 = sx, cy2 = sy;
    for (let j = 0; j < 5; j++) {
      cx2 += (rand() - 0.5) * 46; cy2 += rand() * 30;
      x.lineWidth = 0.8 + rand(); hx.lineWidth = x.lineWidth;
      x.lineTo(cx2, cy2); hx.lineTo(cx2, cy2);
    }
    x.stroke(); hx.stroke();
  }
  const albedo = tex(c);
  const normal = tex(normalFromHeight(hCan.c, 0.85), { srgb: false });
  return { albedo, normal };
}

// ---------- Vegetation cards ----------

export function grassBladeTexture() {
  const size = 256;
  const { c, x } = canvas(size);
  x.clearRect(0, 0, size, size);
  const rand = mulberry32(7);
  for (let i = 0; i < 17; i++) {
    const baseX = size * (0.18 + rand() * 0.64);
    const lean = (rand() - 0.5) * 90;
    const h = size * (0.55 + rand() * 0.42);
    const w = 5 + rand() * 6;
    const dry = rand() < 0.22;
    const g = x.createLinearGradient(0, size, 0, size - h);
    if (dry) {
      g.addColorStop(0, 'rgb(96,104,46)');
      g.addColorStop(1, 'rgb(168,168,88)');
    } else {
      g.addColorStop(0, 'rgb(52,80,34)');
      g.addColorStop(0.7, 'rgb(96,138,58)');
      g.addColorStop(1, 'rgb(140,178,84)');
    }
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(baseX - w / 2, size);
    x.quadraticCurveTo(baseX - w / 2 + lean * 0.3, size - h * 0.6, baseX + lean, size - h);
    x.quadraticCurveTo(baseX + w / 2 + lean * 0.3, size - h * 0.6, baseX + w / 2, size);
    x.closePath();
    x.fill();
  }
  const t = tex(c, { repeat: false });
  return t;
}

export function flowerTuftTexture() {
  const size = 256;
  const { c, x } = canvas(size);
  x.clearRect(0, 0, size, size);
  const rand = mulberry32(15);
  // stems
  for (let i = 0; i < 8; i++) {
    const baseX = size * (0.25 + rand() * 0.5);
    const h = size * (0.5 + rand() * 0.4);
    const lean = (rand() - 0.5) * 60;
    x.strokeStyle = 'rgb(74,104,48)';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(baseX, size);
    x.quadraticCurveTo(baseX + lean * 0.4, size - h * 0.6, baseX + lean, size - h);
    x.stroke();
    const cx2 = baseX + lean, cy2 = size - h;
    const petal = rand() < 0.5 ? 'rgb(232,142,180)' : (rand() < 0.5 ? 'rgb(246,246,240)' : 'rgb(240,196,90)');
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      x.fillStyle = petal;
      x.beginPath();
      x.ellipse(cx2 + Math.cos(a) * 7, cy2 + Math.sin(a) * 7, 5.5, 3.5, a, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = 'rgb(212,160,60)';
    x.beginPath(); x.arc(cx2, cy2, 3.6, 0, Math.PI * 2); x.fill();
  }
  return tex(c, { repeat: false });
}

export function leafClusterTexture() {
  const size = 256;
  const { c, x } = canvas(size);
  x.clearRect(0, 0, size, size);
  const rand = mulberry32(23);
  const centers = [];
  for (let k = 0; k < 6; k++) centers.push([size * (0.22 + rand() * 0.56), size * (0.22 + rand() * 0.56)]);
  for (let i = 0; i < 620; i++) {
    const ct = centers[(i * 7919) % centers.length];
    const a = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.55) * 62;
    const px = ct[0] + Math.cos(a) * r, py = ct[1] + Math.sin(a) * r * 0.85;
    const shade = rand();
    const col = mixc([54, 84, 38], [134, 166, 82], shade);
    x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
    x.save();
    x.translate(px, py);
    x.rotate(rand() * Math.PI);
    x.beginPath();
    x.ellipse(0, 0, 6.2 + rand() * 4.4, 3.1 + rand() * 2.2, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  return tex(c, { repeat: false });
}

export function frondTexture() {
  const { c, x } = canvas(256, 512);
  x.clearRect(0, 0, 256, 512);
  const rand = mulberry32(31);
  x.strokeStyle = 'rgb(96,118,52)';
  x.lineWidth = 7;
  x.beginPath(); x.moveTo(128, 512); x.quadraticCurveTo(128, 256, 128, 20); x.stroke();
  for (let i = 0; i < 34; i++) {
    const t = i / 34;
    const y = 500 - t * 460;
    const len = 86 * Math.sin(Math.PI * Math.min(1, 0.2 + t)) + 14;
    const droop = 34 * (1 - t * 0.4);
    for (const s of [-1, 1]) {
      const shade = 0.35 + rand() * 0.5;
      const col = mixc([52, 84, 40], [124, 158, 74], shade);
      x.strokeStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      x.lineWidth = 4.5;
      x.beginPath();
      x.moveTo(128, y);
      x.quadraticCurveTo(128 + s * len * 0.55, y + droop * 0.3, 128 + s * len, y + droop);
      x.stroke();
    }
  }
  return tex(c, { repeat: false });
}

export function barkTextures() {
  const size = 256;
  const { c, x } = canvas(size);
  const hCan = canvas(size);
  noiseFill(x, size, (px, py) => {
    const u = px / size, v = py / size;
    const streak = fbm2(u * 26, v * 3.5, 4, 51);
    const blotch = fbm2(u * 6, v * 6, 3, 52);
    let col = mixc([94, 78, 64], [128, 112, 94], streak);
    col = mixc(col, [72, 60, 50], Math.max(0, 0.5 - blotch) * 1.4);
    return col;
  });
  noiseFill(hCan.x, size, (px, py) => {
    const u = px / size, v = py / size;
    const g = fbm2(u * 26, v * 3.5, 4, 51) * 255;
    return [g, g, g];
  });
  return { albedo: tex(c), normal: tex(normalFromHeight(hCan.c, 1.6), { srgb: false }) };
}

// ---------- Sky / clouds ----------

export function cloudPuffTexture() {
  const size = 256;
  const { c, x } = canvas(size);
  x.clearRect(0, 0, size, size);
  const rand = mulberry32(63);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 1.6) * 60;
    const px = 128 + Math.cos(a) * r;
    const py = 132 + Math.sin(a) * r * 0.62 - 8;
    const rad = 26 + rand() * 34;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const bottom = py > 140;
    const tint = bottom ? '214,220,232' : '255,255,255';
    g.addColorStop(0, `rgba(${tint},0.62)`);
    g.addColorStop(1, `rgba(${tint},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  }
  return tex(c, { repeat: false });
}

// ---------- HDB facade ----------

const FACADE_CACHE = new Map();

export function hdbFacade({ floors = 12, bays = 8, body = '#e8e2d8', accent = '#e8a8bc', accent2 = '#7fa8d0', seed = 1 }) {
  const key = `${floors}|${bays}|${body}|${accent}|${accent2}|${seed}`;
  if (FACADE_CACHE.has(key)) return FACADE_CACHE.get(key);
  const W = 1024, H = 1024;
  const { c, x } = canvas(W, H);
  const em = canvas(W, H);
  const ex = em.x;
  const rand = mulberry32(seed * 137 + 5);

  x.fillStyle = body; x.fillRect(0, 0, W, H);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);

  const voidH = H * 0.09;
  const floorH = (H - voidH) / floors;
  const bayW = W / bays;

  // accent columns
  const col1 = Math.floor(rand() * bays), col2 = (col1 + 2 + Math.floor(rand() * (bays - 3))) % bays;
  x.fillStyle = accent; x.fillRect(col1 * bayW, 0, bayW, H - voidH);
  x.fillStyle = accent2; x.fillRect(col2 * bayW, 0, bayW * 0.5, H - voidH);

  for (let f = 0; f < floors; f++) {
    const y0 = f * floorH;
    // slab shadow line under each floor
    x.fillStyle = 'rgba(60,58,54,0.28)';
    x.fillRect(0, y0 + floorH - 3, W, 3);
    x.fillStyle = 'rgba(255,255,255,0.14)';
    x.fillRect(0, y0 + floorH - 6, W, 2);
    for (let b = 0; b < bays; b++) {
      const bx = b * bayW;
      const kind = rand();
      if (kind < 0.62) {
        // window pair
        const wx = bx + bayW * 0.16, wy = y0 + floorH * 0.22, ww = bayW * 0.68, wh = floorH * 0.52;
        x.fillStyle = '#c9cdd2';
        x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        const lit = rand() < 0.16;
        const glass = x.createLinearGradient(0, wy, 0, wy + wh);
        glass.addColorStop(0, '#5d6f83');
        glass.addColorStop(0.5, '#3a4654');
        glass.addColorStop(1, '#2c3540');
        x.fillStyle = glass;
        x.fillRect(wx, wy, ww, wh);
        x.fillStyle = '#c9cdd2';
        x.fillRect(wx + ww * 0.48, wy, 2.5, wh);
        if (rand() < 0.3) { // AC unit on ledge
          x.fillStyle = '#b9b9b4';
          x.fillRect(bx + bayW * 0.62, y0 + floorH * 0.78, bayW * 0.22, floorH * 0.16);
          x.fillStyle = 'rgba(40,40,40,0.5)';
          x.fillRect(bx + bayW * 0.62, y0 + floorH * 0.78, bayW * 0.22, 2);
        }
        if (lit) {
          ex.fillStyle = 'rgb(255,178,92)';
          ex.fillRect(wx, wy, ww, wh);
        }
      } else if (kind < 0.82) {
        // corridor opening with railing
        const wx = bx + bayW * 0.08, wy = y0 + floorH * 0.3, ww = bayW * 0.84, wh = floorH * 0.6;
        x.fillStyle = 'rgba(38,40,46,0.85)';
        x.fillRect(wx, wy, ww, wh);
        x.strokeStyle = '#aeb2b6'; x.lineWidth = 2;
        for (let r = 0; r < 3; r++) {
          const ry = wy + wh * 0.45 + r * wh * 0.16;
          x.beginPath(); x.moveTo(wx, ry); x.lineTo(wx + ww, ry); x.stroke();
        }
        if (rand() < 0.35) {
          // laundry hanging in corridor
          const colors = ['#e88bb0', '#7cc0ee', '#ffd166', '#eef0f2', '#9fdcc0'];
          for (let l = 0; l < 3; l++) {
            x.fillStyle = colors[Math.floor(rand() * colors.length)];
            x.fillRect(wx + ww * (0.15 + l * 0.28), wy + wh * 0.1, ww * 0.14, wh * 0.34);
          }
        }
      } else {
        // service/blank bay with vent
        x.fillStyle = 'rgba(70,72,70,0.2)';
        x.fillRect(bx + bayW * 0.3, y0 + floorH * 0.3, bayW * 0.4, floorH * 0.4);
      }
    }
  }
  // void deck: dark recess + pillars
  x.fillStyle = '#4a4c50';
  x.fillRect(0, H - voidH, W, voidH);
  x.fillStyle = body;
  for (let p = 0; p <= bays; p++) {
    x.fillRect(p * bayW - 8, H - voidH, 16, voidH);
  }
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(0, H - voidH, W, 6);

  // weather streaks
  x.fillStyle = 'rgba(88,84,78,0.08)';
  for (let i = 0; i < 40; i++) {
    const sx = rand() * W;
    x.fillRect(sx, 0, 2 + rand() * 5, H * (0.3 + rand() * 0.7));
  }

  const out = { map: tex(c, { repeat: false }), emissive: tex(em.c, { repeat: false }) };
  FACADE_CACHE.set(key, out);
  return out;
}

// simple concrete for sides/roofs
export function concreteTexture(tint = [226, 222, 214]) {
  const size = 256;
  const { c, x } = canvas(size);
  noiseFill(x, size, (px, py) => {
    const u = px / size, v = py / size;
    const n = fbm2(u * 8, v * 8, 4, 71);
    const f = fbm2(u * 60, v * 60, 2, 72);
    const g = (n - 0.5) * 22 + (f - 0.5) * 10;
    return [tint[0] + g, tint[1] + g, tint[2] + g];
  });
  return tex(c);
}
