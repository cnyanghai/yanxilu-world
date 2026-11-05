# 资产规范与尺寸表（阶段 2 的第一个交付物，2026-10-30）

所有出图提示词、建模、图生三维、Blender 清理、three.js 载入都按这页。改这页要记日期。原则来自 `ART-BIBLE.md` 第 7 节的七条复用规矩。

## 1. 单位、网格、朝向

- 世界单位 1 = 1 米。摆放网格 0.5 米；寻路也用这张格子。
- 模型原点在底面中心；正面朝 -Z（three.js 坐标，Y 向上）。Blender 里建完导出时转换。
- 房间内净空 **4.5 × 3.5 × 3.0 米**（2026-10-31 按关卡设计师提案改，用户通过；原 5.2 × 4.2 太空），墙厚 0.24。网格 **9 列 × 7 行**，列 A 到 I、行 1 到 7，平面图在 `studio/level/study-plan.md`，槽位清单在 `world/data/rooms.json`。`study_scene.py` 的 W、D 要随之改并重烘。
- 镜头：跟随镜头俯角 40 度、视场角 20 度（长焦压扁）；放大一级后 28 度俯角、视场角 14 度；三个对焦站沿用 `study.json` 的 shots 调整。

## 2. 槽位类型

| 类型 | 说明 | 现代书房里有几个 |
|---|---|---|
| 地面 | 占地 n × m 格，可靠墙也可居中 | 固定槽：桌、椅、读书椅、笔记本架；商店槽 2 个 |
| 靠墙 | 必须背贴墙，占地 n × 1 格 | 固定槽：书墙（远墙整面）；商店槽 1 个 |
| 桌面 | 放在桌面上的小物 | 固定槽：牌位、台灯位；商店槽 1 个 |
| 架上 | 放在格子窝里 | 商店槽 3 个（笔记本架下层 2、书墙底部 1） |
| 窗台 | 窗下沿 | 商店槽 1 个 |
| 墙面 | 挂在墙上 | 固定槽：壁灯；商店槽 1 个（挂画） |

商店物件在 `items` 里标明能进哪些类型。摆放记录 `placements`：`{item, slot 或 (x, y, rot, surface)}`，从第一天按格子坐标存。

## 3. 尺寸表（米，宽 × 深 × 高；占地按 0.5 米格）

| 物件 | 尺寸 | 占地 | 放置类型 | 面数上限 | 贴图 |
|---|---|---|---|---|---|
| 书墙 | 4.2 × 0.32 × 2.6，格 0.3 × 0.3 × 0.3 | 8 × 1 | 靠墙 | 6000（不含书） | 1024 |
| 书（程序化） | 0.03 到 0.05 × 0.2 × 0.22 到 0.3 | — | 书墙格内 | 12 每本（实例化） | 书脊贴图集 |
| 笔记本架（斜面展示架） | 1.5 × 0.45 × 1.0 | 3 × 1 | 地面 | 2000 | 512 |
| 笔记本（程序化） | 0.18 × 0.02 × 0.25 | — | 架上斜面 | 24 每本 | 封面贴图集 |
| 案桌 | 1.6 × 0.7 × 0.76 | 3 × 2 | 地面 | 2500 | 512 |
| 桌椅 | 0.5 × 0.5 × 0.85 | 1 × 1 | 地面 | 1500 | 512 |
| 读书椅（扶手椅） | 0.85 × 0.85 × 0.9 | 2 × 2 | 地面 | 3000 | 512 |
| 台灯（细杆黄铜） | 0.15 × 0.3 × 0.45 | — | 桌面 | 600 | 进道具贴图集 |
| 壁灯 | 0.15 × 0.25 × 0.3 | — | 墙面 | 500 | 进道具贴图集 |
| 牌 | 0.063 × 0.001 × 0.088 | — | 桌面 | 2 | 牌面贴图 |
| 地毯 | 2.0 × 1.5 × 0.01 | 4 × 3 | 地面（可叠） | 2 | 512 |
| 窗（壳的一部分） | 1.2 宽 × 1.3 高，下沿 1.0 | — | — | 壳 | 壳 |
| 猫（商店） | 0.45 × 0.25 × 0.25 卧姿 | — | 架上 / 地面 | 3000，骨骼待机 | 512 |
| 盆栽（商店） | 0.3 × 0.3 × 0.45 | — | 架上 / 桌面 / 窗台 | 1500 | 512 |
| 角色 | 身高 1.5（头约 0.33，头身比约 1 : 4.5） | 1 × 1 | — | 8000 | 1024 身体 + 512 换装 |

小道具（台灯、壁灯、杯、笔、盒）共用一张 1024 的道具贴图集。

## 4. 每件资产的交付定义

一件资产做完 = 下面全有：
1. `glb`（Draco 压缩），原点与朝向合规，尺寸在表内 ±5%。
2. 贴图 PNG，手绘风，颜色只从六色色板取（允许上下各一档明度）；光画进去，自带环境光遮蔽。
3. 脚下接触阴影贴片（圆角矩形，按占地大小）。
4. `items` 条目：名字、能进的槽位类型、占地、包名、价格（货币待定）。
5. 零件表计数 ≥ 1（`ART-BIBLE.md` 第 6 节）。
6. 同机位截图一张，放对照墙，与主视觉 B 并排 4 分以上。

## 5. 风格包目录

```
world/packs/modern/
  pack.json        色表、槽位到家具的映射、三种光的贴图名
  shell.glb        壳（墙、地、梁、窗）
  tex/             壳的三套烘焙贴图、家具贴图、道具贴图集
  furniture/*.glb  固定槽家具
world/items/<id>/  商店物件（跨包，每包一套皮在 pack.json 里映射）
world/characters/  基础身体、骨骼、动作剪辑、服装
```

## 6. 角色规格

- 一个基础身体，皮克斯式比例（头身比约 1 : 4.5，身高 1.5 米），大眼、圆润形体、哑光手绘皮肤。
- 标准人形骨骼（与 Mixamo 一类命名兼容），所有动作剪辑共用：待机、走、坐下 / 起身、伸手取书、翻书、摸猫、张望。
- 服装是独立网格，和身体共用骨骼；默认一套（墨青毛衣、炭色长裤、白鞋，来自主视觉 B）；换装只换网格和贴图。
- 面数 8000 以内，身体贴图 1024，每套服装 512。
- 来源路线：先图生三维（fal）出基础身体，Blender 清理拓扑后自动绑骨；不行再用 CC0 人形基础模型改比例。

## 7. 卡片里的三维视口

商店和收藏的卡片里，物件放在 1 米立方的取景框内，固定机位 30 度俯角、视场角 20 度，背景用卡片底色，共用一个渲染器按卡片位置分区绘制；同屏最多 6 张活的视口，其余用预渲染的缩略图。

## 8. 阶段 2 要出的概念表（按这页的尺寸写提示词）

1. 角色四视图（正、侧、背、四分之三），A 姿势，默认服装；加一张五动作示意。
2. 笔记本一族：六种封面色，题签位置，架上的样子。
3. 家具一组图：书墙、案桌、桌椅、读书椅、笔记本架、台灯、壁灯，同一张图，素底，带比例尺人形。
4. 商店首批卡片：植物五种、动物三种，每种一张三维形态示意。
5. 院子鸟瞰（现代书房包的院子）。

### 第 1 项的出图方案（等用户点头）

- 模型：gpt-image-2 中档，3:2，参考图主视觉 B（保住手绘风和默认服装），两张（同一提示词，选一张）约 0.75 元。
- 英文提示词：

> Character turnaround sheet of the same cartoon character as in the reference image: a young adult in a deep ink-teal sweater, charcoal trousers and white sneakers, Pixar-like proportions with the head about one quarter of the body height, big friendly eyes, simple rounded shapes, matte hand-painted skin and fabric with visible brush strokes. Four full-body views side by side on one row: front, left side, back, three-quarter. Neutral A-pose with arms slightly away from the body, feet flat. Plain light-grey background, soft flat lighting, consistent scale across views, no text, no props.

- 中文意思：同一个角色的四视图，墨青毛衣、炭色长裤、白鞋，皮克斯式头身比约一比四，大眼圆润哑光手绘；正、左侧、背、四分之三四个全身视图并排，A 姿势，素底平光，同比例，无文字无道具。

### 第 1 项结果（2026-10-30）

两张：`concepts/character_turnaround_01.jpg`、`character_turnaround_02.jpg`，共 0.75 元。

这两张图用了什么：图生图，参考图主视觉 B 只负责服装与手绘质感，提示词把头身比、A 姿势、四视图、素底平光全部写死，所以两张的差异只剩造型本身，可以直接比。

Claude 的观察：两张都达到了四视图的要求（同比例、同服装、A 姿势、四个角度一致），都能直接送图生三维。01 头更大、眼更大，更像皮克斯，腿略短；02 比例更匀、侧视与四分之三视更一致，更好绑骨。建议 **02** 为基础身体，脸的大眼从 01 取一点。无论哪张，皮肤与毛衣的颜色进三维后按六色色板校正（毛衣 = 墨青，裤 = 炭）。

### 第 2 项的出图方案（等用户点头）：笔记本一族

- 模型：gpt-image-2 中档，3:2，参考图主视觉 B，一张约 0.38 元。
- 画面：六本笔记本一排立在斜面展示架上，封面六种从色板派生的低饱和色（墨青、本色、赭、炭、灰绿、暖灰），每本一枚小题签在同一位置，布面封皮边缘略磨；前景一本翻开，露出纸页与一行手写的空行；手绘贴图风，素底。
- 英文提示词：

> Product sheet in the same hand-painted style as the reference image: six cloth-bound notebooks standing in a row on a low slanted oak display rack, covers in six muted colors (deep ink-teal, natural paper beige, rust brown, charcoal, grey-green, warm grey), each with a small brass label plate in the same position near the bottom, slightly worn edges. In the foreground one notebook lies open showing cream paper pages with faint ruled lines. Plain light-grey background, soft flat lighting, visible brush strokes, no text, no other objects.

### 第 1 项定稿（2026-10-30）：角色基础身体用 **02**（`concepts/character_turnaround_02.jpg`），脸的大眼从 01 取一点 —— 用户定。

### 第 2 项结果（2026-10-30）：笔记本一族

`concepts/notebooks_family.jpg`，0.38 元。图生图参考 B，提示词写死六色、题签同位、前景一本翻开。

六种封面色（从图里取，作为笔记本的默认可选色，都在六色色板的明度档内）：墨青 #37423f、本色 #af8e69、赭 #804928、炭 #3b3936、灰绿 #666253、暖灰 #846e5a。

Claude 的观察：题签位置、布面磨边、翻开页的纸色都能直接用；斜面架在这张里没画下层格子窝，以家具一组图为准；笔记本的三维只做一个几何（0.18 × 0.02 × 0.25），封面色与题签走程序化贴图。

### 第 3 项的出图方案（等用户点头）：家具一组图

- 模型：gpt-image-2 中档，3:2，参考图主视觉 B，一张约 0.38 元。
- 画面：七件固定槽家具一排，同一张图、同一比例、同一四分之三视角：整面书墙（大部分格子空着，只放几本书，为看清结构）、案桌、桌椅、墨青读书椅、带下层格子窝的斜面笔记本架、黄铜台灯、黄铜壁灯；旁边站一个 1.5 米高的灰色素模人形当比例尺；素底平光，手绘风，无文字。
- 英文提示词：

> Furniture lineup sheet in the same hand-painted style as the reference image, all pieces at the same scale in one row, consistent three-quarter view, soft flat lighting, plain light-grey background: a full-height oak bookshelf wall with square cubbies mostly empty with only a few books; a pale oak writing desk; a simple oak desk chair; a deep ink-teal upholstered reading armchair with wooden legs; a low oak display rack with a slanted top and open cubbies below; a slim brass desk lamp; a brass wall lamp with a small ink-teal shade. A plain grey mannequin figure 1.5 meters tall stands beside them for scale. Visible brush strokes, painted lighting, no text, nothing else.

### 第 3 项结果（2026-10-30）：家具一组图

`concepts/furniture_lineup.jpg`，0.38 元。图生图参考 B；七件同比例一排，旁边 1.5 米素模人形。

Claude 的观察：七件都出来了，造型统一（方块脚、厚板圆边、黄铜细杆、墨青布面），每件可以单独裁下来送图生三维；桌椅的座面给了墨青，和读书椅呼应，采纳；书墙在图里是 4 列 6 行约 2 米宽，只作造型参考，三维按尺寸表做 4.2 米宽、格 0.3 米；笔记本架这次有下层格子窝了，以这张为准。

### 第 4 项的出图方案（等用户点头）：商店首批卡片

- 模型：gpt-image-2 中档，3:2，参考图主视觉 B，两张共约 0.75 元：一张植物五种，一张动物三种。
- 植物五种：龟背竹、无花果小树、垂吊的绿萝、窗台多肉一盘、桌上小盆的薄荷。每盆一个简单陶盆，色从色板取（本色、墨青、炭）。
- 动物三种：卧着的灰白猫、站着的小柴犬、架上的一只小鸟。都是待机的姿态，皮克斯式圆润比例，手绘风。
- 每张图里物件排成一排，各站在一块圆形小底座上（卡片三维视口里也是这样放），素底平光，无文字。
- 英文提示词（植物）：

> Collectible item sheet in the same hand-painted style as the reference image: five potted plants in a row, each on a small round oak base, same scale: a monstera in a natural-beige clay pot, a small fiddle-leaf fig tree in an ink-teal pot, a trailing pothos in a hanging charcoal pot, a shallow tray of mixed succulents, a small mint plant in a tiny pot. Rounded stylized leaves, visible brush strokes, painted lighting, plain light-grey background, soft flat lighting, no text, nothing else.

- 英文提示词（动物）：

> Collectible item sheet in the same hand-painted style as the reference image: three small animals in a row, each on a small round oak base, same scale, Pixar-like rounded proportions, calm idle poses: a grey-and-white cat lying curled up, a small shiba inu dog sitting, a tiny round songbird perched on a short wooden peg. Matte hand-painted fur and feathers with visible brush strokes, plain light-grey background, soft flat lighting, no text, nothing else.

### 第 4 项结果（2026-10-30）：商店首批卡片

`concepts/shop_plants.jpg`（龟背竹、无花果、吊绿萝、多肉盘、薄荷）、`concepts/shop_animals.jpg`（卧猫、坐柴犬、小鸟），共 0.75 元。图生图参考 B，每件站圆形橡木底座。

Claude 的观察：风格和家具、笔记本一致，底座正好就是卡片三维视口里的摆法；植物的叶子画得偏细，做三维时按面数表简化成大片圆叶（每盆 1500 面以内）；吊绿萝需要一个"吊挂"位置，归入墙面类型，挂在书墙侧板或窗边；三只动物里柴犬最接近皮克斯比例，猫和鸟做三维时头再大一点向它看齐；动物各配一个待机循环（猫呼吸、犬摇尾、鸟歪头），不做行走。

### 第 5 项的出图方案（等用户点头）：院子鸟瞰

- 模型：gpt-image-2 中档，3:2，参考图主视觉 B，一张约 0.38 元。
- 画面：在场模式的室外一景，跟随镜头约 40 度俯角、长焦：一块小院子，中间是书房所在的小房子（没有屋顶，从上能看见里面的书墙一角），门口一条石板小路，一棵树下一张长椅（能停的角落），院门和一个黄铜信箱，一小块草地和菜畦（商店植物的室外槽位），角色正从院门走向房子；院子外围淡淡能看到隔壁两块空地（以后邻居的院子）。手绘风，暖色，无文字。
- 英文提示词：

> In-game screenshot in the same hand-painted style as the reference image, fixed three-quarter top-down game camera at about 40 degrees pitch, long telephoto lens: a small cozy courtyard around a one-room house seen without its roof so a corner of the bookshelf wall inside is visible; a stone-slab path from a low wooden gate to the door, a brass mailbox by the gate, one round-canopy tree with a wooden bench under it, a small lawn and a tiny vegetable bed with a few potted plants, a low fence; the same Pixar-like cartoon character is walking along the path toward the house. Two empty neighboring plots fade softly at the edges. Warm afternoon light, visible brush strokes, painted lighting, no UI, no text.

### 第 5 项结果（2026-10-30）：院子鸟瞰

`concepts/yard_modern.jpg`，0.38 元。图生图参考 B。

Claude 的观察：没有屋顶的小屋从 40 度俯角能看见书墙、桌、椅、笔记本架和猫，证明在场模式下"室内外同一片地面"成立；图里靠镜头的两面墙是全高的，游戏里要降矮或淡出，这是阶段 3 的遮挡淡出要做的事；院子的色彩脚本是暖黄绿，和室内的暖米白加墨青明显不同，符合地方感第 1 条；树下长椅是院子的"能停的角落"，信箱是以后社交的留言入口，菜畦是商店植物的室外槽位（地面类型），隔壁两块空地留给邻居。三维时：树一棵（3000 面）、长椅、信箱、院门、栅栏段（可重复的套件）、石板路（贴花）、菜畦（地面槽位 2 × 2）。

## 9. 阶段 2 交付物清单（2026-10-30 齐，等过门）

| 项 | 文件 | 花费 |
|---|---|---|
| 资产规范与尺寸表 | 本页第 1 到 7 节 | 0 |
| 角色四视图（定 02） | `concepts/character_turnaround_02.jpg` | 0.75 元 |
| 笔记本一族与六种封面色 | `concepts/notebooks_family.jpg` | 0.38 元 |
| 家具一组图 | `concepts/furniture_lineup.jpg` | 0.38 元 |
| 商店首批卡片 | `concepts/shop_plants.jpg`、`shop_animals.jpg` | 0.75 元 |
| 院子鸟瞰 | `concepts/yard_modern.jpg` | 0.38 元 |

合计 2.64 元。门：每张对照主视觉 B 四分以上 —— Claude 自评全部 4 分以上（风格一致靠的是同一张参考图加写死的构图描述）；用户看完说"过"。

没做的：角色五个动作示意（走、坐、取书、摸猫、张望）。原因：动作示意对图生三维没有用，三维角色的动作来自动作库，不照图做；省下这笔。若用户想先看角色动起来的样子，阶段 3 用三维直接出。

## 10. 宋代营地一周小试的套件表与出图方案（2026-11-04，等用户点头）

小试的交付物见 STATUS「当前阶段与下一步」。按 PIPELINE 1.6：偏屋不整栋生成，拆成组件在预制体里拼。风格对照：主视觉 `concepts/song_camp_keyart_02.jpg`（左上那间茅草偏屋）与套件表 `concepts/song_camp_kit.jpg`。

### 10.1 偏屋的拆法

占地 4 × 2 米（两开间一进深），檐口 2.4 米，屋面 45 度，屋脊高约 3.4 米。正面一门一窗，背面与两山是平墙，两山墙上加三角山花。

| # | 组件 | 尺寸（宽 × 深 × 高，米） | 用几次 | 面数上限 | 禁项（写进提示词） |
|---|---|---|---|---|---|
| 1 | 木柱 `post` | 0.16 × 0.16 × 2.4 | 6 | 300 | 不要弯、不要雕花 |
| 2 | 平墙段 `wall_plain`（竹编抹泥，下段木板；三种变体：原图、`_mir` 镜像、`_full` 整面抹泥） | 2.0 × 0.12 × 2.2 | 4 | 800 | 墙有厚度、无破洞、背面同样完整 |
| 3 | 门洞墙段 `wall_door` | 2.0 × 0.12 × 2.2，门洞 0.9 × 1.95 居中 | 1 | 900 | 门洞贯通、洞口净高 1.95（角色 1.5 × 1.3） |
| 4 | 窗洞墙段 `wall_window`（直棂窗） | 2.0 × 0.12 × 2.2，窗 0.8 × 0.6，下沿 1.0 | 1 | 1000 | 窗棂之间透空、不要玻璃 |
| 5 | 檐梁 `beam` | 2.0 × 0.16 × 0.16 | 6 | 200 | 直、端头平 |
| 6 | 山花 `gable`（三角，竹编抹泥） | 2.0 × 0.12 × 1.0 | 2 | 400 | 三角形、两面完整 |
| 7 | 茅草屋面片 `roof_thatch`（2026-11-04 改：五层台阶，坡长 1.9 含约 0.4 出檐，厚 0.20 到 0.27；另有两端悬山收头 `roof_verge_l/r` 0.3 米） | 沿脊 2.0 × 坡长 1.9 × 厚 0.27 | 4 + 收头 4 | 1500（实 980；收头 532） | 厚实、无缝、从下方看也完整、边缘收齐不散 |
| 8 | 屋脊 `ridge`（茅草压脊 + 竹捆；2026-11-04 加宽，另有两端收头 `ridge_end_l/r` 0.3 米带封口） | 2.0 × 0.5 × 0.32 | 2 + 收头 2 | 600（实 24；收头 83） | 两端平、可首尾相接 |
| 9 | 柴门 `door_leaf`（交互物件，三态） | 0.9 × 0.05 × 1.95 | 1 | 400 | 单扇、门轴在左 |
| 10 | 篝火 `campfire`（石圈 + 柴，不含火焰；2026-11-05 改为 Blender 程序建，见 10.8） | 1.0 × 1.0 × 0.35 | 1 | 1500（实 1272） | 不要火焰与烟（火是特效） |

地面不生模：三张可平铺贴图，土（底层）、草（第二层，噪声成片）、石板（踏步印章）。

### 10.2 出图（三视图与地面贴图）

- 模型：gpt-image-2 中档，走 fal（`fal_image.py`），带参考图 `song_camp_kit.jpg` 锁风格。单价约 0.38 元一张。
- 张数：组件三视图 10 张 + 地面贴图 3 张 = 13 张，约 5 元。三视图出图后脚本按三等分裁成三张单视图，送生模。
- 三视图公共提示词（每张前面接组件描述）：

> Orthographic three-view reference sheet of ONE modular game asset for a Song-dynasty rural homestead, matching the reference image's stylized-realistic PBR look. Three views side by side on a pure black background, identical scale, bottoms aligned on one horizontal line: front view, left side view, right side view. Orthographic, no perspective, flat neutral lighting, no cast shadows, no ground plane, no other objects, no text, no labels, no scale bars. Weathered materials with readable wear, slightly desaturated, warm earth tones.

- 组件描述（接在公共提示词前）：
  1. `A straight square timber post, 16 cm square and 2.4 m tall, aged pine with cracks and soot near the top, plain flat ends, no carving.`
  2. `A straight wall panel 2.0 m wide, 2.2 m tall, 12 cm thick: woven bamboo wattle plastered with ochre clay on the upper part, horizontal weathered planks on the lower 60 cm, clay partly flaked to show the weave. The panel has real thickness, no holes, and the back face is equally complete.`
  3. `The same wattle-and-clay wall panel, 2.0 m wide, 2.2 m tall, 12 cm thick, with a rectangular door opening 0.9 m wide and 1.95 m tall centered and cut fully through, framed by a simple timber door frame; no door leaf inside the opening.`
  4. `The same wattle-and-clay wall panel, 2.0 m wide, 2.2 m tall, 12 cm thick, with a window opening 0.8 m wide and 0.6 m tall whose sill is 1.0 m above the bottom, filled with vertical square timber bars (zhiling window) with open gaps between them, no glass, no paper.`
  5. `A straight horizontal timber beam, 2.0 m long, 16 cm square section, aged pine, plain flat ends.`
  6. `A triangular gable infill panel, 2.0 m wide at the base, 1.0 m tall, 12 cm thick, woven bamboo plastered with ochre clay, both faces complete.`
  7. `A rectangular thatched roof section, 2.0 m along the ridge, 1.7 m along the slope, 25 cm thick: thick dense rice straw thatch with no gaps, complete when seen from below, trimmed straight edges on all four sides, tied with bamboo strips. Show front view, side view as a thick slab profile, and a view from below.`（这一张第三视图改为仰视）
  8. `A straight thatch ridge cap, 2.0 m long, 45 cm wide, 30 cm tall: a bundled roll of straw pressed with bamboo poles and rope ties, flat cut ends so pieces join end to end.`
  9. `A single rustic door leaf, 0.9 m wide, 1.95 m tall, 5 cm thick: vertical weathered planks with two horizontal battens and a simple wooden latch, hinge side on the left.`
  10. `A campfire ring 1.0 m across and 35 cm tall: a circle of fist-sized river stones blackened by soot around a teepee of split firewood with charred ends, ash on the ground inside. No flames, no smoke, no glow.`
- 地面贴图提示词（gpt-image-2，1:1，不带参考图）：
  - 土：`Seamless tileable top-down texture of compacted farmyard dirt, 2 m by 2 m area, small pebbles, faint footprints and straw bits, warm brown-ochre, even flat lighting, no shadows, no objects, photoreal PBR albedo.`
  - 草：`Seamless tileable top-down texture of short trampled meadow grass with patches of dry yellow blades and clover, 2 m by 2 m area, slightly desaturated green, even flat lighting, no shadows, no flowers, photoreal PBR albedo.`
  - 石板：`Seamless tileable top-down texture of irregular flat grey-blue stepping stones set in dirt with moss in the joints, 2 m by 2 m area, even flat lighting, no shadows, photoreal PBR albedo.`

### 10.3 生模

- 先 A/B 一件 `wall_door`（最难：要贯通的门洞和厚度）：Rodin（fal，PBR，多图输入，约 0.4 美元）与 Tripo 多视图（fal 上的 v2.5 multiview，带贴图约 0.3 美元；官方 P2.0 要另开账号，多视图每次约 1.1 美元，先不开）。比厚度、门洞是否贯通、四边面、贴图清晰度，定一家。
- 其余 9 件用胜出的那家，约 3 到 4 美元。
- 生模合计约 30 元；本节合计约 35 元。

### 10.4 出图结果（2026-11-04）

13 张全出，`concepts/song_kit/`（每件一张 jpg，提示词存 `prompts.json`）；gpt-image-2 中档，13 × 0.376 = 4.9 元（第一轮并发超 10 个被拒 3 张，未计费，重跑）。地面三张已用脚本做成无缝平铺（中心原图、边缘半幅错位混合）。

| 件 | 判定 | 说明 |
|---|---|---|
| post / beam / gable / ridge / door_leaf / campfire | 可用 | 比例与禁项都守住；柴门量得约 0.8 × 2.0（要 0.9 × 1.95），导入时按尺寸表缩 |
| wall_plain | 可用，作墙段的样板 | 竹编抹泥 + 下段木板，泥皮剥落露出编竹，正是要的 |
| roof_thatch | 可用 | 第三视图是仰视：竹格压草，完整无洞（禁项起作用）；坡长比例约 1.55（要 1.7） |
| wall_door、wall_window | **不可用，要重出** | 被参考图带偏成院墙：夯土 + 瓦顶 + 石基，和 wall_plain 不是一种墙；门洞量得约 0.65 × 1.65 米，窄且矮（角色要 1.95） |
| 土 / 草 / 石板 | 可用 | 明度中位 129 / 91 / 117；土偏匀偏橙、要靠印章与贴花破；石板在接缝混合带有重影，当踏步印章用不影响 |

教训：参考图会把同族组件拉向参考图里最像的那件（墙 → 院墙）。同族的第二件起，参考图换成本族已定的样板（wall_door / wall_window 用 wall_plain 做参考），并在提示词里写"no roof tiles, no stone base"。

重出提示词（等用户点头，2 张约 0.75 元，参考图 `song_kit/wall_plain.jpg`）：前缀改为 `Exactly the same wall construction as the reference image: woven bamboo wattle plastered with ochre clay, horizontal weathered planks on the lower 60 cm, no roof tiles on top, no stone base.`，后接原第 3、4 条描述与公共提示词；门洞一条加 `The door opening is tall: 1.95 m of the 2.2 m wall height, and 0.9 m of the 2.0 m width.`

重出结果（2026-11-04，2 张 0.75 元，本节合计 5.64 元）：两张都改对了材质，和 wall_plain 同一种墙（竹编抹泥 + 下段木板 + 两侧立框），无瓦顶无石基。量得：墙宽高比 1.03（要 0.91，导入按尺寸表非等比缩）；窗高 0.65、下沿 0.93 米，合格；**门洞仍偏小，约 0.64 × 1.79 米**（要 0.9 × 1.95）。图像模型给不准洞口尺寸，再抽一次也没把握 —— 技术决定：生模后在 Blender 里移门框内圈顶点把洞口拉到 0.9 × 1.95（导入流程加一步"洞口校正"），不再重出图。第一轮的两张院墙样式移到 `song_kit/_archive/`，以后做院墙时可作参考。

### 10.5 补弱项与看光（2026-11-04）

脚本全在 `tools/blender/song_kit/`：`prep_textures.py`（拆视图 + 无缝 + 程序件 + 变体 + 地面 + 法线）→ `kitlib.py`（组件）→ `lineup.py` / `shed.py`（排开 / 拼装）→ `light.py`（看光出图）；量尺 `tools/tests/measure.py`。

| 弱项 | 改法 |
|---|---|
| 茅草是平板 | 五层台阶，每层 0.38 米，对齐贴图里四道压条（行 92 / 284 / 480 / 686）；每层顶一根真竹压条（半径 1.6 厘米，贴图取画上的压条行）；檐口圆鼻厚 0.27；两排透明垂草（程序画的草茎，约 15 厘米）；起伏噪声按 2 米周期取，相邻件接得上 |
| 屋面两片之间黑缝 | 贴图做成左右无缝（重叠带里逐行找差最小的切缝），去掉放宽 2% 的权宜做法 |
| 山墙一侧屋面齐边 | 加 0.3 米悬山收头：离接缝 0.15 米后厚度收到四分之一、下垂 7 厘米，像草卷下来 |
| 四面平墙一张图 | 原图 / 镜像 / 整面抹泥三种，四面墙用三种 |
| 门扇看不见 | 向内半开 28 度 |
| 地面浅、一片色 | 土压暗到中位约 67、去橙；草做第二层（噪声成片，房子周围 1 米踩秃）；大尺度明暗 0.82 到 1.1 |
| 没有起伏 | 每张贴图由明度推法线（细粗两尺度）；强度近景看过调低，墙 0.9、茅草 1.6 |

看光（Eevee，AgX 中高对比，长焦 135 毫米俯 30 度；**不等于游戏画面**）：

| 图 | 中位 | 最暗 5% | 其他 | 对照 M1 门 |
|---|---|---|---|---|
| 白天远景 | 53 | 14 | 受光屋面 98 : 背光侧墙 39（2.5 : 1） | 中位过；最暗 5% 差 2；光比过 |
| 白天近景 | 52 | 6 | | 过 |
| 夜晚远景 | 14 | 3 | 死黑 9.5%，过曝 0.1%（灯笼本体） | 死黑过 |
| 夜晚近景 | 29 | 2 | 死黑 11.2% | 过 |

光的参数（导进 /world 时照此改 vis）：白天主光 #f5e6c0 从右前方、俯角 47，天光改冷蓝灰 #c4d2e8（原 #e8e0c8 偏暖，阴影里没有冷色、整张一种黄），地面反光 #5e5444；夜晚月光 #9fb4dc 从左后方、夜空 #3a4c6e，门边灯笼 #ffc890、窗内透光 #ffbf80、篝火 #ffb47a。

**贴图密度没到。** 三视图一张图里放三个视图，单个视图的原图宽度有限：茅草正面原图 637 像素摊在 2 米上，实际约 320 像素/米；平墙约 400 像素/米；放大到 512 只是数字。要到 500 像素/米，得每件按单视图重出（一张图只画正面，1024 像素对 2 米），出图前先报提示词。

### 10.5 续：第二轮（2026-11-04，明度结构、旧化、地面散布）

第一轮之后的差处：材质明度都在 110 上下（ART-BIBLE 第 9 节第二条的老问题）、整张一种黄褐、地面空。改法：

| 项 | 改法 |
|---|---|
| 明度结构（贴图明度中位） | 泥墙不动（约 111，最亮）；茅草与屋脊 105、饱和 × 0.75（旧草）；柱梁 72、× 0.8；下段木板与门扇 62、× 0.75；土 67；石面 72 冷灰。墙图按"下段木板 + 两侧立框"掩膜只调木头部分。数在 `prep_textures.py` 的 `VALUE` |
| 脏边 | 墙脚、柱脚 35 厘米内渐暗到 0.55，夹噪声成片 |
| 茅草旧化 | 顶点色 Col（线性浮点）：近脊 1.04、近檐 0.84，夹 ±0.1 的成片斑；噪声按 2 米周期。导出 glTF 为 COLOR_0，three.js 材质开 vertexColors |
| 地面分层图 | `ground_mask.png`（12 × 12 米，32 像素/米）：R 草（噪声成片、房子 0.2 到 0.9 米内踩秃、路上无草）、G 潮暗（檐下滴水线 + 路）、B 路（门口向前弯出去） |
| 散布 | `scatter.json` 与分层图同源同种子：草丛 270 余丛（三片交叉插片，程序画的草叶，橄榄绿夹 18% 枯黄）、石块 40 块（四种，墙脚偏四角、路边、散落）、踏步石 7 块（三种），`scatter.py` 摆进 Blender；以后游戏里同一份数据做实例 |
| 门洞墙贴图 | 当初的拉伸没存脚本，复原不出（平均差 9）；改为按原图暗区重量门洞内口（裁框内 x 325 到 572、上沿 133），拉伸并进 `prep_textures.py`，文件名统一为 `wall_door_f / _s` |

| 图 | 中位 | 最暗 5% | 其他 | 对照 M1 门 |
|---|---|---|---|---|
| 白天远景 | 53 | 8 | 受光屋面 85 : 背光侧墙 38（2.2 : 1） | 全过（光比略低于 2.5） |
| 白天近景 | 40 | 3 | | 过（中位贴下限） |
| 夜晚远景 | 13 | 2 | 死黑 17.8% | 过 |
| 夜晚近景 | 22 | 1 | 死黑 15.7% | 过 |

### 10.6 材质板六块（2026-11-04 用户点头出图，结果见本节末）

解决贴图密度（实际 320 到 400 像素/米 → 目标 ≥ 500）。不再拿三视图当贴图，改成：可平铺材质 + 按组件的布局掩膜离线合成（泥皮 / 编竹 / 木板的分区来自现有三视图，掩膜放大不失真），合成到 768 像素/米。茅草直接用平铺材质，压条已是几何，不再靠画。也就是 ART-BIBLE 第二版第 3 节排过的"材质板六块"，把其中的石板换成泥皮（石板地面图已有）。

- 模型 gpt-image-2 中档（fal），1:1 1024 × 1024，单价 0.376 元，6 张约 2.26 元。不带参考图（参考图会把材质往它最像的那件上拉，见 10.4 教训）。
- 出图后脚本做两向无缝（最小差切缝）、量明度按 10.5 的档位调。
- 公共后缀：`Seamless tileable texture, orthographic straight-on view, the material fills the entire square frame edge to edge, even flat neutral lighting, no cast shadows, no vignette, no objects, no text, photoreal PBR albedo for a stylized-realistic game, slightly desaturated warm earth tones.`
- 六块（前接后缀）：
  1. 茅草：`Old rice-straw thatch surface seen straight on, 1 m by 1 m area, thousands of straw stalks running vertically top to bottom, densely packed in slightly uneven tufts, aged grey-brown with some golden stalks, no bindings, no rods, no gaps.`
  2. 编竹：`Bare woven bamboo wattle, 0.8 m by 0.8 m area, flat split-bamboo strips woven horizontally over and under vertical round stakes about 12 cm apart, weathered tan, dark gaps between strips, no clay.`
  3. 旧木：`Five horizontal weathered pine planks stacked edge to edge, each about 20 cm tall, 1 m by 1 m area, grey-brown sun-bleached grain, cracks, a few iron nail heads, thin dark seams between planks.`
  4. 泥皮：`Ochre clay plaster wall surface, 1 m by 1 m area, mixed with chopped straw fibres, trowel marks, fine hairline cracks, slight color mottling, no holes, no exposed weave.`
  5. 夯土：`Rammed earth wall surface, 1 m by 1 m area, horizontal compacted layers about 10 cm thick, small pebbles and straw, slightly crumbling layer edges, warm brown-ochre.`
  6. 青瓦：`Grey-blue fired clay roof tiles seen from directly above, 1 m by 1 m area, overlapping rows of concave pan tiles and convex cover tiles running vertically, slight moss and soot, Song-dynasty style.`

**出图结果（2026-11-04，6 张 2.26 元；营地小试累计 7.9 元）**：存 `concepts/song_kit/materials/`（jpg + prompts.json）。

| 块 | 判定 | 说明 |
|---|---|---|
| 茅草 | 可用 | 竖向草茎密实，旧草灰褐夹金；上下不连续（边差 3.6 倍），脚本修 |
| 编竹 | 可用 | 更像柳条筐的编法，墙里的编条本就如此；左右不连续，脚本修 |
| 旧木 | 可用 | 五块横板、钉头、板缝；偏冷灰（饱和 0.22），合成时乘暖 (1.08, 1.0, 0.86) |
| 泥皮 | 可用但偏素 | 1:1 有发丝裂纹和草筋，整面看平；合成时提中频、加大片斑驳 ±5% 与檐下竖向冲刷痕 |
| 夯土、青瓦 | 可用，留给院墙与主屋 | |

合成（`tools/blender/song_kit/materials.py`，prep 调用）：材质两向无缝（逐行 / 逐列最小差切缝）→ 按 10.5 的明度档调色 → 每件组件按布局合成到 **768 像素/米**（材质原图 1024 像素/米，实际细节约 768）：

- 墙五种：编竹区由旧图局部纹理强度找（立框边、顶边、门窗框外 8 厘米不参与），泥皮压在编竹上，编竹靠泥皮边 2 厘米内压暗、泥皮边一圈略亮；下段横木板、两侧竖木、门窗框按几何尺寸画；墙脚脏边重加。
- 茅草：沿用 870 行的分层排布等比放大 1.5 倍，每层铺茅草材质，层底一截压暗当草尖、层顶被上一层压着略暗；压条行程序画竹竿（圆柱明暗、竹节、绑扎）。
- 屋脊：茅草转横向，上下两根竹竿，每 0.5 米一道斜股绳箍（周期 1.4 厘米，圆柱明暗）。
- 柱、梁、门扇、山花：从旧木里裁整块板条拼（避开板缝），门扇加边框与四道横带（带落影），门闩从旧图放大搬来。
- 法线改由合成时的高度图推（泥皮高、编竹低、木板中），强度 3.5（6.0 时泥皮像拉毛水泥）。

看光（材质板版，同机位同光）：白天远景中位 55、最暗 5% 11、受光屋面 89 : 背光侧墙 35（2.5 : 1）；近景中位 40；夜晚死黑 16% / 14.6%。光同时微调：主光 6.3、天光 1.45、茅草档 112。

判断：**清晰度到了门槛（768 ≥ 500），但近景（屏上约 400 像素/米）新旧差别不大**，3.5 米细节镜头里才明显；旧图压条上画的绑扎结、泥皮的龟裂感读起来比新的有味道。游戏院子镜头（5 度长焦）屏上密度更低，贴图分辨率在对焦镜头（家具 10 度、物 12 度）才吃得到。下一步的画质大头不在贴图，在引擎里的光与地面（导进 /world）。

### 10.7 进引擎（2026-11-05）

链路（一条命令一步，全部可重跑）：`prep_textures.py`（拆图、合成、分层图、散布表）→ Blender 窗口里 `kitlib + lineup / shed / scatter`（建、拼、摆）→ `export_kit.py`（每件一个分离式 glTF + 偏屋预制体 JSON）→ `python3 tools/asset_import.py --components <导出目录> --pack song`（入库）→ `world/camp.html`（读表与预设搭场景）→ `python3 tools/tests/camp_shot.py`（真显卡截图 + 量明度）。

- 入库（组件模式）：保留原点、不缩放；面数按本表上限，超 15% 拒收（窗洞墙两段倒角时 1620 面被拒，导出改一段倒角后 660）；贴图按文件名去重放 `world/packs/song/tex/`（50 张，JPEG 85，法线也转 JPEG），带透明的散草、草丛内嵌并改透明裁切；几何内嵌。共 24 件登记进 props（`pack: song`）。
- 数据：rooms 加 `camp`（12 × 12 米露天，三个机位照 Blender 看光换算）；vis 加 `camp:day / camp:night`（物理单位，见技术卡十六）；presets 加 `camp`（偏屋预制体、地面分层、散布、篝火灯）；preset Schema 加 `Ground`、`Scatter` 组件与灯的 `periods`、变换的四元数；tiles 加露天墙段。
- 真显卡（Windows 侧 Chrome 无头 + 远程调试，RTX 3060 笔记本，档位 2）数字：

| 图 | 中位 | 最暗 5% | 死黑 | 其他 |
|---|---|---|---|---|
| 白天远景 | 55 | 7 | 4.3% | 受光屋面 103 : 背光侧墙 37（2.8 : 1）；190 draw call、4.6 万三角面 |
| 白天近景 | 42 | 1 | 11.4% | |
| 白天细节 | 33 | 0 | 15.3% | 檐下与门洞里，正常 |
| 夜晚远景 | 22 | 2 | 13.6% | 过曝 0.1%（灯笼本体） |
| 夜晚近景 | 28 | 2 | 8.5% | |

M1 画质门：白天中位 40 到 55 过、最暗 5% ≤ 12 过、≥ 500 像素/米过（768）、夜晚死黑 < 30% 过；对照墙绝对分待用户打。

没到的：下载 13 MB（阶段 3 首包目标 8 MB；1 档改半分辨率 + 图集）；190 draw call 超 1 档上限 120（预制体按材质合并静态几何）；光比 2.8 比目标 2.5 略硬；篝火只有光没有模型；人形巡检未做。

### 10.8 篝火改 Blender 程序建（2026-11-05）

用户问"篝火我们的 Blender 做不出来吗"——做得出来，且更合适：形状是石圈 + 劈柴 + 灰 + 炭，都是几何体，按尺寸写脚本不花钱、尺寸准、材质与偏屋同一套。原计划的 Rodin（约 0.4 美元）不用了；"Rodin 正规接光"那一项留给营地切片里 Blender 程序建不好的有机件（柿子树、竹丛）去验证 —— Claude 定，可逆。

- 做法（`kitlib.m_campfire`）：12 块河卵石（二十面球细分两级、噪声起伏、大小 0.75 到 1.25 倍，内侧与顶上按顶点色熏黑）；7 根劈柴（五边形截面，两面是浅色木茬 `firewood.jpg`、三面当树皮压暗，上半截烧焦）；灰烬（中间炭黑、外圈灰白，外缘按噪声起伏不成正圆）；6 块炭（材质 `m_ember`，夜里自发光）。1272 面，1.06 × 0.95 × 0.38 米。
- 进引擎：预设里一个模型实体 + 一个光实体（光源放在柴堆尖顶上方 55 厘米，35 厘米时紧挨柴头照成一片白）；`camp.js` 支持预设里直接放模型，材质名含 ember 的夜里自发光；房间表加篝火机位，截图脚本白天 / 夜晚各拍一张。
- 顺带查出的坑：Blender 网格没有"活动颜色属性"时，glTF 导出器先写一组全白的 COLOR_0，真数据在 COLOR_1；入库时删 COLOR_1 就把顶点色全丢了 —— **屋面的旧化之前在引擎里其实一直没生效**。修法：kitlib 建网格后设活动与渲染颜色属性（`_active_col`）；入库遇到两组颜色且第一组全白时改用第二组并提示。
- 截图脚本改成整轮只加载一次页面（每张重载会累积显存，第 7 张起 WebGL 上下文丢失、页面崩）。
- 数字（真显卡，修好顶点色后）：白天远景中位 54、最暗 5% 7；近景 41；夜晚远景死黑 13.7%；篝火机位白天中位 60、夜晚 78。
- 还差：火焰（特效层，没做）——现在火光从上方照下来，柴头偏亮，有火焰后光源位置才自然。

### 10.9 火焰（2026-11-05）

程序化，不用任何贴图素材：`world/render/fire.js`，定义在 `world/packs/song/vfx/campfire.json`，预设里 `campfire_vfx` 实体的 Vfx 组件指过去。

- 火焰：4 片交叉竖面（1 米高、0.52 米宽），片元着色器里分形噪声往上翻滚，"噪声减高度"让火舌往上断成几条、顶端在面片内收住；根部浅黄、中段橙、外缘橙红；叠加混合、不写深度。
- 火星：30 颗点精灵，按各自种子循环上升 1.6 米、左右晃、变小变暗。
- 烟：一片只绕竖轴转、始终正对镜头的竖面，噪声做往上飘、往一边歪的烟柱。
- 按时段：`modes` 白天与黎明 smolder（只冒烟，余烬不见火），黄昏与夜晚 burn（火 + 火星 + 淡烟）。
- 火光：预设灯加 `flicker`（篝火 0.18、灯笼 0.06），强度乘三个不同频率正弦之和；灯笼纸自发光也跟着微晃。光源放在火焰上部 80 厘米（35 / 45 / 60 厘米时柴堆尖顶都被照白）。
- 调过的坑：亮度 5 时 AgX 色调映射把橙红压成粉白，降到 1.8、颜色往橙黄收；火舌一开始顶到面片边被切平。
- 数字（真显卡）：夜晚篝火机位中位 82、亮 5% 148、过曝 0；夜晚远景死黑 12.8%；整帧多 5 个 draw call。动图 `tools/out/camp/campfire_night.gif`（两帧之间火焰区域差 10、地面差 6，火光闪烁照到地上）。

