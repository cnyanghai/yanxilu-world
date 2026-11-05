// 世界层的单元测试：表加载、格子、寻路、摆放合法性。不开浏览器，秒级。
// 用法：node tools/tests/sim_test.mjs   （系统 node 18 也能跑）
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTables, validate } from "../../world/data/tables.js";
import { Grid, roomGrid, canPlace } from "../../world/sim/grid.js";

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

console.log(fails ? `失败 ${fails} 项` : "全部通过"); process.exit(fails ? 1 : 0);
