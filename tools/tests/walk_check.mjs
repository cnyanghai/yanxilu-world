// 人形巡检（PIPELINE 1.5，2026-11-05）：标准角色在真实模型里走一遍。不开浏览器，Node 18 即可。
// 用法：node tools/tests/walk_check.mjs [房间=camp] [--as-placed]（默认门这类交互物件按 Interact.walk 状态，即角色走近时推开的样子）
//   1. 读房间、预设、预制体、散布表、模型（glTF 里的三角面），在 2.5 厘米的采样网格上算每点的地面高、挡身体的东西、头顶最低的东西；
//      透明裁切的材质（散草、草丛）不挡；kind 为 prop 的件（篝火、灯笼）按包围盒整块算。
//   2. 按引擎的寻路格（rooms 表 grid.cell，world/sim/grid.js 的 Grid）判每格能不能站：角色圆柱半径内全部可站、头顶净空 ≥ 身高。
//   3. 检查：出发点到每个目标点有路（Grid.astar）；所有能站的格都走得到（没有被围死的孤岛）；把每个能走的格走一遍（巡检路线）；
//      门洞净高 ≥ 身高 × doorClearance；没有能站的格落在地面之外；落地的建筑件不悬空、不陷地。
//   4. 出 tools/out/<房间>/walk_check.json 与俯视图 walk_check.png（上为屋后、下为正面，和游戏镜头同一左右）。任何一项不过，退出码 1。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Grid } from "../../world/sim/grid.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const W = (p) => JSON.parse(readFileSync(join(ROOT, "world", p), "utf8"));
const args = process.argv.slice(2), ROOM_ID = args.find((a) => !a.startsWith("--")) || "camp", AS_PLACED = args.includes("--as-placed");   /* 默认交互物件按 Interact.walk 状态（门推开）；--as-placed 按摆放原样 */
const rooms = W("data/rooms.json").rooms, room = rooms.find((r) => r.id === ROOM_ID);
const props = W("data/props.json").assets, chars = W("data/characters.json");
const preset = W(`data/presets/${room.preset}.json`), walk = room.walk;
const col = chars.skeletons[walk.skeleton || "humanoid"].collider;
const CH = col.height / 100, RAD = col.radius / 100, STEP = col.maxStep / 100, DOOR_H = CH * (col.doorClearance || 1.3);
const RES = 0.025, SW = room.size.w / 100, SD = room.size.d / 100, NX = Math.round(SW / RES), NZ = Math.round(SD / RES);

/* ---------- 小矩阵（列主序，同 three） ---------- */
const compose = (t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) => {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0, (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
          (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
};
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const deg = (d) => (d * Math.PI) / 180, quatY = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
function tMatrix(t = {}) {
  const q = t.q || (t.rotY ? quatY(deg(t.rotY)) : [0, 0, 0, 1]);
  return compose([(t.x || 0) / 100, (t.y || 0) / 100, (t.z || 0) / 100], q, t.s || (t.scale ? [t.scale, t.scale, t.scale] : [1, 1, 1]));
}

/* ---------- 模型：glTF（内嵌 buffer）→ 本地坐标的三角面，透明裁切的跳过 ---------- */
const meshCache = {};
function triangles(id) {
  if (meshCache[id]) return meshCache[id];
  const a = props[id]; if (!a) throw new Error("props 里没有 " + id);
  const g = W(a.model), buf = Buffer.from(g.buffers[0].uri.split(",")[1], "base64");
  const read = (ai) => {
    const acc = g.accessors[ai], bv = g.bufferViews[acc.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    const size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType], stride = bv.byteStride || n * size, off = (bv.byteOffset || 0) + (acc.byteOffset || 0), out = [];
    for (let i = 0; i < acc.count; i++) { const row = []; for (let k = 0; k < n; k++) { const o = off + i * stride + k * size;
      row.push(acc.componentType === 5126 ? buf.readFloatLE(o) : acc.componentType === 5125 ? buf.readUInt32LE(o) : acc.componentType === 5123 ? buf.readUInt16LE(o) : buf.readUInt8(o)); } out.push(n === 1 ? row[0] : row); }
    return out;
  };
  const tris = [];
  const walkNode = (ni, parent) => {
    const nd = g.nodes[ni], m = mul(parent, nd.matrix || compose(nd.translation, nd.rotation, nd.scale));
    if (nd.mesh !== undefined) for (const pr of g.meshes[nd.mesh].primitives) {
      if (g.materials?.[pr.material]?.alphaMode === "MASK") continue;            /* 散草、草丛：不挡人 */
      const P = read(pr.attributes.POSITION).map((p) => apply(m, p)), I = pr.indices !== undefined ? read(pr.indices) : P.map((_, i) => i);
      for (let i = 0; i < I.length; i += 3) tris.push([P[I[i]], P[I[i + 1]], P[I[i + 2]]]);
    }
    for (const c of nd.children || []) walkNode(c, m);
  };
  for (const ni of g.scenes[g.scene || 0].nodes) walkNode(ni, compose());
  return (meshCache[id] = { tris, kind: a.kind });
}

/* ---------- 场景实例 ---------- */
const inst = []; let groundExtent = 0;
for (const e of preset.entities) {
  const c = e.components, M = tMatrix(c.Transform);
  if (c.Prefab) {
    const pf = W(c.Prefab.file.replace(/^\.?\//, ""));
    for (const pe of pf.entities) if (pe.components.Model) {
      let t = pe.components.Transform; const I = pe.components.Interact;
      if (I && !AS_PLACED && I.walk && I.states?.[I.walk]) { const { q, ...rest } = t; t = { ...rest, rotY: I.states[I.walk].rotY }; }   /* 交互物件换成走近时的状态 */
      inst.push({ id: pe.id, model: pe.components.Model.file, m: mul(M, tMatrix(t)) });
    }
  }
  if (c.Model) inst.push({ id: e.id, model: c.Model.file, m: M });
  if (c.Ground) groundExtent = (c.Ground.extent || c.Ground.size) / 100;
  if (c.Scatter) {
    const SC = W(c.Scatter.file), flip = c.Scatter.axes === "blender" ? -1 : 1;
    for (const [cat, ids] of Object.entries(c.Scatter.models)) (SC[cat] || []).forEach((r, i) => {
      const v = (r.length > 4 ? r[4] : 0) % ids.length, z = r[3];
      const s = cat === "tufts" ? [z, z, z] : cat === "stones" ? [z, z, z * 0.8] : [z, 1, z];
      inst.push({ id: `${cat}${i}`, model: ids[v], m: mul(M, compose([r[0], 0, flip * r[1]], quatY(deg(r[2])), s)) });
    });
  }
}

/* ---------- 采样网格：每个实例在每个采样点的竖向占用区间 [低, 高]，按实例合并 ---------- */
const spans = new Array(NX * NZ);   /* 每点 [[低, 高, 实例序号], ...] */
const ix = (x) => Math.floor((x + SW / 2) / RES), iz = (z) => Math.floor((z + SD / 2) / RES);
const sx = (i) => -SW / 2 + (i + 0.5) * RES, sz = (j) => -SD / 2 + (j + 0.5) * RES;
const placed = [];
inst.forEach((it, k) => {
  const { tris, kind } = triangles(it.model), W3 = tris.map((t) => t.map((p) => apply(it.m, p)));
  let lo = Infinity, hi = -Infinity; for (const t of W3) for (const p of t) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
  placed.push({ id: it.id, model: it.model, kind, minY: lo, maxY: hi });
  const local = new Map(), put = (i, j, y0, y1) => { if (i < 0 || j < 0 || i >= NX || j >= NZ) return; const key = j * NX + i, s = local.get(key); if (s) { s[0] = Math.min(s[0], y0); s[1] = Math.max(s[1], y1); } else local.set(key, [y0, y1]); };
  if (kind === "prop") {   /* 道具按包围盒整块（篝火不许走进去；灯笼挂在头顶） */
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const t of W3) for (const p of t) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    for (let j = iz(z0); j <= iz(z1); j++) for (let i = ix(x0); i <= ix(x1); i++) put(i, j, lo, hi);
  } else for (const [a, b, c] of W3) {
    const ar = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]); if (Math.abs(ar) < 1e-9) continue;   /* 竖直面：封闭体的顶底面已覆盖 */
    const i0 = ix(Math.min(a[0], b[0], c[0])), i1 = ix(Math.max(a[0], b[0], c[0])), j0 = iz(Math.min(a[2], b[2], c[2])), j1 = iz(Math.max(a[2], b[2], c[2]));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = sx(i), pz = sz(j);
      const w1 = ((b[0] - px) * (c[2] - pz) - (c[0] - px) * (b[2] - pz)) / ar, w2 = ((c[0] - px) * (a[2] - pz) - (a[0] - px) * (c[2] - pz)) / ar, w3 = 1 - w1 - w2;
      if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
      const y = w1 * a[1] + w2 * b[1] + w3 * c[1]; put(i, j, y, y);
    }
  }
  for (const [key, [y0, y1]] of local) (spans[key] ||= []).push([y0, y1, k]);
});

/* ---------- 每个采样点：地面高、挡不挡身体、头顶净空与是谁 ---------- */
const floorH = new Float32Array(NX * NZ), blocked = new Uint8Array(NX * NZ), head = new Float32Array(NX * NZ).fill(Infinity), headBy = new Int32Array(NX * NZ).fill(-1), noGround = new Uint8Array(NX * NZ);
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  const key = j * NX + i, S = spans[key] || [];
  if (Math.abs(sx(i)) > groundExtent / 2 || Math.abs(sz(j)) > groundExtent / 2) noGround[key] = 1;
  let f = 0; for (const [y0, y1] of S) if (y1 <= STEP && y1 > f) f = y1;            /* 跨得上的（踏步石、小石块、灰烬）当地面 */
  floorH[key] = f;
  for (const [y0, y1, k] of S) {
    if (y1 <= f + 1e-4) continue;
    if (y1 > f + STEP && y0 < f + CH) { blocked[key] = 1; continue; }              /* 挡身体 */
    if (y0 >= f + CH - 1e-4 && y0 - f < head[key]) { head[key] = y0 - f; headBy[key] = k; }   /* 头顶上的 */
  }
}

/* ---------- 寻路格：角色圆柱放在格心能不能站 ---------- */
const grid = new Grid(room), R = Math.ceil(RAD / RES);
const cellHead = new Float32Array(grid.cols * grid.rows).fill(Infinity), cellHeadBy = new Int32Array(grid.cols * grid.rows).fill(-1), cellWhy = new Array(grid.cols * grid.rows).fill("");
for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
  const [cx, cz] = grid.center(c, r).map((v) => v / 100), ci = ix(cx), cj = iz(cz), gi = grid.idx(c, r); let bad = "";
  for (let dj = -R; dj <= R && !bad; dj++) for (let di = -R; di <= R && !bad; di++) {
    const i = ci + di, j = cj + dj; if ((sx(i) - cx) ** 2 + (sz(j) - cz) ** 2 > RAD * RAD) continue;
    if (i < 0 || j < 0 || i >= NX || j >= NZ) { bad = "出界"; break; }
    const key = j * NX + i;
    if (noGround[key]) bad = "无地面"; else if (blocked[key]) bad = "挡"; else if (head[key] < cellHead[gi]) { cellHead[gi] = head[key]; cellHeadBy[gi] = headBy[key]; }
  }
  cellWhy[gi] = bad; if (bad) grid.block[gi] = 1;
}

/* ---------- 检查 ---------- */
const fails = [], notes = [], N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const nbrs = (c, r) => N8.filter(([dc, dr]) => !grid.isBlocked(c + dc, r + dr) && !(dc && dr && (grid.isBlocked(c + dc, r) || grid.isBlocked(c, r + dr)))).map(([dc, dr, w]) => [c + dc, r + dr, w]);
function bfs(start) {
  const dist = new Float32Array(grid.cols * grid.rows).fill(Infinity), prev = new Int32Array(grid.cols * grid.rows).fill(-1), q = [start]; dist[grid.idx(...start)] = 0;
  for (let h = 0; h < q.length; h++) { const [c, r] = q[h]; for (const [nc, nr] of nbrs(c, r)) { const ni = grid.idx(nc, nr); if (dist[ni] === Infinity) { dist[ni] = dist[grid.idx(c, r)] + 1; prev[ni] = grid.idx(c, r); q.push([nc, nr]); } } }
  return { dist, prev };
}
const cm = (p) => grid.cellOf(p[0], p[1]);
let spawn = cm(walk.spawn);
if (grid.isBlocked(...spawn)) fails.push(`出发点 ${walk.spawn} 站不住（${cellWhy[grid.idx(...spawn)]}）`);
const reach = bfs(spawn), walkable = [], islands = [];
for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) if (!grid.isBlocked(c, r)) walkable.push([c, r]);
const unreached = walkable.filter(([c, r]) => reach.dist[grid.idx(c, r)] === Infinity);
{ const seen = new Set(); for (const [c, r] of unreached) { const k = grid.idx(c, r); if (seen.has(k)) continue; const comp = [], q = [[c, r]]; seen.add(k);
  for (let h = 0; h < q.length; h++) { comp.push(q[h]); for (const [nc, nr] of nbrs(...q[h])) { const nk = grid.idx(nc, nr); if (!seen.has(nk)) { seen.add(nk); q.push([nc, nr]); } } }
  islands.push(comp.map(([a, b]) => grid.center(a, b))); } }
if (islands.length) fails.push(`${islands.length} 块能站但走不到的地方（被围死），共 ${unreached.length} 格`);
/* 目标点：A*（引擎同一份寻路） */
const routes = {};
for (const [name, p] of Object.entries(walk.targets || {})) {
  const t = cm(p), path = grid.isBlocked(...t) ? null : grid.astar(spawn, t);
  if (!path) { fails.push(`走不到「${name}」${p}（目标格：${cellWhy[grid.idx(...t)] || "可站但无路"}）`); routes[name] = null; continue; }
  let minHead = Infinity, by = -1; for (const [c, r] of path) { const gi = grid.idx(c, r); if (cellHead[gi] < minHead) { minHead = cellHead[gi]; by = cellHeadBy[gi]; } }
  routes[name] = { cells: path.length, meters: +(path.reduce((s, cur, i) => i ? s + Math.hypot(cur[0] - path[i - 1][0], cur[1] - path[i - 1][1]) : 0, 0) * grid.cell / 100).toFixed(1),
                   minHeadroom: minHead === Infinity ? null : +minHead.toFixed(3), under: by >= 0 ? inst[by].id : null, path: path.map(([c, r]) => grid.center(c, r)) };
}
/* 门洞净高：寻路格头顶是门洞墙（门楣）的，净高要 ≥ 身高 × doorClearance */
const doorCells = []; let doorMin = Infinity;
for (const [c, r] of walkable) { const gi = grid.idx(c, r), by = cellHeadBy[gi]; if (by >= 0 && /wall_door/.test(inst[by].model)) { doorCells.push(grid.center(c, r)); doorMin = Math.min(doorMin, cellHead[gi]); } }
if (!doorCells.length) notes.push("没有能站的门洞格（门洞走不过去，或房间里没有门）");
else if (doorMin < DOOR_H - 0.005) fails.push(`门洞净高 ${doorMin.toFixed(3)} 米 < 身高 × ${col.doorClearance} = ${DOOR_H.toFixed(2)} 米`);
/* 净空低于门洞标准但站得下的地方（灯笼下、檐口散草）：只提示 */
const lowBy = {};
for (const [c, r] of walkable) { const gi = grid.idx(c, r), h = cellHead[gi], by = cellHeadBy[gi]; if (h < DOOR_H - 0.005 && by >= 0) { const k = inst[by].model; (lowBy[k] ||= { cells: 0, min: Infinity }); lowBy[k].cells++; lowBy[k].min = Math.min(lowBy[k].min, +h.toFixed(3)); } }
for (const [k, v] of Object.entries(lowBy)) notes.push(`${k} 下方 ${v.cells} 格净空 ${v.min} 米（站得下，低于门洞标准 ${DOOR_H.toFixed(2)}）`);
/* 掉出地面：能站的格必须在地面范围内（已在寻路格里排除，这里数一下被排除的） */
const offGround = walkable.length ? 0 : 0; const noGroundCells = cellWhy.filter((w) => w === "无地面").length;
if (noGroundCells && groundExtent * 100 < room.size.w) fails.push(`${noGroundCells} 格在地面范围外`);
/* 落地的建筑件不悬空、不陷地 */
for (const p of placed) if (p.kind === "building" && p.minY < 0.3 && (p.minY < -0.02 || p.minY > 0.02)) fails.push(`${p.id}（${p.model}）底面在 ${p.minY.toFixed(3)} 米：${p.minY < 0 ? "陷进地面" : "悬空"}`);
/* 巡检路线：从出发点起，每次走到最近的没走过的格，直到全部走过 */
const visited = new Uint8Array(grid.cols * grid.rows), tour = [spawn.slice()]; let cur = spawn, legs = 0, steps = 0, meters = 0;
const reachable = walkable.filter(([c, r]) => reach.dist[grid.idx(c, r)] < Infinity); visited[grid.idx(...spawn)] = 1; let left = reachable.length - 1;
while (left > 0) {
  const { dist, prev } = bfs(cur); let best = -1, bd = Infinity;
  for (const [c, r] of reachable) { const k = grid.idx(c, r); if (!visited[k] && dist[k] < bd) { bd = dist[k]; best = k; } }
  if (best < 0) { fails.push(`巡检卡死：还有 ${left} 格没走到`); break; }
  const seg = []; for (let k = best; k !== grid.idx(...cur); k = prev[k]) seg.push([k % grid.cols, Math.floor(k / grid.cols)]); seg.reverse();
  for (const [c, r] of seg) { const k = grid.idx(c, r); if (!visited[k]) { visited[k] = 1; left--; } meters += Math.hypot(c - tour[tour.length - 1][0], r - tour[tour.length - 1][1]) * grid.cell / 100; tour.push([c, r]); steps++; }
  cur = seg[seg.length - 1]; legs++;
}

/* ---------- 输出 ---------- */
const OUT = join(ROOT, "tools", "out", ROOM_ID); mkdirSync(OUT, { recursive: true });
const report = { room: ROOM_ID, doorState: AS_PLACED ? "as-placed" : "interact-walk", character: { height: CH, radius: RAD, maxStep: STEP, doorClearance: DOOR_H },
  grid: { cell: grid.cell, cols: grid.cols, rows: grid.rows, sample: RES }, instances: inst.length,
  cells: { walkable: walkable.length, reachable: reachable.length, blocked: grid.cols * grid.rows - walkable.length }, islands,
  door: { cells: doorCells.length, minHeadroom: doorMin === Infinity ? null : +doorMin.toFixed(3), need: +DOOR_H.toFixed(3), at: doorCells },
  routes, tour: { legs, steps, meters: +meters.toFixed(1), cells: tour.map(([c, r]) => grid.center(c, r)) }, notes, fails, pass: fails.length === 0 };
const SUFFIX = AS_PLACED ? "_as_placed" : "";
writeFileSync(join(OUT, `walk_check${SUFFIX}.json`), JSON.stringify(report));

/* 俯视图：每采样点 1 像素（480 × 480），上为屋后（+z）、下为正面（-z），左右同游戏镜头（+x 在左）。蓝 = 巡检路线、橙 = 提醒（净空低、孤岛），不用红绿 */
const img = new Uint8Array(NX * NZ * 3), px = (i, j, rgb) => { if (i < 0 || j < 0 || i >= NX || j >= NZ) return; const o = ((NZ - 1 - j) * NX + (NX - 1 - i)) * 3; img[o] = rgb[0]; img[o + 1] = rgb[1]; img[o + 2] = rgb[2]; };
const cellOfS = (i, j) => grid.cellOf(sx(i) * 100, sz(j) * 100);
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  const key = j * NX + i, [c, r] = cellOfS(i, j), gi = grid.idx(c, r), ok = !grid.block[gi];
  let rgb = blocked[key] ? [58, 54, 50] : head[key] < Infinity ? [178, 166, 140] : [222, 212, 188];
  if (!ok && !blocked[key]) rgb = rgb.map((v) => Math.round(v * 0.72));                         /* 圆柱站不下的空地：压暗 */
  if (ok && cellHead[gi] < DOOR_H - 0.005 && !/wall_door/.test(inst[cellHeadBy[gi]]?.model || "")) rgb = [232, 150, 50];   /* 净空低 */
  if (ok && reach.dist[gi] === Infinity) rgb = [232, 150, 50];
  if ((i * RES * 100) % grid.cell < 0.01 || (j * RES * 100) % grid.cell < 0.01) rgb = rgb.map((v) => Math.round(v * 0.93));   /* 格线 */
  px(i, j, rgb);
}
const line = (a, b, rgb, w = 1) => { const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / (RES * 100) + 1;
  for (let s = 0; s <= n; s++) { const x = a[0] + (b[0] - a[0]) * s / n, z = a[1] + (b[1] - a[1]) * s / n; for (let d = -w; d <= w; d++) for (let e = -w; e <= w; e++) px(ix(x / 100) + d, iz(z / 100) + e, rgb); } };
const tc = report.tour.cells; for (let k = 1; k < tc.length; k++) line(tc[k - 1], tc[k], [70, 120, 220], 0);
for (const rt of Object.values(routes)) if (rt) for (let k = 1; k < rt.path.length; k++) line(rt.path[k - 1], rt.path[k], [30, 70, 170], 1);
const dot = (p, rgb, rr = 5) => { for (let d = -rr; d <= rr; d++) for (let e = -rr; e <= rr; e++) if (d * d + e * e <= rr * rr) px(ix(p[0] / 100) + d, iz(p[1] / 100) + e, rgb); };
dot(walk.spawn, [20, 20, 20], 7); dot(walk.spawn, [250, 250, 250], 4);
for (const p of Object.values(walk.targets || {})) { dot(p, [20, 20, 20], 6); dot(p, [70, 120, 220], 3); }
const crc = (() => { const t = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const raw = Buffer.alloc(NZ * (NX * 3 + 1)); for (let y = 0; y < NZ; y++) { raw[y * (NX * 3 + 1)] = 0; Buffer.from(img.buffer, y * NX * 3, NX * 3).copy(raw, y * (NX * 3 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(NX, 0); ihdr.writeUInt32BE(NZ, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(join(OUT, `walk_check${SUFFIX}.png`), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));

console.log(`人形巡检 · ${room.name}（${ROOM_ID}，交互物件：${AS_PLACED ? "按摆放原样" : "按走近时的状态"}）  角色 身高 ${CH} 半径 ${RAD} 台阶 ${STEP}  寻路格 ${grid.cell} 厘米 ${grid.cols} × ${grid.rows}  实例 ${inst.length}`);
console.log(`  能站 ${walkable.length} 格，走得到 ${reachable.length}，孤岛 ${islands.length}`);
for (const [n, r] of Object.entries(routes)) console.log(`  到「${n}」：${r ? `${r.meters} 米，最低净空 ${r.minHeadroom ?? "露天"}${r.under ? "（" + r.under + "）" : ""}` : "走不到"}`);
console.log(`  门洞：${doorCells.length} 格，净高 ${report.door.minHeadroom ?? "—"} 米（要 ≥ ${DOOR_H.toFixed(2)}）`);
console.log(`  巡检路线：${legs} 段 ${steps} 步 ${report.tour.meters} 米，走遍 ${reachable.length} 格`);
for (const n of notes) console.log("  提示：" + n);
for (const f of fails) console.log("  不过：" + f);
console.log(report.pass ? "通过" : "不通过", "  报告与俯视图在", OUT);
process.exit(report.pass ? 0 : 1);
