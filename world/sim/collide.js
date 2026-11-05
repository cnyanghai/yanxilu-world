/* 世界层：按真实模型算挡路（2026-11-05 从人形巡检 tools/tests/walk_check.mjs 搬出来，游戏 world/play.js 与巡检共用这一份）。纯函数，不 import three。
   规则：
   - 预设里不占槽位（没有 Data）的实体——预制体、单件模型、散布——按真实三角面算；占槽位的家具仍按槽位矩形（sim/site.js 的 siteGrid）；
   - 透明裁切的面（散草、草丛）不挡，由调用方在收集三角面时跳过；kind 为 prop 的件（篝火、灯笼）按包围盒整块算；
   - 交互物件（门）按 Interact.walk 指定的状态算（角色走近时推开的样子），由调用方摆好再收集。
   做法：
   1. rasterize：在 res（默认 2.5 厘米）的采样网格上，记每点的地面高（跨得上的当地面）、挡不挡身体、头顶最低的东西；
   2. stamp：寻路格的格心放角色圆柱，半径内任一采样点挡身体、在地面外、出了采样范围，这格就挡上（只加不减）。
   单位：三角面、采样网格、角色尺寸用米（场地坐标）；寻路格用厘米。 */

/* items：[{ id, model, kind, tris }]，tris 是平铺数组，每 9 个数一个三角（米，场地坐标）
   area：{ x0, z0, w, d, res }（米）；col：{ height, radius, maxStep }（米）；groundExtent：地面边长（米，以原点为中心；不写则不限） */
export function rasterize(items, area, col, groundExtent = Infinity) {
  const res = area.res || 0.025, X0 = area.x0, Z0 = area.z0, NX = Math.round(area.w / res), NZ = Math.round(area.d / res);
  const CH = col.height, STEP = col.maxStep;
  const ix = (x) => Math.floor((x - X0) / res), iz = (z) => Math.floor((z - Z0) / res);
  const sx = (i) => X0 + (i + 0.5) * res, sz = (j) => Z0 + (j + 0.5) * res;
  const spans = new Array(NX * NZ), placed = [];   /* 每点 [[低, 高, 实例序号], ...] */
  items.forEach((it, k) => {
    const P = it.tris, n = P.length; let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < n; i += 3) { if (P[i] < lo) lo = P[i]; if (P[i] > hi) hi = P[i]; }
    placed.push({ id: it.id, model: it.model, kind: it.kind, minY: lo, maxY: hi });
    const local = new Map(), put = (i, j, y0, y1) => {
      if (i < 0 || j < 0 || i >= NX || j >= NZ) return; const key = j * NX + i, s = local.get(key);
      if (s) { if (y0 < s[0]) s[0] = y0; if (y1 > s[1]) s[1] = y1; } else local.set(key, [y0, y1]);
    };
    if (it.kind === "prop") {   /* 道具按包围盒整块（篝火不许走进去；灯笼挂在头顶） */
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < n; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
      for (let j = iz(z0); j <= iz(z1); j++) for (let i = ix(x0); i <= ix(x1); i++) put(i, j, lo, hi);
    } else for (let t = 0; t < n; t += 9) {
      const ax = P[t], ay = P[t + 1], az = P[t + 2], bx = P[t + 3], by = P[t + 4], bz = P[t + 5], cx = P[t + 6], cy = P[t + 7], cz = P[t + 8];
      const ar = (bx - ax) * (cz - az) - (cx - ax) * (bz - az); if (Math.abs(ar) < 1e-9) continue;   /* 竖直面：封闭体的顶底面已覆盖 */
      const i0 = ix(Math.min(ax, bx, cx)), i1 = ix(Math.max(ax, bx, cx)), j0 = iz(Math.min(az, bz, cz)), j1 = iz(Math.max(az, bz, cz));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = sx(i), pz = sz(j);
        const w1 = ((bx - px) * (cz - pz) - (cx - px) * (bz - pz)) / ar, w2 = ((cx - px) * (az - pz) - (ax - px) * (cz - pz)) / ar, w3 = 1 - w1 - w2;
        if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
        const y = w1 * ay + w2 * by + w3 * cy; put(i, j, y, y);
      }
    }
    for (const [key, [y0, y1]] of local) (spans[key] ||= []).push([y0, y1, k]);
  });
  /* 每个采样点：地面高、挡不挡身体、头顶净空与是谁 */
  const N = NX * NZ, floorH = new Float32Array(N), blocked = new Uint8Array(N), head = new Float32Array(N).fill(Infinity), headBy = new Int32Array(N).fill(-1), noGround = new Uint8Array(N);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const key = j * NX + i, S = spans[key] || [];
    if (Math.abs(sx(i)) > groundExtent / 2 || Math.abs(sz(j)) > groundExtent / 2) noGround[key] = 1;
    let f = 0; for (const [, y1] of S) if (y1 <= STEP && y1 > f) f = y1;               /* 跨得上的（踏步石、小石块、灰烬）当地面 */
    floorH[key] = f;
    for (const [y0, y1, k] of S) {
      if (y1 <= f + 1e-4) continue;
      if (y1 > f + STEP && y0 < f + CH) { blocked[key] = 1; continue; }                 /* 挡身体 */
      if (y0 >= f + CH - 1e-4 && y0 - f < head[key]) { head[key] = y0 - f; headBy[key] = k; }   /* 头顶上的 */
    }
  }
  return { NX, NZ, res, x0: X0, z0: Z0, ix, iz, sx, sz, floorH, blocked, head, headBy, noGround, placed };
}

/* 寻路格盖章：格心放角色圆柱（半径 col.radius 米），半径内全部可站才算能站；站不下的格挡上。已挡的格（槽位、墙）不再算。
   返回每格的 { head：头顶最低净空（米）, headBy：是哪个实例, why：挡的原因 } */
export function stamp(grid, R, col) {
  const RAD = col.radius, Rn = Math.ceil(RAD / R.res), N = grid.cols * grid.rows;
  const head = new Float32Array(N).fill(Infinity), headBy = new Int32Array(N).fill(-1), why = new Array(N).fill("");
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const gi = grid.idx(c, r); if (grid.block[gi]) { why[gi] = "槽位或墙"; continue; }
    const [cx, cz] = grid.center(c, r).map((v) => v / 100), ci = R.ix(cx), cj = R.iz(cz); let bad = "";
    for (let dj = -Rn; dj <= Rn && !bad; dj++) for (let di = -Rn; di <= Rn && !bad; di++) {
      const i = ci + di, j = cj + dj; if ((R.sx(i) - cx) ** 2 + (R.sz(j) - cz) ** 2 > RAD * RAD) continue;
      if (i < 0 || j < 0 || i >= R.NX || j >= R.NZ) { bad = "出界"; break; }
      const key = j * R.NX + i;
      if (R.noGround[key]) bad = "无地面"; else if (R.blocked[key]) bad = "挡"; else if (R.head[key] < head[gi]) { head[gi] = R.head[key]; headBy[gi] = R.headBy[key]; }
    }
    why[gi] = bad; if (bad) grid.block[gi] = 1;
  }
  return { head, headBy, why };
}

/* 寻路格的阻挡位串（"0" 能走、"1" 挡），游戏与巡检对账用 */
export const blockBits = (grid) => Array.from(grid.block, (b) => (b ? "1" : "0")).join("");
