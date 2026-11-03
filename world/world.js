/* 研习录 · 版本 2 · 小世界（第 3 步：烘焙的壳 + 长焦镜头）
   做法照 kriss.ai 的源码精读（design/KRISS-ANALYSIS.md 第 7 节）：
   - 建筑壳和大件家具是 Blender 里烘焙好的（tools/blender/bake_study.py → world/assets/），这里当无光照材质用，场景里没有任何实时光和阴影；
     三种光 = 三套贴图，切换是两张图在着色器里淡接；
   - 书、盒、袋、牌、文竹是数据驱动的，程序化生成，用一盏半球光加 Lambert 随便照一下（以后换烘焙的环境遮蔽）；
   - 镜头是长焦（院子 5 度、整间 8 度、家具 10 度、物 12 度），在房外看进去；走位时 fov 先宽后窄，有待机呼吸和围绕焦点的鼠标视差。
   单位米。three.js 坐标：x 右，y 上，z 朝观众；后墙在 z = -D/2。配置（机位、槽位）来自 assets/study.json，由 bpy 脚本生成，两边共用一份尺寸。 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DOMAINS, BOOKS, BOXES, BAGS, TODAY, STATS, PLANT } from "./sample.js";
import { loadTables } from "./data/tables.js";
import { detectTier, TIER_BUDGET } from "./render/tiers.js";
import { Composite } from "./render/post.js";

/* ============ 0. 基本设施 ============ */
const canvas = document.getElementById("gl");
const isMobile = Math.min(innerWidth, innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
} catch (e) { document.body.classList.add("nogl"); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(8, 1, 0.5, 600);
const clock = new THREE.Clock();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const crumbEl = document.getElementById("crumb"), hintEl = document.getElementById("hint"), tagEl = document.getElementById("tag");

/* 配置：bpy 生成，机位和槽位两边同源 */
const cfg = await fetch("./assets/study.json").then((r) => { if (!r.ok) throw new Error("assets/study.json " + r.status); return r.json(); })
  .catch((e) => { document.body.classList.add("nogl"); document.querySelector(".fallback div").innerHTML = "小世界的资产还没生成（" + e.message + "）。<br>跑 <code>bash tools/blender/bake.sh</code> 生成 world/assets/。"; throw e; });
const EXPOSURE_BASE = 1 / (cfg.bake_scale || 1) * 0.95;
renderer.toneMappingExposure = EXPOSURE_BASE;
const deskTop = cfg.desk.h;

/* 七张表（world/data/，格式见 schema/README.md）与硬件档位。表坏了不挡画面，报到工坊面板 */
const T = await loadTables("./").catch((e) => { console.warn("表加载失败", e); return null; });
if (T && T.problems.length) console.warn("表校验问题", T.problems);
const TIER = detectTier(renderer, { isMobile });
const composite = TIER >= 1 ? new Composite(renderer) : null;

/* 材质纪律：纸木墨铜。程序化物件用的几种 */
const C = { paper: 0xF1E3C0, kraft: 0xC09C62, ink: 0x1F1309, zhu: 0xA3231B, leaf: 0x6E9A5E, stem: 0x4E7A3E, card: 0x5B2A6B };
const FONT_SONG = '"Noto Serif SC","Songti SC",serif', FONT_BRUSH = '"Ma Shan Zheng","Kaiti SC",serif', FONT_NUM = '"Barlow Condensed","Arial Narrow",sans-serif';
try { await Promise.all([document.fonts.load(`600 40px ${FONT_SONG}`), document.fonts.load(`40px ${FONT_BRUSH}`), document.fonts.load(`700 40px ${FONT_NUM}`)]); } catch (e) {}
function vtext(g, s, x, y, step, max) { let n = 0; for (const ch of s) { if (max && n >= max) break; g.fillText(ch, x, y + n * step); n++; } return n; }

/* ============ 1. 烘焙的壳：两组几何，各一个"两张图淡接"的无光照材质 ============ */
const texLoader = new THREE.TextureLoader();
const texCache = {};
function bakedTex(light, group) {
  const key = light + "_" + group;
  if (!texCache[key]) {
    const t = texLoader.load("./assets/" + cfg.textures[key]);
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    texCache[key] = t;
  }
  return texCache[key];
}
function bakedMaterial(group, light) {
  const t = bakedTex(light, group);
  return new THREE.ShaderMaterial({
    uniforms: { mapA: { value: t }, mapB: { value: t }, uMix: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D mapA, mapB; uniform float uMix; varying vec2 vUv;
      void main(){ vec4 a = texture2D(mapA, vUv); vec4 b = texture2D(mapB, vUv); gl_FragColor = mix(a, b, uMix);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
}
const shellMats = {}; /* group → ShaderMaterial */
const house = new THREE.Group(); scene.add(house);
const hot = []; /* 能点的东西 */
function hotspot(obj, route, name, sub) { obj.userData.route = route; obj.userData.name = name; obj.userData.sub = sub || ""; hot.push(obj); return obj; }
function hitBox(w, h, d, x, y, z, route, name, sub) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z); hotspot(m, route, name, sub); house.add(m); return m;
}
{
  const draco = new DRACOLoader(); draco.setDecoderPath("./vendor/three/addons/libs/draco/gltf/");
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync("./assets/" + cfg.glb);
  const byGroup = { shell: [], furn: [] };
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.name.startsWith("shell_") ? "shell" : o.name.startsWith("furn_") ? "furn" : null;
    if (!g) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
    byGroup[g].push(geo);
  });
  for (const g of ["shell", "furn"]) {
    if (!byGroup[g].length) continue;
    shellMats[g] = bakedMaterial(g, "day");
    const mesh = new THREE.Mesh(mergeGeometries(byGroup[g], false), shellMats[g]); mesh.name = g; house.add(mesh);
  }
}
/* 家具的点击区（整件）：书墙、档案架、案头、灯 */
const W_ = cfg.wall, A_ = cfg.archive, K_ = cfg.desk;
hitBox(W_.w, W_.y0 + W_.shelves * W_.shelf_h, W_.depth + 0.1, W_.cx, (W_.y0 + W_.shelves * W_.shelf_h) / 2, W_.back_z + W_.depth / 2, "/study/wall", "书墙");
hitBox(A_.w, A_.y0 + A_.shelves * A_.shelf_h, A_.depth + 0.1, A_.cx, (A_.y0 + A_.shelves * A_.shelf_h) / 2, A_.back_z + A_.depth / 2, "/study/archive", "档案架");
hitBox(K_.w + 0.2, 0.55, K_.d + 0.2, K_.x, K_.h + 0.2, K_.z, "/study/desk", "案头");
hitBox(0.34, 0.3, 0.34, cfg.lamp.bulb[0], cfg.lamp.bulb[1], cfg.lamp.bulb[2], "/study/desk/lamp", "灯", "夜读的唯一光源");

/* 程序化物件的光：一盏半球光加一点方向光，只影响 Lambert 材质（烘焙的壳是无光照的，不受影响） */
const hemi = new THREE.HemisphereLight(0xFFF3E0, 0x5A4632, 0.9); scene.add(hemi);
const key = new THREE.DirectionalLight(0xFFF2DC, 0.7); key.position.set(-6, 7, 4); scene.add(key);

/* ============ 2. 小工具：实例化加贴图集（书、盒） ============ */
function atlasInstanced(geom, count, atlas, faceIndex, mat) {
  const uv = geom.attributes.uv, groups = geom.groups;
  for (const gr of groups) {
    if (gr.materialIndex === faceIndex) continue;
    const idx = geom.index.array;
    for (let i = gr.start; i < gr.start + gr.count; i++) uv.setX(idx[i], -1);
  }
  geom.clearGroups();
  const off = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  geom.setAttribute("aAtlas", off);
  mat.map = atlas;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aAtlas;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nif (uv.x < 0.0) { vMapUv = vec2(0.0, 0.998); } else { vMapUv = vec2(aAtlas.x + uv.x * aAtlas.y, uv.y); }");
  };
  mat.customProgramCacheKey = () => "atlas" + faceIndex;
  const mesh = new THREE.InstancedMesh(geom, mat, count);
  return { mesh, off };
}
function atlasCanvas(n, cellW, cellH, draw) {
  const c = document.createElement("canvas"); c.width = n * cellW; c.height = cellH;
  const g = c.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < n; i++) { g.save(); g.translate(i * cellW, 0); draw(g, i, cellW, cellH); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ============ 3. 书 ============ */
/* 格子家具的每一格：左沿 x0 与内宽 w（世界坐标）。没有 cols 的旧配置当一整格 */
function cells(slot) {
  const cols = slot.cols || 1, side = slot.side || 0.03, div = slot.div || 0;
  const inner = slot.w - 2 * side, cw = (inner - (cols - 1) * div) / cols, out = [];
  for (let c = 0; c < cols; c++) out.push({ x0: slot.cx - inner / 2 + c * (cw + div), w: cw });
  return out;
}
const bookMeshes = [];
const booksGroup = new THREE.Group(); house.add(booksGroup);
{
  const slot = cfg.wall, n = BOOKS.length, geom = new THREE.BoxGeometry(1, 1, 1);
  const atlas = atlasCanvas(n, 64, 512, (g, i, cw, ch) => {
    const b = BOOKS[i];
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, 0, cw, 6); g.fillRect(0, ch - 6, cw, 6);
    g.fillStyle = "#1F1309"; g.font = `600 30px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top"; vtext(g, b.title, cw / 2, 40, 34, 12);
    if (b.state === "读完") { g.fillStyle = "#A3231B"; g.fillRect(cw / 2 - 9, ch - 40, 18, 18); }
  });
  const { mesh, off } = atlasInstanced(geom, n, atlas, 4, new THREE.MeshLambertMaterial({}));
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  /* 格子家具（ASSET-SPEC 第 3 节）：一格一格地填，书不跨隔板。cells(slot) 给出每格的左沿与宽。
     书少格多的时候不从顶上一行填满往下排，而是按"每格约五本"算出要用几格，均匀撒在整面墙上，像住了人的架子 */
  let i = 0;
  const zFront = slot.back_z + slot.depth; /* 架子前沿 */
  const cellList = cells(slot), total = slot.shelves * cellList.length, want = Math.min(total, Math.max(1, Math.ceil(n / 5)));
  const used = new Set(); for (let u = 0; u < want; u++) used.add(Math.floor(u * total / want + (u * 7919) % Math.max(1, Math.floor(total / want))));
  for (let s = 0; s < slot.shelves && i < n; s++) {
    const yBase = slot.y0 + (slot.shelves - 1 - s) * slot.shelf_h;
    for (let ci = 0; ci < cellList.length; ci++) {
      const c = cellList[ci];
      if (i >= n) break;
      if (!used.has(s * cellList.length + ci)) continue;
      let x = c.x0 + 0.015; const xEnd = c.x0 + c.w - 0.015; let k = 0;
      while (i < n) {
        const b = BOOKS[i], bw = 0.028 + R() * 0.032, bh = Math.min(slot.shelf_h - 0.06, 0.19 + R() * 0.08), bd = 0.15 + R() * 0.05, lean = R() < 0.12 && k > 0, out = b.state === "在读" ? 0.03 : 0;
        if (x + bw > xEnd) break;
        dummy.position.set(x + bw / 2, yBase + bh / 2, zFront - bd / 2 - 0.04 + out);
        dummy.rotation.set(0, 0, lean ? -0.12 : 0); dummy.scale.set(bw, bh, bd); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        col.setHex(DOMAINS[b.dom].color); col.offsetHSL(0, 0, k % 2 ? 0.04 : -0.03); mesh.setColorAt(i, col); off.setXY(i, i / n, 1 / n);
        bookMeshes.push({ i, b, pos: dummy.position.clone(), w: bw, h: bh, d: bd });
        x += bw + 0.004 + (lean ? 0.02 : 0); i++; k++;
      }
    }
  }
  mesh.count = i; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; off.needsUpdate = true;
  hotspot(mesh, "/study/wall/", "书"); booksGroup.add(mesh); booksGroup.userData.mesh = mesh;
  /* 每层末尾平放两三本 */
  const flats = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({}), slot.shelves * 3);
  let fi = 0; const fc = new THREE.Color();
  for (let s2 = 0; s2 < slot.shelves; s2 += 2) {
    const last = cells(slot).at(-1);
    const yBase = slot.y0 + (slot.shelves - 1 - s2) * slot.shelf_h, k = 2 + (s2 % 2); let yy = yBase, xx = last.x0 + last.w / 2 + (R() - 0.5) * 0.04;
    for (let j = 0; j < k; j++, fi++) {
      const fw = 0.15 + R() * 0.04, fh = 0.028 + R() * 0.012, fd = 0.2 + R() * 0.03;
      dummy.position.set(xx + (R() - 0.5) * 0.02, yy + fh / 2, zFront - fd / 2 - 0.05); dummy.rotation.set(0, (R() - 0.5) * 0.12, 0); dummy.scale.set(fw, fh, fd); dummy.updateMatrix(); flats.setMatrixAt(fi, dummy.matrix);
      fc.setHex(Object.values(DOMAINS)[(s2 * 3 + j) % 6].color); fc.offsetHSL(0, -0.1, 0.05); flats.setColorAt(fi, fc); yy += fh;
    }
  }
  flats.count = fi; flats.instanceMatrix.needsUpdate = true; flats.instanceColor.needsUpdate = true; booksGroup.add(flats);
}

/* ============ 4. 盒与袋 ============ */
const boxItems = [];
{
  const slot = cfg.archive, items = [...BOXES.map((b) => ({ kind: "box", ...b })), ...BAGS.map((b) => ({ kind: "bag", ...b }))];
  const n = items.length, geom = new THREE.BoxGeometry(1, 1, 1);
  const atlas = atlasCanvas(n, 96, 320, (g, i, cw, ch) => {
    const it = items[i];
    if (it.kind === "box") {
      g.fillStyle = "#F1E3C0"; g.fillRect(12, 20, cw - 24, 200); g.strokeStyle = "rgba(90,60,20,.7)"; g.lineWidth = 3; g.strokeRect(17, 25, cw - 34, 190);
      g.fillStyle = "#1F1309"; g.font = `700 24px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top"; vtext(g, it.title, cw / 2, 36, 27, 6);
      g.fillStyle = "#4A3218"; g.font = `600 16px ${FONT_NUM}`; g.fillText(String(it.n) + " 件", cw / 2, 196);
      if (it.sealed) { g.save(); g.translate(cw / 2, 262); g.rotate(-0.15); g.fillStyle = "#A3231B"; g.fillRect(-16, -16, 32, 32); g.fillStyle = "#F7E9C8"; g.font = `22px ${FONT_BRUSH}`; g.textBaseline = "middle"; g.fillText("引", 0, 1); g.restore(); }
      g.fillStyle = "#1A100A"; g.beginPath(); g.arc(cw / 2, 300, 8, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = "rgba(0,0,0,.08)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(cw, 0); g.lineTo(cw, 60); g.lineTo(cw / 2, 90); g.lineTo(0, 60); g.closePath(); g.fill();
      g.strokeStyle = "rgba(60,40,15,.6)"; g.lineWidth = 2; g.beginPath(); g.arc(cw / 2, 120, 9, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(cw / 2, 170, 9, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#5A3C1A"; g.beginPath(); g.moveTo(cw / 2, 120); g.lineTo(cw / 2 - 8, 170); g.lineTo(cw / 2 + 8, 120); g.lineTo(cw / 2, 170); g.stroke();
      g.fillStyle = "#1F1309"; g.font = `600 18px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top"; vtext(g, it.title.replace("剪报·", ""), cw / 2, 200, 20, 4);
      if (it.unseen) { g.fillStyle = "#F1E3C0"; g.fillRect(18, 140, cw - 36, 14); g.save(); g.translate(cw - 26, 150); g.rotate(-0.2); g.fillStyle = "#A3231B"; g.fillRect(-11, -11, 22, 22); g.fillStyle = "#F7E9C8"; g.font = `15px ${FONT_BRUSH}`; g.textBaseline = "middle"; g.fillText("封", 0, 1); g.restore(); }
    }
  });
  const { mesh, off } = atlasInstanced(geom, n, atlas, 4, new THREE.MeshLambertMaterial({}));
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  /* 盒和袋也一格一格放（下层格子窝） */
  let i = 0; const zFront = slot.back_z + slot.depth;
  const cellList = cells(slot); let s = 0, ci = 0, x = cellList[0].x0 + 0.02;
  for (; i < n; i++) {
    const it = items[i], bw = it.kind === "box" ? 0.085 : 0.045, bh = Math.min(0.3, slot.shelf_h - 0.05), bd = it.kind === "box" ? 0.24 : 0.2;
    while (x + bw > cellList[ci].x0 + cellList[ci].w - 0.02) { ci++; if (ci >= cellList.length) { ci = 0; s++; } x = cellList[ci].x0 + 0.02; if (s >= slot.shelves) break; }
    if (s >= slot.shelves) break;
    const yBase = slot.y0 + (slot.shelves - 1 - s) * slot.shelf_h;
    dummy.position.set(x + bw / 2, yBase + bh / 2, zFront - bd / 2 - 0.03); dummy.rotation.set(0, 0, 0); dummy.scale.set(bw, bh, bd); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (it.kind === "box") { col.setHex(DOMAINS[it.dom].color); col.offsetHSL(0, -0.05, 0.02); } else col.setHex(C.kraft);
    mesh.setColorAt(i, col); off.setXY(i, i / n, 1 / n);
    boxItems.push({ i, it, pos: dummy.position.clone(), w: bw, h: bh, d: bd }); x += bw + 0.02;
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; off.needsUpdate = true;
  hotspot(mesh, "/study/archive/", "盒"); house.add(mesh);
}

/* ============ 5. 今天的牌与文竹（桌上的两件数据物件） ============ */
const card = (() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 720; const g = c.getContext("2d");
  g.fillStyle = "#5B2A6B"; g.fillRect(0, 0, 512, 720); g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 6; g.strokeRect(18, 18, 476, 684);
  g.save(); g.beginPath(); g.arc(300, 430, 120, 0, Math.PI * 2); g.clip();
  const grd = g.createLinearGradient(0, 310, 0, 550); grd.addColorStop(0, "#1A1030"); grd.addColorStop(1, "#4A2A4A"); g.fillStyle = grd; g.fillRect(180, 310, 240, 240);
  g.fillStyle = "#F3D98A"; g.beginPath(); g.arc(340, 380, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = "#1A1030"; g.beginPath(); g.arc(352, 372, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2E1C40"; g.beginPath(); g.moveTo(180, 520); g.quadraticCurveTo(260, 440, 330, 500); g.quadraticCurveTo(380, 460, 420, 520); g.lineTo(420, 550); g.lineTo(180, 550); g.fill();
  g.fillStyle = "#F3D98A"; g.fillRect(250, 470, 8, 30); g.beginPath(); g.arc(254, 465, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = "#F1E3C0"; g.fillRect(300, 505, 70, 14); g.restore();
  g.strokeStyle = "rgba(243,217,138,.6)"; g.lineWidth = 4; g.beginPath(); g.arc(300, 430, 122, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#F1E3C0"; g.fillRect(50, 50, 78, 420); g.strokeStyle = "rgba(90,60,20,.6)"; g.lineWidth = 3; g.strokeRect(56, 56, 66, 408);
  g.fillStyle = "#1F1309"; g.font = `700 36px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top"; vtext(g, TODAY.title, 89, 72, 38, 10);
  g.save(); g.translate(440, 80); g.fillStyle = "#C9A05A"; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2A1408"; g.font = `700 34px ${FONT_NUM}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(TODAY.minutes), 0, 2); g.restore();
  g.fillStyle = "rgba(255,255,255,.85)"; g.font = `26px ${FONT_SONG}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(TODAY.source, 50, 660);
  g.fillStyle = "#8A857A"; g.beginPath(); g.arc(455, 660, 16, 0, Math.PI * 2); g.fill(); g.fillStyle = "#F1E3C0"; g.font = `18px ${FONT_SONG}`; g.textAlign = "center"; g.fillText("未", 455, 661);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const paper = new THREE.MeshLambertMaterial({ color: C.paper });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.225, 0.004), [paper, paper, paper, paper, new THREE.MeshLambertMaterial({ map: t }), paper]);
  m.position.set(cfg.card.x, cfg.card.y, cfg.card.z); m.rotation.x = -0.28;
  hotspot(m, "/study/desk/card", "今天的牌", TODAY.source); house.add(m); return m;
})();

const plant = new THREE.Group(); plant.position.set(cfg.plant.x, deskTop, cfg.plant.z); house.add(plant);
const leafTex = (() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d"); g.clearRect(0, 0, 512, 512);
  g.fillStyle = "rgba(94,138,78,.42)"; g.beginPath(); g.moveTo(256, 30);
  for (let i = 0; i <= 20; i++) { const t = i / 20, y = 30 + t * 470, w = 118 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.25) + 5; g.lineTo(256 + w, y); }
  for (let i = 20; i >= 0; i--) { const t = i / 20, y = 30 + t * 470, w = 118 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.25) + 5; g.lineTo(256 - w, y); }
  g.closePath(); g.fill(); g.strokeStyle = "#5E8A4E"; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 5; g.beginPath(); g.moveTo(256, 500); g.lineTo(256, 36); g.stroke();
  let rr = 11; const RR = () => (rr = (rr * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const y = 486 - i * 13, len = 112 * Math.sin((i / 34) * Math.PI * 0.95 + 0.08) * (1 - i / 60) + 8;
    for (const sx of [-1, 1]) {
      g.lineWidth = 2.6; g.globalAlpha = 0.95; g.beginPath(); g.moveTo(256, y); g.lineTo(256 + sx * len, y - 26); g.stroke();
      for (let j = 0; j < 26; j++) { const t = j / 26, px = 256 + sx * len * t, py = y - 26 * t, L = 9 + RR() * 7; g.lineWidth = 2; g.globalAlpha = 0.75 + RR() * 0.25; g.beginPath(); g.moveTo(px, py); g.lineTo(px + sx * L * 0.45, py - L); g.stroke(); g.beginPath(); g.moveTo(px, py); g.lineTo(px - sx * L * 0.25, py - L * 0.8); g.stroke(); }
    }
  }
  g.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const leafMat = new THREE.MeshLambertMaterial({ map: leafTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xC8D8B8 });
const stemMat = new THREE.MeshLambertMaterial({ color: C.stem });
let plantState = { grow: PLANT.grow, newLeaves: PLANT.newLeaves };
function buildPlant(grow) {
  while (plant.children.length) plant.remove(plant.children[0]);
  const stems = 3 + Math.round(grow * 4), leafGeom = new THREE.PlaneGeometry(0.22, 0.22);
  let rnd = 3; const R = () => (rnd = (rnd * 48271) % 2147483647) / 2147483647;
  const foliage = new THREE.Group(), stemGeos = [];
  for (let s = 0; s < stems; s++) {
    const h = 0.26 + grow * 0.5 + R() * 0.14, ang = (s / stems) * Math.PI * 2 + R() * 0.7, lean = 0.1 + R() * 0.12 + grow * 0.06, pts = [];
    for (let k = 0; k <= 7; k++) { const t = k / 7, r = lean * t * t * 2.2; pts.push(new THREE.Vector3(Math.cos(ang) * r, 0.16 + h * (t - 0.12 * t * t), Math.sin(ang) * r)); }
    const curve = new THREE.CatmullRomCurve3(pts); stemGeos.push(new THREE.TubeGeometry(curve, 12, 0.003, 5, false));
    const nodes = 7 + Math.round(grow * 6);
    for (let t = 0; t < nodes; t++) {
      const u = 0.38 + 0.62 * (t / (nodes - 1)), p = curve.getPoint(u), dir = curve.getTangent(u), tier = new THREE.Group(); tier.position.copy(p);
      const base = Math.atan2(dir.x, dir.z) + (t % 2 ? 1 : -1) * (Math.PI / 2) * (0.75 + R() * 0.3), n = 3 + Math.round(R() * 1.6), size = (0.5 + 0.42 * (1 - t / nodes)) * (0.8 + grow * 0.4);
      for (let k = 0; k < n; k++) {
        const g = new THREE.Group(); g.rotation.y = base + ((k - (n - 1) / 2) * 0.42) + (R() - 0.5) * 0.3; g.rotation.z = 0.04 + R() * 0.14;
        const leaf = new THREE.Mesh(leafGeom, leafMat); leaf.rotation.set(-Math.PI / 2, 0, 0); leaf.position.set(0, 0.004, 0.105 * size); leaf.scale.setScalar(size); g.add(leaf); tier.add(g);
      }
      foliage.add(tier);
    }
    const tip = new THREE.Group(); tip.position.copy(curve.getPoint(1));
    for (let k = 0; k < 3; k++) { const g = new THREE.Group(); g.rotation.y = (k / 3) * Math.PI * 2 + R(); g.rotation.z = 0.5 + R() * 0.4; const leaf = new THREE.Mesh(leafGeom, leafMat); leaf.rotation.set(-Math.PI / 2, 0, 0); leaf.position.set(0, 0, 0.03); leaf.scale.setScalar(0.22 + grow * 0.1); g.add(leaf); tip.add(g); }
    foliage.add(tip);
  }
  foliage.updateMatrixWorld(true);
  const leafGeos = []; foliage.traverse((o) => { if (o.isMesh) leafGeos.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  const leaves = new THREE.Mesh(mergeGeometries(leafGeos, false), leafMat); leaves.userData.sway = true; plant.add(leaves);
  const stemsMesh = new THREE.Mesh(mergeGeometries(stemGeos, false), stemMat); stemsMesh.userData.sway = true; plant.add(stemsMesh);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.9, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.5;
  const old = hot.findIndex((o) => o.userData.route === "/study/desk/plant"); if (old >= 0) hot.splice(old, 1);
  hotspot(hit, "/study/desk/plant", "文竹", `这周长了 ${plantState.newLeaves} 片叶`); plant.add(hit);
}
buildPlant(plantState.grow);

/* 看板：字是贴图（数字以后从学习记录来） */
{
  const c = document.createElement("canvas"); c.width = 1024; c.height = 220; const g = c.getContext("2d");
  g.fillStyle = "#2A1A0E"; g.fillRect(0, 0, 1024, 220); g.strokeStyle = "rgba(201,160,90,.5)"; g.lineWidth = 3; g.strokeRect(10, 10, 1004, 200);
  g.fillStyle = "#EFE6D2"; g.textBaseline = "middle"; g.font = `44px ${FONT_BRUSH}`; g.fillText(STATS.date, 64, 110);
  g.font = `36px ${FONT_SONG}`; g.fillText("没读", 300, 112); g.fillText("本周结卷", 520, 112); g.fillText("连着", 790, 112);
  g.fillStyle = "#F3D98A"; g.font = `700 64px ${FONT_NUM}`; g.fillText(String(STATS.unread), 390, 110); g.fillText(String(STATS.sealedWeek), 690, 110); g.fillText(String(STATS.streak), 880, 110);
  g.fillStyle = "#EFE6D2"; g.font = `30px ${FONT_SONG}`; g.fillText("天", 960, 114);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.29), new THREE.MeshBasicMaterial({ map: t })); m.position.set(0.1, 2.2, cfg.room.back_z + 0.051); house.add(m);
}

/* ============ 6. 院子：地面和三块地基的字 ============ */
const yard = new THREE.Group(); scene.add(yard);
const groundMat = new THREE.MeshBasicMaterial({ color: 0x8E8A80 });
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.43; yard.add(ground);
  const names = { flower: "花房", pet: "宠物间", collect: "收藏室" };
  for (const k in cfg.plots) {
    const p = cfg.plots[k], c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#1F1309"; g.font = `88px ${FONT_BRUSH}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(names[k], 256, 100); g.font = `34px ${FONT_SONG}`; g.fillText("待建", 256, 190);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5 }));
    sign.rotation.x = -Math.PI / 2; sign.position.set(p[0], p[1] + 0.001, p[2]); yard.add(sign);
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(cfg.room.w + 0.6, cfg.room.h + 0.8, cfg.room.d + 0.6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = cfg.room.h / 2; hotspot(hit, "/study", "书房"); yard.add(hit);
}

/* ============ 7. 光：vis 表驱动（world/data/vis.json，一房一时段一行），烘焙贴图按 bakeSet 淡接 ============
   旧的三个按钮（晴窗 / 夜读 / 雨天）映射为：day = 白天；night = 夜晚；rain = 白天 + 雨天天气层。
   烘焙现在只有 day / night / rain 三套贴图，黎明暂借白天、黄昏暂借夜晚，重烘四时段后去掉这个映射。 */
const BAKE_ALIAS = { dawn: "day", day: "day", dusk: "night", night: "night" };
const LIGHT_MODES = { day: { period: "day", weather: null }, night: { period: "night", weather: null }, rain: { period: "day", weather: "rain" } };
const ROOM_ID = "study";
const toC = (hex) => new THREE.Color(hex);
/* 把一行 vis 变成运行时要的数（颜色先转成 Color，雨天叠加层在这里算进去） */
function visNumbers(entry, weather) {
  const wx = weather && T ? T.weather[weather] : null;
  const keyPower = entry.key.power * (wx ? wx.keyPowerMul : 1);
  const fog = entry.fog.density + (wx ? wx.fogDensity : 0);
  const sat = wx ? 1 + wx.saturation : 1;
  return {
    exposure: entry.exposure, keyColor: toC(entry.key.color), keyPower, fillColor: toC(entry.fill.color), fillPower: entry.fill.power,
    sky: toC(entry.ambient.sky), ground: toC(entry.ambient.ground), ambientPower: entry.ambient.power,
    fogColor: toC(entry.fog.color), fogDensity: fog, vignette: entry.vignette, grade: [sat, 1, 2 - sat],
    unitPower: entry.unitLight.power, unitRadius: entry.unitLight.radius, bakeSet: BAKE_ALIAS[entry.bakeSet] || "day",
  };
}
/* 没有表的时候的兜底（和表里的白天一样） */
const FALLBACK_VIS = { day: { exposure: 1, key: { color: "#f3e2b4", power: 1 }, fill: { color: "#dfe6f0", power: 0.25 }, ambient: { sky: "#f3ddb9", ground: "#987755", power: 0.6 }, fog: { color: "#e6dcc0", density: 0.02 }, vignette: 0.25, unitLight: { power: 0, radius: 2.5 }, bakeSet: "day" } };
function visEntry(period) { return T ? T.visFor(ROOM_ID, period) : FALLBACK_VIS.day; }
let lightNow = "day", lightTarget = "day", lightT = 1, visA = visNumbers(visEntry("day"), null), visB = visA;
const lerpC = new THREE.Color();
function applyVisMix(k) {
  const a = visA, b = visB, L = THREE.MathUtils.lerp;
  hemi.color.copy(a.sky).lerp(b.sky, k); hemi.groundColor.copy(a.ground).lerp(b.ground, k); hemi.intensity = L(a.ambientPower, b.ambientPower, k) * 1.8;
  key.color.copy(a.keyColor).lerp(b.keyColor, k); key.intensity = L(a.keyPower, b.keyPower, k) * 0.9;
  renderer.toneMappingExposure = EXPOSURE_BASE * L(a.exposure, b.exposure, k);
  groundMat.color.copy(a.ground).lerp(b.ground, k).multiplyScalar(0.9);
  if (composite) composite.setVis({ fogColor: lerpC.copy(a.fogColor).lerp(b.fogColor, k).getHex(), fogDensity: L(a.fogDensity, b.fogDensity, k), vignette: L(a.vignette, b.vignette, k), grade: [L(a.grade[0], b.grade[0], k), 1, L(a.grade[2], b.grade[2], k)] });
}
function setLight(name) {
  const mode = LIGHT_MODES[name]; if (!mode) return;
  if (name === lightTarget) { document.body.dataset.light = name; return; }
  const nb = visNumbers(visEntry(mode.period), mode.weather);
  const bakeB = mode.weather === "rain" && cfg.textures["rain_shell"] ? "rain" : nb.bakeSet;
  for (const g in shellMats) { const m = shellMats[g]; m.uniforms.mapA.value = (lightT < 1) ? m.uniforms.mapB.value : m.uniforms.mapA.value; m.uniforms.mapB.value = bakedTex(bakeB, g); m.uniforms.uMix.value = 0; }
  visA = lightT < 1 ? visB : visA; visB = nb;
  lightNow = lightTarget; lightTarget = name; lightT = 0;
  document.body.dataset.light = name;
  document.querySelectorAll("[data-light]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.light === name)));
  try { localStorage.setItem("yxl-world-light", name); } catch (e) {}
}
function applyLight(dt) {
  if (lightT >= 1) return false;
  lightT = Math.min(1, lightT + dt / (reduceMotion ? 0.01 : (T ? T.transition.seconds : 2.5)));
  const k = lightT < 0.5 ? 2 * lightT * lightT : 1 - Math.pow(-2 * lightT + 2, 2) / 2;
  for (const g in shellMats) shellMats[g].uniforms.uMix.value = k;
  applyVisMix(k);
  if (lightT >= 1) { for (const g in shellMats) { const m = shellMats[g]; m.uniforms.mapA.value = m.uniforms.mapB.value; m.uniforms.uMix.value = 0; } visA = visB; }
  return true;
}
applyVisMix(1);

/* 工坊面板的开关（design/HOW-WE-DECIDE.md 第 7 节：技术也要看得见） */
const DEV = { wire: false, unbaked: false, wide: false, hot: false, atlas: false, still: false, paint: false, paintai: false, post: false, chair: false, rodin: false };

/* ============ 8. 镜头：长焦、在房外；三层：机位 → 呼吸 → 视差 ============ */
const SHOTS = {};
for (const k in cfg.shots) SHOTS[k] = cfg.shots[k];
const ROUTE_SHOT = { "/": "yard", "/study": "room", "/study/wall": "wall", "/study/archive": "archive", "/study/desk": "desk", "/study/desk/plant": "plant", "/study/desk/card": "card", "/study/desk/lamp": "lamp" };
function shotTowards(target, frameH, fov, azDeg = 35, elDeg = 18) {
  /* 和 bpy 里一样：按视场角反算距离，方位角、俯角固定 */
  const d = (frameH / 2) / Math.tan(THREE.MathUtils.degToRad(fov) / 2), az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return { pos: target.clone().addScaledVector(dir, d).toArray(), at: target.toArray(), fov, dist: d };
}
function shotFor(route) {
  if (ROUTE_SHOT[route] && SHOTS[ROUTE_SHOT[route]]) return SHOTS[ROUTE_SHOT[route]];
  let m = route.match(/^\/study\/wall\/(\d+)$/);
  if (m && bookMeshes[+m[1]]) { const b = bookMeshes[+m[1]]; return shotTowards(b.pos.clone().add(new THREE.Vector3(0, 0, 0.02)), 0.55, 12, 25, 10); }
  m = route.match(/^\/study\/archive\/(\d+)$/);
  if (m && boxItems[+m[1]]) { const b = boxItems[+m[1]]; return shotTowards(b.pos.clone(), 0.6, 12, 30, 10); }
  return null;
}
const rig = { pos: new THREE.Vector3(), at: new THREE.Vector3(), fov: 8, from: null, to: null, t: 1, dur: 2.0 };
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
function lookQuat(pos, at) { tmpM.lookAt(pos, at, up); return tmpQ.setFromRotationMatrix(tmpM).clone(); }
function moveTo(shot, instant) {
  rig.from = { pos: rig.pos.clone(), at: rig.at.clone(), fov: rig.fov, q: lookQuat(rig.pos, rig.at) };
  rig.to = { pos: new THREE.Vector3().fromArray(shot.pos), at: new THREE.Vector3().fromArray(shot.at), fov: shot.fov };
  rig.to.q = lookQuat(rig.to.pos, rig.to.at);
  rig.t = instant || reduceMotion ? 1 : 0;
  const far = rig.from.pos.distanceTo(rig.to.pos);
  rig.dur = far > 60 ? 2.8 : far > 15 ? 2.5 : 2.0;   /* 照 kriss：2000 / 2500 / 2800 毫秒 */
  if (rig.t >= 1) { rig.pos.copy(rig.to.pos); rig.at.copy(rig.to.at); rig.fov = rig.to.fov; }
}
const drift = new THREE.Vector2(), driftS = new THREE.Vector2();
let camFovExtra = 0;
function stepCamera(dt, t) {
  let moving = false;
  if (rig.t < 1) {
    rig.t = Math.min(1, rig.t + dt / rig.dur);
    const k = rig.t < 0.5 ? 4 * rig.t ** 3 : 1 - Math.pow(-2 * rig.t + 2, 3) / 2;
    rig.pos.lerpVectors(rig.from.pos, rig.to.pos, k); rig.at.lerpVectors(rig.from.at, rig.to.at, k);
    rig.fov = THREE.MathUtils.lerp(rig.from.fov, rig.to.fov, k);
    /* 走位时视场角先放宽再收回（跨院子和房间加 8 度，别的加 4 度） */
    camFovExtra = Math.sin(rig.t * Math.PI) * (rig.dur >= 2.8 ? 8 : 4);
    moving = true;
  } else camFovExtra = 0;
  /* 视差：围绕焦点转一点（kriss：±0.05 弧度，两级 0.04 的平滑） */
  driftS.x += (drift.x * 0.05 - driftS.x) * 0.04; driftS.y += (drift.y * 0.05 - driftS.y) * 0.04;
  const offset = rig.pos.clone().sub(rig.at);
  offset.applyAxisAngle(up, -driftS.x); offset.applyAxisAngle(new THREE.Vector3().crossVectors(up, offset).normalize(), driftS.y);
  /* 竖屏：镜头再靠近一点，视场角按宽高比补 */
  const a = innerWidth / innerHeight;
  if (a < 1) offset.multiplyScalar(0.84);
  if (DEV.wide) offset.multiplyScalar(0.16);   /* 工坊：广角对比 —— 同一个焦点，镜头凑近、视角放宽 */
  camera.position.copy(rig.at).add(offset);
  camera.quaternion.copy(lookQuat(camera.position, rig.at));
  /* 待机呼吸：几乎看不见 */
  if (!reduceMotion && !DEV.still) { camera.rotateX(Math.sin(t * 0.7) * 0.0006); camera.rotateY(Math.sin(t * 1.0) * 0.0006); }
  const fovAdjust = a < 1.1 ? THREE.MathUtils.mapLinear(Math.max(0.5, Math.min(1.1, a)), 1.1, 0.5, 0, 3.0) : 0;
  const f = DEV.wide ? 45 : rig.fov + camFovExtra + fovAdjust;
  if (Math.abs(camera.fov - f) > 0.005) { camera.fov = f; camera.updateProjectionMatrix(); }
  /* near / far 跟着距离走（长焦下深度精度要留给房子） */
  const dist = camera.position.distanceTo(rig.at), near = Math.max(0.2, dist - 25), farP = dist + 60;
  if (Math.abs(camera.near - near) > 0.5 || Math.abs(camera.far - farP) > 0.5) { camera.near = near; camera.far = farP; camera.updateProjectionMatrix(); }
  return moving;
}

/* ============ 9. 路由：hash 就是你站在哪 ============ */
const NAMES = { "": "院子", study: "书房", wall: "书墙", archive: "档案架", desk: "案头", plant: "文竹", card: "今天的牌", lamp: "灯" };
let route = "/", pendingHash = null, seenHint = false;
function parse() { const h = location.hash.replace(/^#/, ""); return h.startsWith("/") ? h.replace(/\/+$/, "") || "/" : "/"; }
function depth(r) { return r === "/" ? 0 : r.split("/").length - 1; }
function parent(r) { if (r === "/") return "/"; const p = r.split("/"); p.pop(); return p.join("/") || "/"; }
function go(r) { if (!shotFor(r)) return; apply(r); const h = "#" + r; if (location.hash !== h) { pendingHash = h; location.hash = h; } }
function apply(r, instant) {
  const shot = shotFor(r); if (!shot) { location.hash = "/"; return; }
  route = r; moveTo(shot, instant);
  const parts = r === "/" ? [""] : ["", ...r.slice(1).split("/")]; let acc = "";
  crumbEl.innerHTML = parts.map((p, i) => {
    acc = i === 0 ? "/" : (acc === "/" ? "/" + p : acc + "/" + p);
    let name = NAMES[p] || p;
    if (/^\d+$/.test(p)) { const prev = parts[i - 1]; name = prev === "wall" ? (bookMeshes[+p]?.b.title || "书") : prev === "archive" ? (boxItems[+p]?.it.title || "盒") : p; }
    const last = i === parts.length - 1;
    return (i ? "<i>›</i>" : "") + (last ? `<b>${name}</b>` : `<button type="button" data-go="${acc}">${name}</button>`);
  }).join("");
  hintEl.classList.toggle("off", r !== "/" || seenHint); if (r !== "/") seenHint = true;
  document.title = (r === "/" ? "小世界" : crumbEl.textContent.replace(/›/g, " · ")) + " · 研习录";
}
addEventListener("hashchange", () => { if (pendingHash && location.hash === pendingHash) { pendingHash = null; return; } pendingHash = null; apply(parse()); });
crumbEl.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });
document.getElementById("back").addEventListener("click", () => go(parent(route)));
addEventListener("keydown", (e) => { if (e.key === "Escape") go(parent(route)); });
document.querySelectorAll("[data-light]").forEach((b) => b.addEventListener("click", () => setLight(b.dataset.light)));
document.getElementById("grow").addEventListener("click", () => { plantState.grow = Math.min(1, plantState.grow + 0.1); plantState.newLeaves += 2; buildPlant(plantState.grow); });

/* ============ 10. 指与点 ============ */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null, hover = null;
function pick(x, y) {
  ptr.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const d = depth(route);
  const cands = hot.filter((o) => { const r = o.userData.route, rd = r.endsWith("/") ? depth(r.slice(0, -1)) + 1 : depth(r); return rd === d + 1 && (d === 0 || r.startsWith(route.split("/").slice(0, 2).join("/"))) && (d < 2 || r.startsWith(route)); });
  const hits = ray.intersectObjects(cands, false); if (!hits.length) return null;
  const h = hits[0], o = h.object; let r = o.userData.route, name = o.userData.name, sub = o.userData.sub;
  if (o.isInstancedMesh) { const i = h.instanceId; r += i; if (o === booksGroup.userData.mesh) { name = bookMeshes[i].b.title; sub = DOMAINS[bookMeshes[i].b.dom].name + " · " + bookMeshes[i].b.state; } else { name = boxItems[i].it.title; sub = boxItems[i].it.kind === "box" ? `${boxItems[i].it.n} 件` : `${boxItems[i].it.n} 篇`; } }
  return { route: r, name, sub, point: h.point };
}
canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener("pointerup", (e) => {
  if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y, was = down; down = null;
  if (Math.hypot(dx, dy) > 8 || performance.now() - was.t > 600) return;
  const p = pick(e.clientX, e.clientY); if (p) go(p.route); else if (depth(route) >= 2) go(parent(route));
});
canvas.addEventListener("pointermove", (e) => {
  drift.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (e.pointerType === "touch") return;
  const p = pick(e.clientX, e.clientY); hover = p; canvas.classList.toggle("hand", !!p);
  if (p) { tagEl.innerHTML = p.name + (p.sub ? `<small>${p.sub}</small>` : ""); tagEl.classList.add("on"); } else tagEl.classList.remove("on");
});
canvas.addEventListener("pointerleave", () => { hover = null; tagEl.classList.remove("on"); canvas.classList.remove("hand"); drift.set(0, 0); });
/* 滚轮：弹簧扳机。推到头退后一级，停手就回弹 */
let wheelAcc = 0, wheelAt = 0;
canvas.addEventListener("wheel", (e) => { e.preventDefault(); wheelAcc += e.deltaY; wheelAt = performance.now(); if (wheelAcc > 700) { wheelAcc = 0; go(parent(route)); } if (wheelAcc < -700) { wheelAcc = 0; if (hover) go(hover.route); } }, { passive: false });

/* ============ 11. 每帧 ============ */
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
function frame() {
  const dt = Math.min(0.1, clock.getDelta()), t = clock.elapsedTime;   /* 低帧率机器上每帧最多推进 0.1 秒：软件渲染 4 帧时过渡也别慢十倍 */
  stepCamera(dt, t); applyLight(dt);
  if (performance.now() - wheelAt > 400) wheelAcc *= 0.9;
  if (!reduceMotion) for (const o of plant.children) if (o.userData.sway) { o.rotation.z = Math.sin(t * 0.9) * 0.018; o.rotation.x = Math.sin(t * 0.7 + 1.3) * 0.012; }
  if (hover && tagEl.classList.contains("on")) { const v = hover.point.clone().project(camera); tagEl.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px, ${(1 - v.y) / 2 * innerHeight}px) translate(-50%, -130%)`; }
  if (composite) { composite.mat.uniforms.uPaint.value = DEV.post ? 1 : 0; composite.render(scene, camera); } else renderer.render(scene, camera);
  devStats();
  requestAnimationFrame(frame);
}

/* ============ 11a. 手绘复现验证（design/PRODUCTION-PLAN.md 阶段 3 开头）：三条路各一个开关 ============ */
/* 路②：换成风格化过的烘焙贴图（tools/paint_texture.py 的滤镜版在 assets/paint/）。
   图生图版（assets/paint_ai/）第二天验证后排除：墙地变成斑驳墙纸；开关 paintai 保留但默认没有文件。 */
const ALT_TEX = { paint: ["shell", "furn"], paint_ai: ["shell"] };
function altTex(dir, g) {
  const key = dir + "/" + g;
  if (!texCache[key]) {
    const t = texLoader.load(`./assets/${dir}/${cfg.textures["day_" + g]}`);
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texCache[key] = t;
  }
  return texCache[key];
}
function applyAltTex() {
  const dir = DEV.paintai ? "paint_ai" : DEV.paint ? "paint" : null;
  for (const g in shellMats) {
    const m = shellMats[g];
    const t = dir && ALT_TEX[dir].includes(g) ? altTex(dir, g) : (dir === "paint_ai" && ALT_TEX.paint.includes(g) ? altTex("paint", g) : bakedTex(lightTarget, g));
    m.uniforms.mapA.value = t; m.uniforms.mapB.value = t; m.uniforms.uMix.value = 0;
  }
}
/* 路③：画风（Kuwahara）现在是合成后期（render/post.js）里的一个开关 uPaint；合成后期本身在 1 档以上常开：深度雾、暗角、调色、颗粒。 */
/* 路①：图生三维出来的家具（tools/fal_image3d.py → assets/verify/*.glb，不入库），Shaded 材质当无光照用。
   按资产规范：按高度缩放、原点落地、放到槽位中心。「验证椅子」只放读书椅；「Rodin 家具」把烘焙的灰盒家具整组隐掉、五件全放。 */
/* 预设驱动的自由家具（M1 第 3 天的第一步）：presets/<房>.json 里带 Model 组件的实体，按 props 表找到模型文件，
   按 objects 表的占地（宽 × 深 × 高，厘米）缩放、原点落地、放到 Transform（厘米 → 米）。格子家具仍在烘焙的壳里。
   Rodin 的 Shaded 材质把明暗画在自发光贴图里；壳的贴图按 bake_scale 压暗再靠曝光提回，这里乘同一个系数让两者一样亮（过渡期做法，正规接光见灯光师提案）。 */
const presetObjs = {};
async function loadPresetFurniture() {
  if (!T || !T.presets.study) return;
  const k = cfg.bake_scale || 1;
  for (const e of T.presets.study.entities) {
    const file = e.components.Model?.file, asset = file && T.props.assets[file];
    if (!asset || !/\.(glb|gltf\.json)$/.test(asset.model || "")) continue;   /* shell:xxx、procedural:xxx 不在这里 */
    try {
      const dl = new DRACOLoader(); dl.setDecoderPath("./vendor/three/addons/libs/draco/gltf/");
      const gl = new GLTFLoader(); gl.setDRACOLoader(dl);
      const gltf = await gl.loadAsync("./" + asset.model);
      const o = gltf.scene, t = e.components.Transform, obj = T.objects[e.components.Data?.object] || {}, fp = obj.footprint || {};
      o.rotation.y = THREE.MathUtils.degToRad(t.rotY || 0);
      const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
      const sy = fp.h ? fp.h / 100 / size.y : 1;
      const fit = asset.fit || "h";
      o.scale.set(fit.includes("w") && fp.w ? fp.w / 100 / size.x : sy, sy, fit.includes("d") && fp.d ? fp.d / 100 / size.z : sy); box.setFromObject(o);
      o.position.set(t.x / 100 - (box.min.x + box.max.x) / 2, t.y / 100 - box.min.y, t.z / 100 - (box.min.z + box.max.z) / 2);
      o.traverse((m) => { if (m.isMesh) { const map = m.material.emissiveMap || m.material.map || null; m.material = new THREE.MeshBasicMaterial({ map, color: map ? new THREE.Color(k, k, k) : 0x244040 }); if (map) map.colorSpace = THREE.SRGBColorSpace; } });
      o.name = "preset-" + e.id; house.add(o); presetObjs[e.id] = o;
    } catch (err) { console.warn("预设家具没加载到", e.id, err); }
  }
}
let presetLoaded = false;
const presetReady = loadPresetFurniture().then(() => { presetLoaded = true; });
/* 旧的验证开关保留：「Rodin 家具」现在只是整组显隐；「验证椅子」不再单独加载 */
const loadChair = async () => { await presetReady; return presetObjs.armchair || null; };
function applyRodin() { for (const id in presetObjs) presetObjs[id].visible = DEV.rodin; }

/* ============ 11b. 工坊：把技术做成开关 ============ */
const devEl = document.getElementById("dev"), devSt = document.getElementById("devst"), devAtlas = document.getElementById("devatlas");
const flatMat = new THREE.MeshLambertMaterial({ color: 0xC9BFAE });
const shellMeshes = () => house.children.filter((o) => o.isMesh && (o.name === "shell" || o.name === "furn"));
let fpsAcc = 0, fpsN = 0, fpsShown = 0, fpsAt = performance.now();
function devToggle(k) {
  DEV[k] = !DEV[k];
  document.querySelectorAll("[data-dev]").forEach((b) => b.setAttribute("aria-pressed", String(!!DEV[b.dataset.dev])));
  if (k === "wire") { for (const g in shellMats) shellMats[g].wireframe = DEV.wire; flatMat.wireframe = DEV.wire; house.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshLambertMaterial) o.material.wireframe = DEV.wire; }); }
  if (k === "unbaked") { for (const m of shellMeshes()) m.material = DEV.unbaked ? flatMat : shellMats[m.name]; hemi.intensity = DEV.unbaked ? 1.3 : LIGHTS[lightTarget].hemi[2]; }
  if (k === "paint" || k === "paintai") { if (k === "paint" && DEV.paint) DEV.paintai = false; if (k === "paintai" && DEV.paintai) DEV.paint = false; document.querySelectorAll("[data-dev]").forEach((b) => b.setAttribute("aria-pressed", String(!!DEV[b.dataset.dev]))); applyAltTex(); }
  if (k === "chair") { loadChair().then((o) => { if (o) o.visible = DEV.chair || DEV.rodin; }).catch((e) => console.warn("验证椅子没加载到", e)); }
  if (k === "rodin") applyRodin();
  if (k === "hot") for (const o of hot) { if (!o.isInstancedMesh) { o.material.visible = DEV.hot; o.material.wireframe = true; o.material.color = new THREE.Color(0xF3D98A); } }
  if (k === "atlas") {
    devAtlas.classList.toggle("on", DEV.atlas); devAtlas.innerHTML = "";
    if (DEV.atlas) {
      for (const g of ["shell", "furn"]) { const img = document.createElement("img"); img.src = "./assets/" + cfg.textures[lightTarget + "_" + g]; const sm = document.createElement("small"); sm.textContent = `烘焙贴图 · ${lightTarget} · ${g}（${cfg.atlas[g]} 像素见方，墙地桌架各占一块）`; devAtlas.append(sm, img); }
      const bm = booksGroup.userData.mesh.material.map.image; if (bm) { const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; c.getContext("2d").drawImage(bm, 0, 0); const sm = document.createElement("small"); sm.textContent = `书脊贴图集（${bm.width} × ${bm.height}，一本一条，着色器按编号取）`; devAtlas.append(sm, c); }
    }
  }
}
document.querySelectorAll("[data-dev]").forEach((b) => b.addEventListener("click", () => devToggle(b.dataset.dev)));
addEventListener("keydown", (e) => { if (e.key === "`" && !e.ctrlKey && !e.metaKey) { devEl.hidden = !devEl.hidden; } });
if (/[?&]dev=1/.test(location.search)) devEl.hidden = false;
function devStats() {
  if (devEl.hidden) return;
  const now = performance.now(); fpsN++; if (now - fpsAt > 500) { fpsShown = Math.round(fpsN * 1000 / (now - fpsAt)); fpsN = 0; fpsAt = now; }
  const i = renderer.info.render, dist = camera.position.distanceTo(rig.at);
  devSt.innerHTML = [["帧率", fpsShown], ["档位", TIER + (composite ? "（合成后期开）" : "（无后期）")], ["表", T ? (T.problems.length ? `${T.problems.length} 处问题` : "七张已载") : "未载"], ["draw call", i.calls], ["三角面", i.triangles.toLocaleString()], ["视场角", camera.fov.toFixed(1) + "°" + (DEV.wide ? "（对比：45°）" : "")], ["镜头距离", dist.toFixed(1) + " m"], ["景别", route], ["光", lightTarget + (lightT < 1 ? `（淡接 ${Math.round(lightT * 100)}%）` : "")], ["画布", renderer.domElement.width + " × " + renderer.domElement.height]].map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join("");
}

/* ============ 12. 开场 ============ */
{
  let saved = null; try { saved = localStorage.getItem("yxl-world-light"); } catch (e) {}
  document.body.dataset.light = "day";
  document.querySelectorAll("[data-light]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.light === "day")));
  const r0 = parse();
  if (r0 === "/" && isMobile && !location.hash) { route = "/study"; location.replace("#/study"); apply("/study", true); }
  else apply(r0, true);
  if (!reduceMotion) { const s = shotFor(route); const at = new THREE.Vector3().fromArray(s.at); rig.pos.copy(new THREE.Vector3().fromArray(s.pos).sub(at).multiplyScalar(1.15).add(at)); rig.fov = s.fov + 3; moveTo(s); rig.dur = 2.4; }
  if (saved && LIGHTS[saved] && saved !== "day") setLight(saved);
  /* 另外两套贴图在空闲时预载 */
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  idle(() => { for (const l of cfg.lights) for (const g of ["shell", "furn"]) bakedTex(l, g); });
  window.__yxlWorld = { renderer, scene, camera, go, route: () => route, setLight, info: () => renderer.info.render, hot, settled: () => rig.t >= 1 && lightT >= 1, dev: devToggle, DEV, verifyReady: () => presetLoaded, tables: T, tier: TIER, budget: TIER_BUDGET[TIER] };
  frame();
}
