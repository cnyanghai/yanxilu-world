/* 渲染层：书墙（M2，2026-11-05）—— 程序化的格子架 + 按数据摆的书。摆法在 world/sim/shelf.js（纯函数），这里只管画、拾取与指到一本时的动作。
   - 架子：背板、侧板、顶板、踢脚、每层底板、列隔板，合成一个网格；
   - 书：一个实例网格，一本一个实例；书脊是一张贴图集（一本一条，竖排书名），着色器按每本的格子取；
     书名用铜金色、书口（顶面）是纸色，其余面是领域底色压暗；颜色只是辅助，书名总在（用户色弱，不靠红绿）；
   - 指到一本（对焦站里悬停或点）：这本往外滑 2 厘米，同格其它书暗一成（INTERACTION 第 1 节）。
   单位：表与摆法厘米，这里米；书墙本地坐标原点底面中心、正面朝 +z。 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { layBooks, SHELF } from "../sim/shelf.js";

const WOOD = "#5e4129", GOLD = new THREE.Color("#e2bf7a"), PAGE = new THREE.Color("#e9dcc0");
export const SPINE_FONT = '"Songti SC","STSong","SimSun","Noto Serif CJK SC","Source Han Serif SC","Noto Serif SC",serif';
const CELL_W = 64, CELL_H = 384, PER_ROW = 32;   /* 书脊贴图集：每本 64 × 384，一行 32 本 */

function box(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }

/* 书脊贴图集：R = 书名（竖排），G = 读完的记号（书脊下部一道横线） */
function spineAtlas(books) {
  const rows = Math.max(1, Math.ceil(books.length / PER_ROW)), cv = document.createElement("canvas"); cv.width = CELL_W * PER_ROW; cv.height = CELL_H * rows;
  const g = cv.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height); g.textAlign = "center"; g.textBaseline = "middle";
  const glyph = [];
  books.forEach((b, i) => {
    /* 字宽占书脊约 84%；书名长排不下时竖向压扁（最多压到 62%），再不够才缩字——窄书脊上字宽比字高要紧 */
    const x0 = (i % PER_ROW) * CELL_W, y0 = Math.floor(i / PER_ROW) * CELL_H, chars = [...b.title], avail = CELL_H * 0.78, step = 1.04;
    let fs = 54, sy = 1; const need = chars.length * fs * step;
    if (need > avail) { sy = Math.max(0.62, avail / need); if (need * sy > avail) fs = Math.floor(avail / (chars.length * step * sy)); }
    g.fillStyle = "#f00"; g.font = `700 ${fs}px ${SPINE_FONT}`;
    glyph.push({ w: fs / CELL_W, h: (fs * sy * step) / CELL_H });   /* 一个字占书脊宽、高的比例（量可读性用） */
    g.save(); g.translate(x0 + CELL_W / 2, y0 + CELL_H * 0.08); g.scale(1, sy); chars.forEach((ch, k) => g.fillText(ch, 0, (k + 0.5) * fs * step)); g.restore();
    if (b.state === "读完") { g.fillStyle = "#0f0"; g.fillRect(x0 + 10, y0 + CELL_H * 0.9, CELL_W - 20, 6); }
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, rows, glyph };
}

function bookMaterial(atlas) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tSpine: { value: atlas }, uGold: { value: GOLD }, uPage: { value: PAGE } });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aCell; varying vec4 vCell; varying vec3 vObjN; varying vec2 vBUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCell = aCell; vObjN = normal; vBUv = uv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D tSpine; uniform vec3 uGold, uPage; varying vec4 vCell; varying vec3 vObjN; varying vec2 vBUv;")
      .replace("#include <color_fragment>", `
        vec3 bc = vColor.rgb;
        if (vObjN.z > 0.5) { vec4 t = texture2D(tSpine, vCell.xy + vBUv * vCell.zw); bc = mix(bc, uGold, t.r); bc = mix(bc, uPage * 0.9, t.g); }
        else if (vObjN.y > 0.5) { float p = step(0.14, vBUv.x) * step(vBUv.x, 0.86) * step(0.05, vBUv.y) * step(vBUv.y, 0.95); bc = mix(bc * 0.8, uPage, p); }
        else bc *= 0.78;
        diffuseColor.rgb *= bc;`);
  };
  return mat;
}

/* obj：objects 表的书墙；books：[{ id, title, dom, state }]；domains：{ 键: { name, color } } */
export function buildBookshelf(obj, books, domains) {
  const fp = obj.footprint, W = fp.w / 100, H = fp.h / 100, D = fp.d / 100, S = SHELF, cm = (v) => v / 100;
  const L = layBooks(books, obj, { domOrder: Object.keys(domains) }), G = L.grid;
  const group = new THREE.Group(); group.name = "bookshelf"; group.userData.objectId = obj.id;
  /* 架子 */
  const parts = [box(W, H, cm(S.back), 0, H / 2, -D / 2 + cm(S.back) / 2),                        /* 背板 */
                 box(cm(S.side), H, D, -W / 2 + cm(S.side) / 2, H / 2, 0), box(cm(S.side), H, D, W / 2 - cm(S.side) / 2, H / 2, 0),
                 box(W, cm(S.top), D, 0, H - cm(S.top) / 2, 0), box(W - 2 * cm(S.side), cm(S.plinth), D - 0.02, 0, cm(S.plinth) / 2, -0.01)];
  for (let r = 0; r < G.rows; r++) parts.push(box(cm(G.innerW), cm(S.board), D - cm(S.back), 0, cm(S.plinth + (G.rows - 1 - r) * G.rh + S.board / 2), cm(S.back) / 2));
  for (let c = 1; c < G.cols; c++) { const x = cm(-G.innerW / 2 + c * (G.cw + S.div) - S.div / 2); parts.push(box(cm(S.div), H - cm(S.plinth + S.top), D - cm(S.back), x, cm(S.plinth) + (H - cm(S.plinth + S.top)) / 2, cm(S.back) / 2)); }
  const carcass = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.78 })); carcass.castShadow = carcass.receiveShadow = true; carcass.name = "shelf:carcass"; group.add(carcass);
  /* 书 */
  const n = L.books.length, { tex, rows, glyph } = spineAtlas(L.books), geo = new THREE.BoxGeometry(1, 1, 1), cell = new Float32Array(n * 4);
  L.books.forEach((b, i) => { cell.set([(i % PER_ROW) / PER_ROW, 1 - (Math.floor(i / PER_ROW) + 1) / rows, 1 / PER_ROW, 1 / rows], i * 4); });
  geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 4));
  const mesh = new THREE.InstancedMesh(geo, bookMaterial(tex), Math.max(1, n)); mesh.count = n; mesh.castShadow = mesh.receiveShadow = true; mesh.name = "shelf:books";
  const base = L.books.map((b, k) => { const c = new THREE.Color(domains[b.dom]?.color ?? 0x6b5b4a); c.offsetHSL(0, 0, b.k % 2 ? 0.045 : -0.03); return c; });
  const slide = new Float32Array(n), goal = new Float32Array(n), dim = new Float32Array(n).fill(1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1), tmp = new THREE.Color();
  const write = (i) => { const b = L.books[i]; q.setFromAxisAngle(zAxis, b.lean); p.set(cm(b.x), cm(b.y), cm(b.z) + slide[i]); s.set(cm(b.w), cm(b.h), cm(b.d)); mesh.setMatrixAt(i, m4.compose(p, q, s)); };
  for (let i = 0; i < n; i++) { write(i); mesh.setColorAt(i, base[i]); }
  group.add(mesh);
  let focus = -1;
  return {
    group, mesh, layout: L, domains,
    /* 射线 → 书的序号（没打中书返回 -1） */
    pick(ray) { const h = ray.intersectObject(mesh, false)[0]; return h ? h.instanceId : -1; },
    hitsShelf(ray) { return ray.intersectObjects([carcass, mesh], false).length > 0; },
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
  };
}
