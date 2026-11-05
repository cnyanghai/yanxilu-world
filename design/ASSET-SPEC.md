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
| 2 | 平墙段 `wall_plain`（竹编抹泥，下段木板） | 2.0 × 0.12 × 2.2 | 4 | 800 | 墙有厚度、无破洞、背面同样完整 |
| 3 | 门洞墙段 `wall_door` | 2.0 × 0.12 × 2.2，门洞 0.9 × 1.95 居中 | 1 | 900 | 门洞贯通、洞口净高 1.95（角色 1.5 × 1.3） |
| 4 | 窗洞墙段 `wall_window`（直棂窗） | 2.0 × 0.12 × 2.2，窗 0.8 × 0.6，下沿 1.0 | 1 | 1000 | 窗棂之间透空、不要玻璃 |
| 5 | 檐梁 `beam` | 2.0 × 0.16 × 0.16 | 6 | 200 | 直、端头平 |
| 6 | 山花 `gable`（三角，竹编抹泥） | 2.0 × 0.12 × 1.0 | 2 | 400 | 三角形、两面完整 |
| 7 | 茅草屋面片 `roof_thatch` | 沿脊 2.0 × 坡长 1.7（含 0.3 出檐）× 厚 0.25 | 4 | 1500 | 厚实、无缝、从下方看也完整、边缘收齐不散 |
| 8 | 屋脊 `ridge`（茅草压脊 + 竹捆） | 2.0 × 0.45 × 0.3 | 2 | 600 | 两端平、可首尾相接 |
| 9 | 柴门 `door_leaf`（交互物件，三态） | 0.9 × 0.05 × 1.95 | 1 | 400 | 单扇、门轴在左 |
| 10 | 篝火 `campfire`（石圈 + 柴，不含火焰） | 1.0 × 1.0 × 0.35 | 1 | 1500 | 不要火焰与烟（火是特效） |

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
