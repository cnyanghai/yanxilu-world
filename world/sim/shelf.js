/* 世界层：书墙的格子窝与书的摆放（M2，2026-11-05）。纯函数，不 import three，Node 里测（tools/tests/sim_test.mjs）。
   单位厘米，书墙本地坐标：原点底面中心，x 向右，y 向上，z 向前（正面朝 +z，背板贴墙在 -d/2）。
   规则（design/INTERACTION.md 第 1 节、ASSET-SPEC 第 3 节）：
   - 格子窝按 objects 表的 cubby（列 × 层）在占地里均分，板厚见 SHELF；
   - 一个领域占一列（像图书馆的分类架），从视线高（对焦站看的那层）的格开始，往上下离视线近的格长；一列放满换下一个空列，领域之间不混格；
   - 一个领域要几格按每格约六本算，书在这几格里平均分（不让一本单占一格）；每格最多放到约七成满，留出空位（书墙是慢慢填满的）；
     同格相邻两本明暗错开（render 层按 k 的奇偶上色）；
   - 在读的书抽出 3 厘米；偶尔一本斜靠在前一本上（不放在格的第一本）。
   书的尺寸按 id 取确定的伪随机，重开页面摆法不变。 */
export const SHELF = { side: 3.5, top: 5, plinth: 10, board: 3, div: 2.5, back: 1.5, setback: 1.5 };   /* 板厚（厘米）：厚板圆边（风格圣经），2026-11-05 画质研究由 2.5 / 2 加厚 */

/* 格子窝：[{ c, r, x0, x1, y0（格底板上沿）, y1, cx }]，r = 0 是最上层 */
export function cubbies(obj) {
  const fp = obj.footprint, { cols, rows } = obj.cubby, S = SHELF;
  const innerW = fp.w - 2 * S.side, cw = (innerW - (cols - 1) * S.div) / cols, rh = (fp.h - S.plinth - S.top) / rows, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = -innerW / 2 + c * (cw + S.div), y0 = S.plinth + (rows - 1 - r) * rh + S.board;
    out.push({ c, r, x0, x1: x0 + cw, cx: x0 + cw / 2, y0, y1: S.plinth + (rows - r) * rh });
  }
  return { cells: out, cols, rows, cw, rh, innerW };
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const rnd = (id, k) => hash(id + "#" + k);

/* 摆书：books = [{ id, title, dom, state }]（state：没读 / 在读 / 读完），domOrder = 领域的先后（DOMAINS 的键）。
   eyeY：从哪一高度起排（厘米，默认 130 = 书墙对焦站看的高度）；fill：每格放到几成满换格。
   返回 { books：[{ i, id, title, dom, state, c, r, k（格内第几本）, x, y, z（书心）, w, h, d, lean（弧度，绕 z）, out }], used：[格序号], overflow：放不下的本数 } */
export function layBooks(books, obj, { domOrder = null, eyeY = 130, fill = 0.72, perCell = 6 } = {}) {
  const G = cubbies(obj), fp = obj.footprint, S = SHELF;
  const rowsByEye = [...Array(G.rows).keys()].sort((a, b) => Math.abs(rowMid(G, a, S) - eyeY) - Math.abs(rowMid(G, b, S) - eyeY) || a - b);
  const doms = domOrder ? domOrder.filter((d) => books.some((b) => b.dom === d)) : [...new Set(books.map((b) => b.dom))];
  for (const b of books) if (!doms.includes(b.dom)) doms.push(b.dom);
  const taken = new Set(), cellAt = (c, r) => G.cells[r * G.cols + c], out = [], used = []; let col = 0, overflow = 0;
  for (const dom of doms) {
    const mine = books.filter((b) => b.dom === dom), need = Math.ceil(mine.length / perCell), cells = [];
    while (cells.length < need && col < G.cols) {                                     /* 本列从视线那层往外取空格，满了换下一列 */
      const free = rowsByEye.map((r) => cellAt(col, r)).filter((x) => !taken.has(x));
      for (const x of free) { if (cells.length >= need) break; cells.push(x); taken.add(x); }
      if (cells.length < need || free.length === cells.length) col++;
    }
    if (cells.length && cells.length >= need) col = Math.max(col, cells[cells.length - 1].c + 1);
    let j = 0;
    cells.forEach((cell, ci) => {
      const quota = Math.ceil((mine.length - j) / (cells.length - ci)), innerH = cell.y1 - cell.y0, limit = cell.x0 + (cell.x1 - cell.x0) * fill;
      used.push(G.cells.indexOf(cell)); let x = cell.x0 + 1.5, k = 0;
      while (j < mine.length && k < quota) {
        const b = mine[j], w = 3.8 + rnd(b.id, 1) * 2, h = Math.min(innerH - 2, 20 + rnd(b.id, 2) * 6), d = 19 + rnd(b.id, 3) * 4;
        const lean = k > 0 && rnd(b.id, 4) < 0.08 ? -0.12 : 0, need2 = w + (lean ? 2.2 : 0);
        if (k > 0 && x + need2 > limit) break;
        const out3 = b.state === "在读" ? 3 : 0, zFront = fp.d / 2 - S.setback + out3;
        out.push({ i: out.length, id: b.id, title: b.title, dom: b.dom, state: b.state, c: cell.c, r: cell.r, k,
                   x: x + w / 2 + (lean ? 1.1 : 0), y: cell.y0 + h / 2 + (lean ? 0.3 : 0), z: zFront - d / 2, w, h, d, lean, out: out3 });
        x += need2 + 0.4; j++; k++;
      }
    });
    overflow += mine.length - j;
  }
  return { books: out, used, overflow, grid: G };
}
function rowMid(G, r, S) { return S.plinth + (G.rows - 1 - r) * G.rh + G.rh / 2; }
