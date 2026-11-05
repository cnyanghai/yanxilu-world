// 世界层的单元测试：表加载、格子、寻路、摆放合法性。不开浏览器，秒级。
// 用法：node tools/tests/sim_test.mjs   （系统 node 18 也能跑）
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTables, validate } from "../../world/data/tables.js";
import { Grid, roomGrid, canPlace } from "../../world/sim/grid.js";
import { Walker, plan, nearestFree, clearLine } from "../../world/sim/walker.js";
import { layBooks } from "../../world/sim/shelf.js";
import { BOOKS, DOMAINS } from "../../world/sample.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const J = (p) => JSON.parse(readFileSync(join(ROOT, "world", "data", p), "utf8"));
const raw = Object.fromEntries(["objects", "rooms", "vis", "props", "items", "economy", "sound", "tiles", "characters"].map((n) => [n, J(n + ".json")]));
let fails = 0; const ok = (cond, msg) => { if (!cond) { fails++; console.log("  失败:", msg); } else console.log("  通过:", msg); };

console.log("表");
const problems = validate(raw); ok(problems.length === 0, "最小校验无问题 " + JSON.stringify(problems));
const T = makeTables(raw, { study: J("presets/study.json") });
ok(T.visFor("study", "night").key.power === 0, "夜晚主光为零");
ok(T.visFor("study", "nope").id === "study:day", "没有的时段退到 defaultVis");
ok(T.fixedSlots("study").length >= 10 && T.shopSlots("study").length === 7, "书房固定槽与商店槽数量");

console.log("格子");
const room = T.rooms.study, grid = new Grid(room);
ok(grid.cols === 18 && grid.rows === 14, `18 × 14 格（实际 ${grid.cols} × ${grid.rows}）`);
ok(Math.abs(grid.center(0, 0)[0] + 212.5) <= 0.5 && Math.abs(grid.center(0, 0)[1] + 162.5) <= 0.5, "左上格心约 (-212, -162)，实际 " + grid.center(0, 0));
const c55 = grid.center(5, 5);
ok(grid.cellsOfRect(c55[0], c55[1], 25, 25).length === 1, "25 × 25 放在格心只占 1 格");
ok(grid.cellsOfRect(c55[0] + 12.5, c55[1] + 12.5, 50, 50).length === 4, "50 × 50 放在格线交点占 4 格");
ok(grid.cellsOfRect(0, 0, 160, 70).length === 32, "桌子 160 × 70 居中跨 8 列 × 4 行（格线不在中心），实际 " + grid.cellsOfRect(0, 0, 160, 70).length);

console.log("寻路");
const rg = roomGrid(room, T.objects);
const door = T.slot("study", "door"), shelfTrig = room.stations.shelf.trigger;
const path = rg.astar(rg.cellOf(door.x, door.z - 30), rg.cellOf(shelfTrig.x, shelfTrig.z));
ok(path && path.length > 0, "门到书墙触发格可达");
ok(path && path.length <= 20, `门到书墙 ≤ 20 格（25 厘米格；实际 ${path?.length}）`);
const deskSlot = T.slot("study", "desk");
ok(rg.isBlocked(...rg.cellOf(deskSlot.x, deskSlot.z)), "桌子的格被阻挡");
ok(!rg.isBlocked(...rg.cellOf(0, 100)), "地毯中央可走");

console.log("摆放");
const sill = T.slot("study", "sill");
let r = canPlace(room, T.objects, T.items, [], { uid: "a", item: "plant_succulent", x: sill.x, z: sill.z, rot: 0, surface: "sill" });
ok(r.ok, "多肉放窗台合法 " + r.reason);
r = canPlace(room, T.objects, T.items, [], { uid: "a", item: "plant_monstera", x: sill.x, z: sill.z, rot: 0, surface: "sill" });
ok(!r.ok && r.reason === "surface", "龟背竹不能上窗台（surface）");
const fl = T.slot("study", "floor_shop_1");
const placed = [{ uid: "p1", item: "plant_monstera", x: fl.x, z: fl.z, rot: 0, surface: "floor" }];
r = canPlace(room, T.objects, T.items, placed, { uid: "p2", item: "animal_dog", x: fl.x, z: fl.z, rot: 0, surface: "floor" });
ok(!r.ok && r.reason.startsWith("overlap"), "同一落地槽不能叠两件 " + r.reason);
r = canPlace(room, T.objects, T.items, [], { uid: "p3", item: "animal_dog", x: deskSlot.x, z: deskSlot.z, rot: 0, surface: "floor" });
ok(!r.ok, "不能放进固定家具里 " + r.reason);

console.log("行走（M2 在场）");
{
  const g = roomGrid(room, T.objects), door = [0, 115], shelf = [room.stations.shelf.trigger.x, room.stations.shelf.trigger.z];
  const p1 = plan(g, door, shelf, 10);
  ok(p1 && p1.length >= 2, "门口到书墙站有路，折点 " + p1?.length);
  ok(p1 && Math.hypot(p1.at(-1)[0] - shelf[0], p1.at(-1)[1] - shelf[1]) < 1, "终点就是点的那个点");
  let crosses = 0; for (let i = 1; i < (p1?.length || 0); i++) if (!clearLine(g, p1[i - 1], p1[i])) crosses++;
  ok(p1 && crosses === 0, "拉直后每一段都不穿家具");
  const cells = g.astar(g.cellOf(...door), g.cellOf(...shelf));
  ok(p1 && cells && p1.length < cells.length, `拉直后折点比格子少（${p1?.length} < ${cells?.length}）`);
  const nf = nearestFree(g, ...g.cellOf(deskSlot.x, deskSlot.z));
  ok(nf && !g.isBlocked(...nf), "点在桌子中间，找到最近能站的格 " + nf);
  const p2 = plan(g, door, [deskSlot.x, deskSlot.z], 10);
  ok(p2 && !g.isBlocked(...g.cellOf(...p2.at(-1))), "点桌子：走到桌边能站的地方");
  const w = new Walker(door, { speed: 140 }); let arrived = 0;
  w.go(p1, () => arrived++);
  for (let i = 0; i < 20; i++) w.update(0.05);
  ok(Math.abs(w.moved - 140) < 1, `一秒走 140 厘米（实际 ${w.moved.toFixed(1)}）`);
  const mid = w.pos.slice(), p3 = plan(g, mid, [150, 125], 10); w.go(p3, () => arrived += 10);
  for (let i = 0; i < 400 && w.moving; i++) w.update(0.05);
  ok(Math.hypot(w.pos[0] - p3.at(-1)[0], w.pos[1] - p3.at(-1)[1]) < 1 && arrived === 10, "途中改道：走到新终点，只回调新的那次");
  ok(Math.abs(Math.atan2(Math.sin(w.heading), Math.cos(w.heading))) <= Math.PI, "朝向是有效角度");
}

console.log("书墙摆书");
{
  const shelf = T.objects.bookshelf_wall, L = layBooks(BOOKS, shelf, { domOrder: Object.keys(DOMAINS) }), G = L.grid;
  ok(L.books.length === BOOKS.length && L.overflow === 0, `${BOOKS.length} 本全部上架（放下 ${L.books.length}，放不下 ${L.overflow}）`);
  const byCell = {}; for (const b of L.books) (byCell[b.c + "," + b.r] ||= []).push(b);
  ok(Object.values(byCell).every((bs) => new Set(bs.map((b) => b.dom)).size === 1), "一格只放一个领域");
  const doms = Object.keys(DOMAINS).filter((d) => BOOKS.some((b) => b.dom === d));
  ok(doms.every((d) => new Set(L.books.filter((b) => b.dom === d).map((b) => b.c)).size === 1), "一个领域占一列");
  ok(Object.values(byCell).every((bs) => bs.length >= 2), "没有一本单占一格（每格至少两本）");
  const cellOf = (b) => G.cells[b.r * G.cols + b.c];
  ok(L.books.every((b) => { const c = cellOf(b); return b.x - b.w / 2 >= c.x0 - 0.01 && b.x + b.w / 2 <= c.x1 && b.y - b.h / 2 >= c.y0 - 0.01 && b.y + b.h / 2 <= c.y1 - 1; }), "每本都在自己的格里（不出侧板、不顶上层板）");
  ok(Object.values(byCell).every((bs) => bs.every((b, k) => !k || b.x - b.w / 2 >= bs[k - 1].x + bs[k - 1].w / 2 - 0.01)), "同格的书左右不重叠");
  ok(L.books.filter((b) => b.state === "在读").every((b) => b.out === 3) && L.books.filter((b) => b.state !== "在读").every((b) => b.out === 0), "在读的抽出 3 厘米，其余齐平");
  const rows = new Set(L.books.map((b) => b.r)), eye = [...rows].map((r) => 10 + (G.rows - 1 - r) * G.rh + G.rh / 2);
  ok(eye.every((y) => Math.abs(y - 130) < 80), `书都在视线高附近的层（层中心 ${eye.map((y) => Math.round(y)).join("、")} 厘米）`);
  ok(JSON.stringify(layBooks(BOOKS, shelf, { domOrder: Object.keys(DOMAINS) }).books) === JSON.stringify(L.books), "重开摆法不变（确定的伪随机）");
}

console.log(fails ? `失败 ${fails} 项` : "全部通过"); process.exit(fails ? 1 : 0);
