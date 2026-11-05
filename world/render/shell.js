/* 渲染层：按表搭房间的壳与灰盒家具（M2，2026-11-05）。实时光照，不烘焙。
   - 地板：rooms 表 tiles.floor 每格一种地面（tiles 表的 floor 类），同类合成一个网格；
   - 墙：tiles.walls 的墙段（tiles 表的 wall 类给高、厚、近墙降低），按四面各成一组网格，好让"墙透"按面淡出；
     近侧（south，镜头一侧）nearLowered 的墙压到 60 厘米（暗黑 2 的做法），门段在房间 door.w 处开口，窗段按 room.window 开洞；
   - 家具：预设里 Model 指向 props 的走模型（另由调用方加载）；shell: / procedural: / 没有模型的，按 objects 表占地出灰盒。
   单位：表里厘米，这里米；原点房间中心，x 向右，z 向镜头。 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* 灰盒配色（ART-BIBLE 第 5 节六色 + 第 9 节明度档：墙最亮、地板中、地毯与家具更暗）；不靠红绿区分 */
const FLOOR = { oak: "#7d5f42", rug: "#b39066", earth: "#6f5a44", grass: "#5c6a44", slab: "#8a8a84", soil: "#4e3b2a" };
const WALL = "#e6d2ad", TRIM = "#6b4a2e";
const BOX = { bookshelf_wall: "#5e4129", notebook_rack: "#7a5638", desk_lamp: "#c9965a", wall_lamp: "#c9965a", card_today: "#e5c08e", door: "#6b4a2e", default: "#8c7a62" };
const LOWERED = 0.6;

const std = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
function box(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; }

export function buildShell(room, tiles) {
  const group = new THREE.Group(); group.name = "shell";
  const T = room.tiles, cell = T.cell / 100, W = room.size.w / 100, D = room.size.d / 100;
  /* 地板 */
  const byKind = {};
  T.floor.forEach((row, r) => row.forEach((k, c) => {
    const g = new THREE.PlaneGeometry(cell, cell); g.rotateX(-Math.PI / 2); g.translate(-W / 2 + (c + 0.5) * cell, 0, -D / 2 + (r + 0.5) * cell);
    (byKind[k] ||= []).push(g);
  }));
  for (const [k, gs] of Object.entries(byKind)) {
    const m = new THREE.Mesh(mergeGeometries(gs), std(FLOOR[k] || "#7d5f42", 0.9)); m.receiveShadow = true; m.name = "floor:" + k; group.add(m);
  }
  /* 墙：按面收集方块，每面一个网格 */
  const sides = { north: [], south: [], west: [], east: [] }, trims = [];
  const win = room.window, door = room.door;
  for (const s of T.walls) {
    const def = tiles.wall[s.type]; if (!def || def.segment === "none") continue;
    const t = def.t / 100, h = (s.side === "south" && def.nearLowered ? LOWERED : def.h / 100);
    const a = s.from * cell, b = s.to * cell;   /* 沿墙方向的起止（米，从该面的起点算） */
    const along = (s.side === "north" || s.side === "south");
    const span = (u0, u1, y0, y1) => {           /* 这一面上 u0..u1、高 y0..y1 的一块 */
      if (u1 - u0 < 1e-4 || y1 - y0 < 1e-4) return;
      const L = u1 - u0, mid = u0 + L / 2;
      if (along) { const x = -W / 2 + mid, z = s.side === "north" ? -D / 2 - t / 2 : D / 2 + t / 2; sides[s.side].push(box(L + (s.side === "north" ? 0 : 0), y1 - y0, t, x, y0, z)); }
      else { const z = -D / 2 + mid, x = s.side === "west" ? -W / 2 - t / 2 : W / 2 + t / 2; sides[s.side].push(box(t, y1 - y0, L, x, y0, z)); }
    };
    if (s.type === "window" && win) {             /* 窗洞：窗台以下、窗顶以上两块，两侧补齐 */
      const z0 = win.z0 / 100 + D / 2, z1 = win.z1 / 100 + D / 2, sill = win.sill / 100, top = win.top / 100;
      span(a, Math.max(a, z0), 0, h); span(Math.min(b, z1), b, 0, h);
      span(Math.max(a, z0), Math.min(b, z1), 0, sill); span(Math.max(a, z0), Math.min(b, z1), top, h);
      const zc = -D / 2 + (z0 + z1) / 2, xw = (s.side === "west" ? -W / 2 - t / 2 : W / 2 + t / 2);
      trims.push(box(t + 0.04, 0.06, z1 - z0 + 0.12, xw, sill - 0.06, zc), box(t + 0.04, 0.06, z1 - z0 + 0.12, xw, top, zc));
    } else if (s.type === "door" && door) {       /* 门洞：按房间 door.w 开口（门段格子可能比门窄） */
      const u = door.x / 100 + W / 2, hw = door.w / 200;
      span(a, Math.max(a, u - hw), 0, h); span(Math.min(b, u + hw), b, 0, h);
    } else span(a, b, 0, h);
  }
  /* 门段两侧若有普通墙已覆盖门宽内的部分，扣掉（门宽 90 大于 50 厘米的门段） */
  if (door) {
    const u0 = door.x / 100 - door.w / 200, u1 = door.x / 100 + door.w / 200;
    sides.south = sides.south.filter((g) => { g.computeBoundingBox(); const bb = g.boundingBox; return !(bb.min.x >= u0 - 1e-3 && bb.max.x <= u1 + 1e-3); });
    sides.south = sides.south.flatMap((g) => {
      g.computeBoundingBox(); const bb = g.boundingBox; if (bb.max.x <= u0 || bb.min.x >= u1) return [g];
      const out = [], y0 = bb.min.y, y1 = bb.max.y, t = bb.max.z - bb.min.z, z = (bb.min.z + bb.max.z) / 2;
      if (bb.min.x < u0) out.push(box(u0 - bb.min.x, y1 - y0, t, (bb.min.x + u0) / 2, y0, z));
      if (bb.max.x > u1) out.push(box(bb.max.x - u1, y1 - y0, t, (u1 + bb.max.x) / 2, y0, z));
      return out;
    });
  }
  /* 四角补柱（墙厚见方），并入相邻的西 / 东墙 */
  const t0 = (tiles.wall.plaster?.t ?? 24) / 100, hN = (tiles.wall.plaster?.h ?? 300) / 100;
  sides.west.push(box(t0, hN, t0, -W / 2 - t0 / 2, 0, -D / 2 - t0 / 2), box(t0, LOWERED, t0, -W / 2 - t0 / 2, 0, D / 2 + t0 / 2));
  sides.east.push(box(t0, hN, t0, W / 2 + t0 / 2, 0, -D / 2 - t0 / 2), box(t0, LOWERED, t0, W / 2 + t0 / 2, 0, D / 2 + t0 / 2));
  const walls = [];
  for (const [side, gs] of Object.entries(sides)) {
    if (!gs.length) continue;
    const m = new THREE.Mesh(mergeGeometries(gs), std(WALL, 0.92)); m.castShadow = true; m.receiveShadow = true; m.name = "wall:" + side; m.userData.side = side;
    group.add(m); walls.push(m);
  }
  if (trims.length) { const m = new THREE.Mesh(mergeGeometries(trims), std(TRIM)); m.castShadow = m.receiveShadow = true; m.name = "trim"; group.add(m); }
  return { group, walls };
}

/* 灰盒家具：objects 表占地（厘米）→ 一个方块；书墙加几道隔板的影子线，地毯只是一片 */
export function greyBox(objectId, obj) {
  const fp = obj?.footprint || { w: 40, d: 40, h: 40 }, w = fp.w / 100, d = fp.d / 100, h = Math.max(0.01, fp.h / 100);
  const g = new THREE.Group(); g.name = "box:" + objectId;
  if (objectId === "rug") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), std("#8e6a4a", 0.95)); m.position.y = 0.006; m.receiveShadow = true; g.add(m); return g;
  }
  const m = new THREE.Mesh(box(w, h, d, 0, 0, 0), std(BOX[objectId] || BOX.default)); m.castShadow = m.receiveShadow = true; g.add(m);
  if (objectId === "bookshelf_wall") {   /* 书墙：正面每层一道深色隔板，读得出是架子 */
    const n = 8, shelves = [];
    for (let i = 1; i < n; i++) shelves.push(box(w - 0.06, 0.025, 0.02, 0, (h / n) * i, d / 2 + 0.005));
    const s = new THREE.Mesh(mergeGeometries(shelves), std("#3a2818")); g.add(s);
  }
  return g;
}
