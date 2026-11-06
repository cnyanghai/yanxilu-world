/* 渲染层：书墙（M2，2026-11-05；同日画质研究第一轮）—— 程序化的格子架 + 按数据摆的书。摆法在 world/sim/shelf.js（纯函数），这里只管画、拾取与指到一本时的动作。
   - 架子：橡木（Poly Haven CC0 oak_veneer_01，风格圣经书架定橡木 #987755），厚板圆边（前沿圆角），木纹顺着每块板的长向；
     每格背板上暗下亮（上层板压出的阴影），不再是一片黑；
   - 书：书壳包书芯 —— 前后封 + 圆脊，书壳比书芯每边大出两三毫米，书口有纸页线；一本约 84 个三角面，一个实例网格；
     书脊底图是版本 1「老书皮」左缘切条（tools/spine_atlas.py，公有领域 / CC0 / CC BY 2.0 馆藏扫描，见 packs/modern/books/SOURCES.md），
     网页再按数据叠上：天头地脚两道烫金线、竹节、题签（领域色皮签或纸签，书名竖排）、读完的朱印；
     版本 1 的经验：代码画书皮到不了真书的画质，真书皮扫描 + 代码只管排版与状态才过关（yanxilu/docs/cover-masters.md）；
   - 指到一本（对焦站里悬停或点）：这本往外滑 2 厘米，同格其它书暗一成（INTERACTION 第 1 节）。
   单位：表与摆法厘米，这里米；书墙本地坐标原点底面中心、正面朝 +z。 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { layBooks, SHELF } from "../sim/shelf.js";

const PAGE = new THREE.Color("#d8caa8");   /* 旧书口：偏黄的纸色，比题签纸暗一档（白了像贴纸） */
export const SPINE_FONT = '"Songti SC","STSong","SimSun","Noto Serif CJK SC","Source Han Serif SC","Noto Serif SC",serif';
const CW = 96, CH = 512, PER_ROW = 21;            /* 书脊贴图集：每本 96 × 512，一行 21 本 */
const GOLD = "#e8c886", INK = "#2a1d14", PAPER = "#ebe1c8";
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

/* ---------- 书的网格：单位立方体里建（x 厚、y 高、z 深，书脊在 +z），按实例缩放到每本的尺寸。part：0 封面布、1 书脊、2 书芯 ---------- */
function bookGeometry() {
  const P = [], N = [], U = [], R = [], c = 0.075, sqY = 0.02, sqZ = 0.018, bulge = 0.05, zc = 0.5 - bulge, SEG = 8;   /* 书壳厚、书芯比书壳每边缩进（飘口） */
  const push = (p, n, uv, part) => { P.push(...p); N.push(...n); U.push(...uv); R.push(part); };
  const tri = (a, b, cc, n, part) => {   /* 一个三角，按 n 的朝向定绕序；a/b/cc = [位置, 法线(可空), uv] */
    const e1 = a[0].map((v, k) => b[0][k] - v), e2 = a[0].map((v, k) => cc[0][k] - v), cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0, vs = flip ? [a, cc, b] : [a, b, cc];
    for (const v of vs) push(v[0], v[1] || n, v[2], part);
  };
  const quad = (a, b, cc, d, n, part) => { tri(a, b, cc, n, part); tri(a, cc, d, n, part); };
  const box = (x0, x1, y0, y1, z0, z1, part, uvf) => {
    const V = (x, y, z) => [[x, y, z], null, uvf(x, y, z)];
    quad(V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1), [1, 0, 0], part); quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), [-1, 0, 0], part);
    quad(V(x0, y1, z0), V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), [0, 1, 0], part); quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), [0, -1, 0], part);
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), [0, 0, 1], part); quad(V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), V(x1, y0, z0), [0, 0, -1], part);
  };
  const coverUV = (x, y, z) => [z + 0.5, y + 0.5];
  box(-0.5, -0.5 + c, -0.5, 0.5, -0.5, zc, 0, coverUV); box(0.5 - c, 0.5, -0.5, 0.5, -0.5, zc, 0, coverUV);        /* 前后封 */
  box(-0.5 + c, 0.5 - c, -0.5 + sqY, 0.5 - sqY, -0.5 + sqZ, zc - 0.01, 2, (x, y, z) => [x + 0.5, z + 0.5]);           /* 书芯 */
  /* 圆脊：外弧 x = t / 2、z = zc + bulge (1 - t²)；顶底两道月牙盖 */
  const arc = [], inner = [];
  for (let i = 0; i <= SEG; i++) { const t = -1 + (2 * i) / SEG; arc.push([0.5 * t, zc + bulge * (1 - t * t), t]); inner.push([(0.5 - c) * t, zc - 0.012 + bulge * 0.6 * (1 - t * t)]); }
  for (let i = 0; i < SEG; i++) {
    const [xa, za, ta] = arc[i], [xb, zb, tb] = arc[i + 1], na = norm([2 * bulge * ta, 0, 0.5]), nb = norm([2 * bulge * tb, 0, 0.5]), ua = (ta + 1) / 2, ub = (tb + 1) / 2;
    quad([[xa, -0.5, za], na, [ua, 0]], [[xb, -0.5, zb], nb, [ub, 0]], [[xb, 0.5, zb], nb, [ub, 1]], [[xa, 0.5, za], na, [ua, 1]], norm([na[0] + nb[0], 0, na[2] + nb[2]]), 1);
    for (const [y, ny] of [[0.5, 1], [-0.5, -1]]) quad([[xa, y, za], null, [ua, 0.5]], [[xb, y, zb], null, [ub, 0.5]], [[inner[i + 1][0], y, inner[i + 1][1]], null, [ub, 0.5]], [[inner[i][0], y, inner[i][1]], null, [ua, 0.5]], [0, ny, 0], 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setAttribute("part", new THREE.Float32BufferAttribute(R, 1));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
function norm(v) { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }

/* ---------- 书脊贴图集：底图切条 + 烫金线、竹节、题签、书名、朱印 ---------- */
function spineAtlas(books, domains, strips, meta) {
  const rows = Math.max(1, Math.ceil(books.length / PER_ROW)), cv = document.createElement("canvas"); cv.width = CW * PER_ROW; cv.height = CH * rows;
  const g = cv.getContext("2d"), glyph = [], [mw, mh] = meta.cell;
  books.forEach((b, i) => {
    const x0 = (i % PER_ROW) * CW, y0 = Math.floor(i / PER_ROW) * CH, s = Math.floor(hash(b.id + "#strip") * meta.count), sx = (s % meta.perRow) * mw, sy = Math.floor(s / meta.perRow) * mh;
    g.drawImage(strips, sx, sy, mw, mh, x0, y0, CW, CH);
    g.fillStyle = "rgba(20,12,6,.18)"; g.fillRect(x0, y0, CW, CH);                                     /* 旧书压暗一点，题签更跳 */
    const gold = (y, h) => { g.fillStyle = GOLD; g.fillRect(x0 + 4, y0 + y, CW - 8, h); };
    gold(14, 3); gold(21, 1.5); gold(CH - 24, 1.5); gold(CH - 18, 3);                                     /* 天头地脚两道烫金线 */
    /* 题签：书名竖排；字宽占签宽，排不下竖向压扁（最多到 62%），再不够才缩字 */
    const chars = [...b.title], step = 1.02, maxH = 372; let fs = 70, sq = 1; const need = chars.length * fs * step;   /* 字宽约占书脊 73% */
    if (need > maxH) { sq = Math.max(0.55, maxH / need); if (need * sq > maxH) fs = Math.floor(maxH / (chars.length * step * sq)); }
    const textH = chars.length * fs * step * sq, top = 62, lh = textH + 26, paper = hash(b.id + "#label") < 0.3;
    const dc = new THREE.Color(domains[b.dom]?.color ?? 0x6b5b4a).multiplyScalar(0.62), dcs = "#" + dc.getHexString();
    const lx = x0 + 6, lw = CW - 12;   /* 题签几乎占满书脊宽（书名要读得出） */
    if (paper) { g.fillStyle = PAPER; g.fillRect(lx, y0 + top, lw, lh); g.fillStyle = "#" + new THREE.Color(domains[b.dom]?.color ?? 0x6b5b4a).getHexString(); g.fillRect(lx, y0 + top, lw, 7);
      g.strokeStyle = "rgba(40,28,18,.55)"; g.lineWidth = 1.5; g.strokeRect(lx + 0.5, y0 + top + 0.5, lw - 1, lh - 1); }
    else { const gr = g.createLinearGradient(lx, 0, lx + lw, 0); gr.addColorStop(0, "#" + dc.clone().multiplyScalar(0.8).getHexString()); gr.addColorStop(0.4, dcs); gr.addColorStop(1, "#" + dc.clone().multiplyScalar(0.7).getHexString());
      g.fillStyle = gr; g.fillRect(lx, y0 + top, lw, lh); g.strokeStyle = GOLD; g.lineWidth = 2; g.strokeRect(lx + 3, y0 + top + 3, lw - 6, lh - 6); }
    g.fillStyle = paper ? INK : GOLD; g.font = `700 ${fs}px ${SPINE_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.save(); g.translate(x0 + CW / 2, y0 + top + 13 + (paper ? 3 : 0)); g.scale(1, sq); chars.forEach((ch, k) => g.fillText(ch, 0, (k + 0.5) * fs * step)); g.restore();
    glyph.push({ w: fs / CW, h: (fs * sq * step) / CH });
    /* 竹节：题签上方一道，题签下方按剩余空间一到三道（一半的书有，布面精装没有竹节） */
    if (hash(b.id + "#bands") < 0.55) {
      const band = (y) => { g.fillStyle = "rgba(0,0,0,.42)"; g.fillRect(x0, y0 + y - 4, CW, 3); g.fillStyle = "rgba(255,238,200,.32)"; g.fillRect(x0, y0 + y - 1, CW, 3); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x0, y0 + y + 2, CW, 2); };
      band(44); const y1 = top + lh + 26, room = CH - 40 - y1, nb = Math.max(0, Math.min(3, Math.floor(room / 46)));
      for (let k = 0; k < nb; k++) band(y1 + (k + 0.5) * room / Math.max(1, nb));
    }
    if (b.state === "读完") { const y = CH - 62; g.fillStyle = "#a8322a"; g.fillRect(x0 + CW / 2 - 13, y0 + y, 26, 26); g.strokeStyle = "#f1dcc0"; g.lineWidth = 2; g.strokeRect(x0 + CW / 2 - 9, y0 + y + 4, 18, 18); }   /* 读完：一枚方印 */
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, rows, glyph };
}

function bookMaterial(atlas) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tSpine: { value: atlas }, uPage: { value: PAGE } });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aCell; attribute float part; varying vec4 vCell; varying float vPart; varying vec2 vBUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCell = aCell; vPart = part; vBUv = uv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D tSpine; uniform vec3 uPage; varying vec4 vCell; varying float vPart; varying vec2 vBUv;")
      .replace("#include <color_fragment>", `
        vec3 bc;
        if (vPart < 0.5) bc = texture2D(tSpine, vCell.xy + vec2(0.5, clamp(vBUv.y, 0.06, 0.94)) * vCell.zw).rgb * 0.8;   /* 封面布：取这本书脊条中间一列的颜色 */
        else if (vPart < 1.5) bc = texture2D(tSpine, vCell.xy + vBUv * vCell.zw).rgb;
        else { float k = floor(vBUv.x * 60.0), r = fract(sin(k * 12.9898) * 43758.5453), e = smoothstep(0.0, 0.14, vBUv.x) * smoothstep(1.0, 0.86, vBUv.x);
               bc = uPage * (0.72 + 0.2 * r) * (0.7 + 0.3 * e) * (0.88 + 0.12 * vBUv.y); }   /* 书口：一页一道，靠书壳两边压暗 */
        diffuseColor.rgb *= bc * vColor.rgb;`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = vPart < 0.5 ? 0.82 : (vPart < 1.5 ? 0.6 : 0.95);");
  };
  return mat;
}

/* ---------- 架子：圆边厚板（前沿两道棱倒圆），木纹顺长向的盒投影 UV ---------- */
const TEX_M = 1.83;   /* oak_veneer_01 一张贴图对应 1.83 米 */
function slab(len, a, b, r, axis, grain, seed) {
  /* axis "x"：横板（长向 x，截面在 y-z，前沿 +z 的上下两棱倒圆）；"y"：竖板（长向 y，截面在 x-z，前沿两棱倒圆）。a = 截面在 z 方向的深，b = 另一边的厚 */
  const sh = new THREE.Shape(), d = a / 2, t = b / 2, rr = Math.min(r, t * 0.9);
  sh.moveTo(-d, -t); sh.lineTo(d - rr, -t); sh.quadraticCurveTo(d, -t, d, -t + rr); sh.lineTo(d, t - rr); sh.quadraticCurveTo(d, t, d - rr, t); sh.lineTo(-d, t); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 3 }).toNonIndexed(), P = g.attributes.position, Nn = g.attributes.normal;
  /* 截面 (u = 深, v = 厚, e = 长) → 世界：横板 (x = e, y = v, z = u) 是对换（奇置换），绕序要翻；竖板 (x = v, y = e, z = u) 是轮换（偶置换），不翻 */
  for (let i = 0; i < P.count; i++) {
    const u = P.getX(i), v = P.getY(i), e = P.getZ(i) - len / 2, nu = Nn.getX(i), nv = Nn.getY(i), ne = Nn.getZ(i);
    if (axis === "x") { P.setXYZ(i, e, v, u); Nn.setXYZ(i, ne, nv, nu); } else { P.setXYZ(i, v, e, u); Nn.setXYZ(i, nv, ne, nu); }
  }
  if (axis === "x") for (let i = 0; i < P.count; i += 3) for (const A of [P, Nn]) { const x = A.getX(i + 1), y = A.getY(i + 1), z = A.getZ(i + 1); A.setXYZ(i + 1, A.getX(i + 2), A.getY(i + 2), A.getZ(i + 2)); A.setXYZ(i + 2, x, y, z); }
  boxUV(g, grain, seed); return g;
}
function boxUV(g, grain, seed = 0) {   /* 按法线主轴投影；grain = 木纹顺哪根轴（贴图里木纹竖走，对应 v） */
  const P = g.attributes.position, Nn = g.attributes.normal, uv = new Float32Array(P.count * 2), o = (seed * 7.31) % 1;
  for (let i = 0; i < P.count; i++) {
    const p = [P.getX(i), P.getY(i), P.getZ(i)], n = [Math.abs(Nn.getX(i)), Math.abs(Nn.getY(i)), Math.abs(Nn.getZ(i))], ax = n.indexOf(Math.max(...n));
    const g2 = "xyz".indexOf(grain), others = [0, 1, 2].filter((k) => k !== ax), along = others.includes(g2) ? g2 : others[1], across = others.find((k) => k !== along);
    uv[i * 2] = p[across] / TEX_M + o; uv[i * 2 + 1] = p[along] / TEX_M + o * 0.37;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
function carcassGeometry(fp, G) {
  const W = fp.w / 100, H = fp.h / 100, D = fp.d / 100, S = SHELF, cm = (v) => v / 100, R = 0.008, out = [];
  const at = (g, x, y, z) => { g.translate(x, y, z); out.push(g); return g; };
  const innerW = cm(G.innerW), boardD = D - cm(S.back), zMid = cm(S.back) / 2;
  at(slab(H, D, cm(S.side), R, "y", "y", 1), -W / 2 + cm(S.side) / 2, H / 2, 0); at(slab(H, D, cm(S.side), R, "y", "y", 2), W / 2 - cm(S.side) / 2, H / 2, 0);   /* 侧板 */
  at(slab(W + 0.02, D + 0.012, cm(S.top), R * 1.4, "x", "x", 3), 0, H - cm(S.top) / 2, 0.006);                                                                /* 顶板（四周出头 1 厘米） */
  at(slab(innerW, D - 0.025, cm(S.plinth), 0.004, "x", "x", 4), 0, cm(S.plinth) / 2, -0.0125);                                                                 /* 踢脚（缩进） */
  for (let r = 0; r < G.rows; r++) at(slab(innerW, boardD, cm(S.board), R, "x", "x", 10 + r), 0, cm(S.plinth + (G.rows - 1 - r) * G.rh + S.board / 2), zMid);   /* 层板 */
  const hIn = H - cm(S.plinth + S.top);
  for (let c = 1; c < G.cols; c++) { const x = cm(-G.innerW / 2 + c * (G.cw + S.div) - S.div / 2); at(slab(hIn, boardD - 0.004, cm(S.div), R * 0.8, "y", "y", 30 + c), x, cm(S.plinth) + hIn / 2, zMid - 0.002); }   /* 隔板 */
  return mergeGeometries(out);
}
/* 背板：每格一块，顶点色上暗下亮（上层板压出的阴影），整面比层板暗一档 */
function backGeometry(fp, G) {
  const D = fp.d / 100, cm = (v) => v / 100, z = -D / 2 + cm(SHELF.back), P = [], C = [], U = [];
  for (const c of G.cells) {
    const x0 = cm(c.x0), x1 = cm(c.x1), y0 = cm(c.y0), y1 = cm(c.y1), top = 0.42, bot = 0.86;
    const v = [[x0, y0, bot], [x1, y0, bot], [x1, y1, top], [x0, y0, bot], [x1, y1, top], [x0, y1, top]];
    for (const [x, y, k] of v) { P.push(x, y, z); C.push(k, k, k); U.push(x / TEX_M, y / TEX_M); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals(); return g;
}

/* obj：objects 表的书墙；books：[{ id, title, dom, state }]；domains：{ 键: { name, color } }；
   res：{ books: 书脊底图目录（含 spines.webp / spines.json）, wood: 橡木贴图前缀, texURL: 贴图地址改写（分档） } */
export async function buildBookshelf(obj, books, domains, res = {}) {
  const fp = obj.footprint, W = fp.w / 100, H = fp.h / 100, D = fp.d / 100, cm = (v) => v / 100;
  const L = layBooks(books, obj, { domOrder: Object.keys(domains) }), G = L.grid;
  const group = new THREE.Group(); group.name = "bookshelf"; group.userData.objectId = obj.id;
  const url = (u) => (res.texURL ? res.texURL(u) : new URL(u, location.href).href), tl = new THREE.TextureLoader();
  const [meta, strips, diff, nrm, rough] = await Promise.all([fetch(url(res.books + "spines.json")).then((r) => r.json()), new THREE.ImageLoader().loadAsync(url(res.books + "spines.webp")),
    tl.loadAsync(url(res.wood + "diff.jpg")), tl.loadAsync(url(res.wood + "nrm.jpg")), tl.loadAsync(url(res.wood + "rough.jpg"))]);
  for (const t of [diff, nrm, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } diff.colorSpace = THREE.SRGBColorSpace;
  /* 架子：橡木（贴图均值 161/126/87，乘 0.94 落到风格圣经 #987755）；背板同木压暗 */
  const oak = new THREE.MeshStandardMaterial({ map: diff, normalMap: nrm, roughnessMap: rough, color: new THREE.Color(0.94, 0.93, 0.96), roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) });
  const carcass = new THREE.Mesh(carcassGeometry(fp, G), oak); carcass.castShadow = carcass.receiveShadow = true; carcass.name = "shelf:carcass"; group.add(carcass);
  const back = new THREE.Mesh(backGeometry(fp, G), new THREE.MeshStandardMaterial({ map: diff, color: new THREE.Color(0.62, 0.58, 0.56), vertexColors: true, roughness: 0.9 })); back.receiveShadow = true; back.name = "shelf:back"; group.add(back);
  /* 书 */
  const n = L.books.length, { tex, rows, glyph } = spineAtlas(L.books, domains, strips, meta), geo = bookGeometry(), cell = new Float32Array(n * 4);
  L.books.forEach((b, i) => { cell.set([(i % PER_ROW) / PER_ROW, 1 - (Math.floor(i / PER_ROW) + 1) / rows, 1 / PER_ROW, 1 / rows], i * 4); });
  geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 4));
  const mesh = new THREE.InstancedMesh(geo, bookMaterial(tex), Math.max(1, n)); mesh.count = n; mesh.castShadow = mesh.receiveShadow = true; mesh.name = "shelf:books";
  const base = L.books.map(() => new THREE.Color(1, 1, 1));
  const slide = new Float32Array(n), goal = new Float32Array(n), dim = new Float32Array(n).fill(1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1), tmp = new THREE.Color();
  const write = (i) => { const b = L.books[i]; q.setFromAxisAngle(zAxis, b.lean); p.set(cm(b.x), cm(b.y), cm(b.z) + slide[i]); s.set(cm(b.w), cm(b.h), cm(b.d)); mesh.setMatrixAt(i, m4.compose(p, q, s)); };
  for (let i = 0; i < n; i++) { write(i); mesh.setColorAt(i, base[i]); }
  group.add(mesh);
  let focus = -1;
  return {
    group, mesh, layout: L, domains,
    /* 射线 → 书的序号（没打中书返回 -1） */
    pick(ray) { const h = ray.intersectObject(mesh, false)[0]; return h ? h.instanceId : -1; },
    hitsShelf(ray) { return ray.intersectObjects([carcass, back, mesh], false).length > 0; },
    /* 指到一本：-1 取消 */
    setFocus(i) { focus = i; for (let k = 0; k < n; k++) { goal[k] = k === i ? 0.02 : 0; const same = i >= 0 && L.books[k].c === L.books[i].c && L.books[k].r === L.books[i].r; dim[k] = same && k !== i ? 0.9 : 1; } },
    get focus() { return focus; },
    update(dt) {
      let moved = false; const a = 1 - Math.exp(-dt * 14);
      for (let k = 0; k < n; k++) { const d = goal[k] - slide[k]; if (Math.abs(d) > 1e-5) { slide[k] += d * a; write(k); moved = true; } tmp.copy(base[k]).multiplyScalar(dim[k]); mesh.setColorAt(k, tmp); }
      if (moved) mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
    /* 一本书书脊顶端正中的世界坐标（题签挂在这里）；书脊的屏幕尺寸（像素）用于量可读性 */
    anchor(i) { const b = L.books[i]; group.updateMatrixWorld(); return new THREE.Vector3(cm(b.x), cm(b.y + b.h / 2), cm(b.z + b.d / 2) + slide[i]).applyMatrix4(group.matrixWorld); },
    spineCorners(i) { const b = L.books[i], z = cm(b.z + b.d / 2); group.updateMatrixWorld();
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => new THREE.Vector3(cm(b.x + u * b.w / 2), cm(b.y + v * b.h / 2), z).applyMatrix4(group.matrixWorld)); },
    glyph: (i) => glyph[i],
    info(i) { const b = L.books[i]; return b && { i, id: b.id, title: b.title, dom: b.dom, domName: domains[b.dom]?.name || b.dom, state: b.state, cell: [b.c, b.r] }; },
    /* 书墙正面中心与宽高（世界坐标，米），对焦站取景用 */
    face() { group.updateMatrixWorld(); return { center: new THREE.Vector3(0, H / 2, D / 2).applyMatrix4(group.matrixWorld), w: W, h: H }; },
    /* 有书的格子的范围（世界坐标中心与宽高，米）：对焦站按它取景，书少时不必装下整面墙 */
    content() { group.updateMatrixWorld(); const used = L.used.map((k) => G.cells[k]); if (!used.length) return this.face();
      const x0 = Math.min(...used.map((c) => c.x0)), x1 = Math.max(...used.map((c) => c.x1)), y0 = Math.min(...used.map((c) => c.y0)) - SHELF.board, y1 = Math.max(...used.map((c) => c.y1)) + SHELF.board;
      return { center: new THREE.Vector3(cm((x0 + x1) / 2), cm((y0 + y1) / 2), D / 2).applyMatrix4(group.matrixWorld), w: cm(x1 - x0), h: cm(y1 - y0) }; },
  };
}
