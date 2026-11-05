/* 世界层：角色沿寻路走（M2 在场，2026-11-05）。纯函数与纯数据，不 import three，Node 里测（tools/tests/sim_test.mjs）。
   单位厘米；坐标同 Grid（原点房间中心，x 向右，z 向镜头）。
   - nearestFree：点到不能站的地方（家具上、墙外）时，找离它最近的能站的格；
   - smooth：A* 给的是一格一格的折线，拉直成"中间没挡就直接走过去"的几段（视线检查按角色半径加宽）；
   - Walker：按步速沿路线走，转身有角速度上限，途中 goTo 立即改道。 */

/* 离 (c, r) 最近的能站的格（按格心距离，广度优先往外一圈圈找） */
export function nearestFree(grid, c, r, maxRing = 12) {
  if (!grid.isBlocked(c, r)) return [c, r];
  for (let k = 1; k <= maxRing; k++) {
    let best = null, bd = Infinity;
    for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== k) continue;
      const nc = c + dc, nr = r + dr; if (grid.isBlocked(nc, nr)) continue;
      const d = dc * dc + dr * dr; if (d < bd) { bd = d; best = [nc, nr]; }
    }
    if (best) return best;
  }
  return null;
}

/* 两点之间（厘米）是否一路可走：沿线每隔 step 取点，再在两侧各偏 clear 厘米取点，所落的格都不能被挡 */
export function clearLine(grid, a, b, clear = 0, step = 5) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 1e-6) return true;
  const nx = -dz / len, nz = dx / len, n = Math.ceil(len / step);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + dx * t, z = a[1] + dz * t;
    for (const o of clear ? [0, clear, -clear] : [0]) if (grid.isBlocked(...grid.cellOf(x + nx * o, z + nz * o))) return false;
  }
  return true;
}

/* 格子路线 → 厘米折线：起点用角色实际位置，终点用点击的点（若它所在格可站），中间按视线拉直 */
export function smooth(grid, cells, from, to, clear = 0) {
  if (!cells || !cells.length) return [];
  const pts = cells.map(([c, r]) => grid.center(c, r));
  pts[0] = from.slice();
  if (to && !grid.isBlocked(...grid.cellOf(to[0], to[1])) && clearLine(grid, pts[pts.length > 1 ? pts.length - 2 : 0], to, clear)) pts[pts.length - 1] = to.slice();
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clearLine(grid, pts[i], pts[j], clear)) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}

/* 从当前位置走到目标点（厘米）：返回折线（含起点）；走不到返回 null */
export function plan(grid, from, to, clear = 0) {
  const s = grid.cellOf(from[0], from[1]), start = grid.isBlocked(...s) ? nearestFree(grid, ...s) : s;
  const [tc, tr] = grid.cellOf(to[0], to[1]);   /* 点到房外：先拉回到格子范围内再找最近能站的格 */
  const t = nearestFree(grid, Math.max(0, Math.min(grid.cols - 1, tc)), Math.max(0, Math.min(grid.rows - 1, tr))); if (!start || !t) return null;
  const cells = start[0] === t[0] && start[1] === t[1] ? [start] : grid.astar(start, t); if (!cells) return null;
  const goal = grid.cellOf(to[0], to[1]); const exact = goal[0] === t[0] && goal[1] === t[1] ? to : grid.center(...t);
  if (cells.length === 1) return [from.slice(), exact.slice()];
  return smooth(grid, cells, from, exact, clear);
}

export class Walker {
  constructor(pos = [0, 0], opts = {}) {
    this.pos = pos.slice(); this.heading = opts.heading ?? Math.PI;   /* 朝向：弧度，0 朝 +z（镜头），π 朝 -z（远墙） */
    this.speed = opts.speed ?? 140;                                    /* 厘米 / 秒（成人散步约 1.3 到 1.4 米 / 秒） */
    this.turn = opts.turn ?? 9;                                        /* 转身角速度上限，弧度 / 秒 */
    this.path = []; this.moved = 0; this.onArrive = null;
  }
  get moving() { return this.path.length > 0; }
  /* 换一条路线（途中改道也走这里）；pts[0] 是起点，从第二个点开始走 */
  go(pts, onArrive = null) { this.path = pts && pts.length > 1 ? pts.slice(1).map((p) => p.slice()) : []; this.onArrive = onArrive; if (!this.path.length && onArrive) onArrive(); }
  stop() { this.path = []; }
  /* 推进 dt 秒；返回本步走了多少厘米 */
  update(dt) {
    let left = this.speed * dt, walked = 0;
    while (left > 0 && this.path.length) {
      const [tx, tz] = this.path[0], dx = tx - this.pos[0], dz = tz - this.pos[1], d = Math.hypot(dx, dz);
      if (d > 1e-6) this.face(Math.atan2(dx, dz), dt);
      if (d <= left) { this.pos = [tx, tz]; left -= d; walked += d; this.path.shift(); }
      else { this.pos = [this.pos[0] + dx / d * left, this.pos[1] + dz / d * left]; walked += left; left = 0; }
    }
    this.moved += walked;
    if (!this.path.length && walked > 0 && this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
    return walked;
  }
  face(target, dt) {
    let d = target - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    const m = this.turn * dt; this.heading += Math.max(-m, Math.min(m, d));
  }
}
