/* 渲染层：按表搭房间的壳与灰盒家具（M2，2026-11-05）。实时光照，不烘焙。
   - 地板：rooms 表 tiles.floor 每格一种地面（tiles 表的 floor 类），同类合成一个网格；被套在里面的房间盖住的格不画（院子里屋子底下）；
   - 墙：tiles.walls 的墙段（tiles 表的 wall 类给高、厚、近墙降低、是否开口），按四面各成一组网格，好让"墙透"按面淡出；
     近侧（south，镜头一侧）nearLowered 的墙压到 60 厘米（暗黑 2 的做法），门段在房间 door.w 处开口，窗段按 room.window 开洞，opening 段（院门）只立两根门柱；
   - 同时交出挡路范围 blocks（厘米，场地坐标），给寻路网用；
   - 家具：预设里 Model 指向 props 的走模型（另由调用方加载）；shell: / procedural: / 没有模型的、以及没有预设的房间的固定槽，按 objects 表占地出灰盒。
   单位：表里厘米，这里米；原点房间中心，x 向右，z 向镜头。opts.offset 是本房原点在场地里的位置（厘米）。 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* 灰盒配色（ART-BIBLE 第 5 节六色 + 第 9 节明度档：墙最亮、地板中、地毯与家具更暗）；不靠红绿区分 */
const FLOOR = { oak: "#7d5f42", rug: "#b39066", earth: "#7a6450", grass: "#66704c", slab: "#94918a", soil: "#4e3b2a" };
const WALL = { plaster: "#e6d2ad", window: "#e6d2ad", door: "#e6d2ad", rammed: "#b08c66", fence: "#9a8a5a", gate: "#6b4a2e" };
const TRIM = "#6b4a2e";
const BOX = { bookshelf_wall: "#5e4129", notebook_rack: "#7a5638", desk_lamp: "#c9965a", wall_lamp: "#c9965a", card_today: "#e5c08e", door: "#6b4a2e",
              bench: "#7a5638", mailbox: "#5e4129", default: "#8c7a62" };
const LOWERED = 0.6;

const std = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
function box(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; }

export function buildShell(room, tiles, opts = {}) {
  const off = opts.offset || [0, 0], skip = opts.skip || [];
  const group = new THREE.Group(); group.name = "shell:" + room.id; group.position.set(off[0] / 100, 0, off[1] / 100);
  const T = room.tiles, cell = T.cell / 100, W = room.size.w / 100, D = room.size.d / 100;
  /* 地板（跳过被套着的房间盖住的格） */
  const byKind = {};
  T.floor.forEach((row, r) => row.forEach((k, c) => {
    const cx = -W / 2 + (c + 0.5) * cell, cz = -D / 2 + (r + 0.5) * cell;
    if (skip.some((s) => cx * 100 > s.x0 && cx * 100 < s.x1 && cz * 100 > s.z0 && cz * 100 < s.z1)) return;
    const g = new THREE.PlaneGeometry(cell, cell); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz); (byKind[k] ||= []).push(g);
  }));
  for (const [k, gs] of Object.entries(byKind)) {
    const m = new THREE.Mesh(mergeGeometries(gs), std(FLOOR[k] || "#7d5f42", 0.9)); m.receiveShadow = true; m.name = "floor:" + k; group.add(m);
  }
  /* 墙：按面收集方块 { 几何, 颜色 }，每面每种颜色一个网格 */
  const sides = { north: [], south: [], west: [], east: [] }, trims = [];
  const win = room.window, door = room.door;
  for (const s of T.walls) {
    const def = tiles.wall[s.type]; if (!def || def.segment === "none") continue;
    const t = def.t / 100, h = (s.side === "south" && def.nearLowered ? LOWERED : def.h / 100), col = WALL[s.type] || WALL.plaster;
    const a = s.from * cell, b = s.to * cell, along = (s.side === "north" || s.side === "south");
    const at = (u, y0, y1, L, tt = t) => along                    /* 这一面上中心 u、长 L、高 y0..y1 的一块 */
      ? box(L, y1 - y0, tt, -W / 2 + u, y0, s.side === "north" ? -D / 2 - t / 2 : D / 2 + t / 2)
      : box(tt, y1 - y0, L, s.side === "west" ? -W / 2 - t / 2 : W / 2 + t / 2, y0, -D / 2 + u);
    const span = (u0, u1, y0, y1) => { if (u1 - u0 > 1e-4 && y1 - y0 > 1e-4) sides[s.side].push({ g: at((u0 + u1) / 2, y0, y1, u1 - u0), col }); };
    if (def.opening) {                                            /* 院门：开口，两端各一根门柱 */
      const p = Math.min(t, 0.3); sides[s.side].push({ g: at(a + p / 2, 0, h, p, p), col }, { g: at(b - p / 2, 0, h, p, p), col });
    } else if (s.type === "window" && win) {                      /* 窗洞：窗台以下、窗顶以上两块，两侧补齐 */
      const z0 = win.z0 / 100 + D / 2, z1 = win.z1 / 100 + D / 2, sill = win.sill / 100, top = win.top / 100;
      span(a, Math.max(a, z0), 0, h); span(Math.min(b, z1), b, 0, h);
      span(Math.max(a, z0), Math.min(b, z1), 0, sill); span(Math.max(a, z0), Math.min(b, z1), top, h);
      const zc = -D / 2 + (z0 + z1) / 2, xw = (s.side === "west" ? -W / 2 - t / 2 : W / 2 + t / 2);
      trims.push(box(t + 0.04, 0.06, z1 - z0 + 0.12, xw, sill - 0.06, zc), box(t + 0.04, 0.06, z1 - z0 + 0.12, xw, top, zc));
    } else if (s.type === "door" && door) {                       /* 门洞：按房间 door.w 开口（门段格子可能比门窄） */
      const u = door.x / 100 + W / 2, hw = door.w / 200;
      span(a, Math.max(a, u - hw), 0, h); span(Math.min(b, u + hw), b, 0, h);
    } else span(a, b, 0, h);
  }
  /* 门宽大于门段格时，相邻墙段伸进门洞的部分扣掉 */
  if (door) {
    const u0 = door.x / 100 - door.w / 200, u1 = door.x / 100 + door.w / 200;
    sides.south = sides.south.flatMap((it) => {
      const g = it.g; g.computeBoundingBox(); const bb = g.boundingBox; if (bb.max.x <= u0 + 1e-4 || bb.min.x >= u1 - 1e-4) return [it];
      const out = [], y0 = bb.min.y, y1 = bb.max.y, tt = bb.max.z - bb.min.z, z = (bb.min.z + bb.max.z) / 2;
      if (bb.min.x < u0) out.push({ g: box(u0 - bb.min.x, y1 - y0, tt, (bb.min.x + u0) / 2, y0, z), col: it.col });
      if (bb.max.x > u1) out.push({ g: box(bb.max.x - u1, y1 - y0, tt, (u1 + bb.max.x) / 2, y0, z), col: it.col });
      return out;
    });
  }
  /* 四角补柱（墙厚见方），并入相邻的西 / 东墙 */
  const cw = T.walls.find((w) => w.side === "north"), cdef = tiles.wall[cw?.type] || tiles.wall.plaster || { t: 24, h: 300 };
  if (cdef.segment !== "none") {
    const t0 = cdef.t / 100, hN = cdef.h / 100, col = WALL[cw?.type] || WALL.plaster, sw = T.walls.find((w) => w.side === "south"), low = tiles.wall[sw?.type]?.nearLowered ? LOWERED : hN;
    sides.west.push({ g: box(t0, hN, t0, -W / 2 - t0 / 2, 0, -D / 2 - t0 / 2), col }, { g: box(t0, low, t0, -W / 2 - t0 / 2, 0, D / 2 + t0 / 2), col });
    sides.east.push({ g: box(t0, hN, t0, W / 2 + t0 / 2, 0, -D / 2 - t0 / 2), col }, { g: box(t0, low, t0, W / 2 + t0 / 2, 0, D / 2 + t0 / 2), col });
  }
  const walls = [], blocks = [];
  for (const [side, items] of Object.entries(sides)) {
    const byCol = {};
    for (const it of items) {
      (byCol[it.col] ||= []).push(it.g); it.g.computeBoundingBox(); const bb = it.g.boundingBox;
      blocks.push({ x0: bb.min.x * 100 + off[0], x1: bb.max.x * 100 + off[0], z0: bb.min.z * 100 + off[1], z1: bb.max.z * 100 + off[1] });
    }
    for (const [col, gs] of Object.entries(byCol)) {
      const m = new THREE.Mesh(mergeGeometries(gs), std(col, 0.92)); m.castShadow = true; m.receiveShadow = true; m.name = `wall:${room.id}:${side}`; m.userData.side = side;
      group.add(m); walls.push(m);
    }
  }
  if (trims.length) { const m = new THREE.Mesh(mergeGeometries(trims), std(TRIM)); m.castShadow = m.receiveShadow = true; m.name = "trim"; group.add(m); }
  return { group, walls, blocks, rect: { x0: off[0] - room.size.w / 2, x1: off[0] + room.size.w / 2, z0: off[1] - room.size.d / 2, z1: off[1] + room.size.d / 2 } };
}

/* 灰盒家具：objects 表占地（厘米）→ 一个方块；书墙加隔板线，地毯一片，树是树干加树冠，长椅、信箱有腿 */
export function greyBox(objectId, obj) {
  const fp = obj?.footprint || { w: 40, d: 40, h: 40 }, w = fp.w / 100, d = fp.d / 100, h = Math.max(0.01, fp.h / 100);
  const g = new THREE.Group(); g.name = "box:" + objectId; g.userData.objectId = objectId;   /* 标记：调用方会改名，挡人淡出按这个找 */
  const add = (geo, col, r) => { const m = new THREE.Mesh(geo, std(col, r)); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  if (objectId === "rug") { const m = add(new THREE.BoxGeometry(w, 0.012, d), "#8e6a4a", 0.95); m.position.y = 0.006; m.castShadow = false; return g; }
  if (objectId === "tree") {
    add(new THREE.CylinderGeometry(0.12, 0.18, h * 0.55, 10).translate(0, h * 0.275, 0), "#5a4330");
    add(new THREE.IcosahedronGeometry(Math.min(w, d) * 0.55, 1).scale(1, 0.85, 1).translate(0, h * 0.72, 0), "#5b6b3e", 0.95);
    return g;
  }
  if (objectId === "bench") { add(box(w, 0.06, d, 0, h - 0.06, 0), BOX.bench); for (const sx of [-1, 1]) add(box(0.06, h - 0.06, d * 0.8, sx * (w / 2 - 0.08), 0, 0), BOX.bench); return g; }
  if (objectId === "mailbox") { add(box(0.06, h * 0.7, 0.06, 0, 0, 0), BOX.mailbox); add(box(w, h * 0.3, d, 0, h * 0.7, 0), "#3f5a6e"); return g; }
  add(box(w, h, d, 0, 0, 0), BOX[objectId] || BOX.default);
  if (objectId === "bookshelf_wall") {   /* 书墙：正面每层一道深色隔板，读得出是架子 */
    const n = 8, shelves = [];
    for (let i = 1; i < n; i++) shelves.push(box(w - 0.06, 0.025, 0.02, 0, (h / n) * i, d / 2 + 0.005));
    g.add(new THREE.Mesh(mergeGeometries(shelves), std("#3a2818")));
  }
  return g;
}

/* 没有预设的房间（院子）：固定槽按 objects 表出灰盒，放在槽位中心、按槽位朝向 */
export function slotBoxes(room, objects, offset = [0, 0]) {
  const group = new THREE.Group(); group.name = "slots:" + room.id;
  for (const s of room.slots || []) {
    if (!s.fixed) continue; const o = greyBox(s.fixed, objects[s.fixed]);
    o.position.set((s.x + offset[0]) / 100, 0, (s.z + offset[1]) / 100); o.rotation.y = THREE.MathUtils.degToRad(s.rot || 0); group.add(o);
  }
  return group;
}
