---
type: status
status: active
cluster: product
stage: M1 进行中；排练完成，PIPELINE 1.0 草案已并入抖音水上村落的四条规矩；当前交付物是宋代营地一周小试（偏屋组件 + 篝火 + 地面）
next: 用户看 ASSET-SPEC 第 10 节的出图方案点头 → 出三视图与地面贴图 → Rodin / Tripo A/B 一件 → 导入拼偏屋 → 夜晚光与截图打分（量 M1 画质门）
blocked_by: 无（服务器新克隆的每 5 分钟 git pull 由用户照书架那条加）
updated: 2026-11-04
---

# 状态

## 现在停在哪

- 本仓库是研习录版本 2（三维小世界，游戏项目），2026-11-02 从 `cnyanghai/yanxilu` 拆出，历史全部保留；书架网页留在那边，两边共用 Baba 的数据接口。
- 代码：`world/`（three.js，九张表 + 预设 + Schema，工坊面板）、`room/`（CSS 3D 样机，待归档）、`studies/`（临摹练习）、`tools/`（资产入库、烘焙、表校验、测试、暗黑 2 研究解码）。
- 排练（design/studio/REHEARSAL.md）四阶段 2026-11-01 完成：资产解包导入、预设摆放、光与后期、角色与交互，每阶段的"学到的与改的"都已落进表与 Schema；生产流程 1.0 草案在 design/studio/PIPELINE.md。
- 线上 /world：2026-11-03 服务器已克隆本仓库到 /opt/yanxilu-world 并在 /opt/yanxilu 放了 `world` 链接，页面、引擎、表全部 200；推 main 后由服务器的 git pull 上线（新克隆的 cron 由用户加）。
- 仍是灰盒：没有自己的正式资产，数据是 sample.js，还没接 S.data。

## 当前阶段与下一步

**当前里程碑：M1 工具先行与骨架。** 第 1、2 天与第 3 天一部分已做；中途插入暗黑 2 排练（四阶段完成，流程草案 design/studio/PIPELINE.md）。M1 剩余（真显卡截图、灯光第一轮、三件道具试产、Rodin 正规接光、画质门第一次量化打分）并进下面的营地小试一起交。计划以 design/studio/REVIEW-1.md 第 3 节为准。

**这次的交付物：宋代营地一周小试**（ART-BIBLE 第二版第 3 节）= 用自己的资产按 PIPELINE 走一遍。
1. 套件表与三视图提示词：design/ASSET-SPEC.md 第 10 节（偏屋拆 8 个组件 + 篝火 + 地面三层）。等用户点头出图。
2. 生模 A/B：同一件带门墙段，Rodin 与 Tripo 各出一次，定生产用哪家，其余组件跟上。
3. 导入（尺寸吸附、接缝、镂空率）→ 预制体拼偏屋 → 地面层 + 印章 → vis 夜晚 + 篝火局部光 + 环境遮蔽 → 人形实测 → 真显卡截图，放主视觉 02 与暗黑 2 截图旁打分，量 M1 画质门。
4. 走通后：PIPELINE 去掉"草案"，删 tools/out/d2r_local。

## 已定决策

- 2026-11-04 技术决定：建筑与大件拆组件生成、三视图输入、尺寸吸附与接缝 ≤ 1 厘米、禁项写进提示词、人形实测与巡检；贴图按每米像素统一，1 档同一预制体合图集、2 档以上主角件独立三件套（PIPELINE 1.5 到 1.7）—— Claude 定，可逆

- 2026-10-31 第一个题材包改为宋代田园（现代书房的家具降为占位与以后的包）；视觉语法照暗黑 2，镜头去掉晃动固定俯角，渲染风格改风格化写实 PBR，世界结构向小镇枢纽加可进的房子；验证顺序改为先定风格、一周小试、营地切片 —— 用户同意出图方案并由此推进（渲染风格、镜头、小镇三条按此执行，用户可否）；塔防刷怪的映射暂不考虑
- 2026-10-30 用户「全部通过」：两份裁判页（支柱四根、第一个可玩版本五件事、里程碑时间盒约三个月到 Beta、现金上限 300 元、外请美术触发条件）与 REVIEW-1 第 4 节七条（货币「墨」与三个软增益与三道门、四时段加雨天、角色光圈仅黄昏夜晚、书房 4.5 × 3.5、HUD 四样贴边、默认静音点灯开声）
- 2026-10-31 M1 第 1 天技术决定：表放 world/data/，Schema 放 world/data/schema/，校验脚本 tools/tables_check.py 进测试前置；院子地块 7 × 9 每格 1 米；门是 door 类型槽位；函数表十四个 —— Claude 定
- 2026-10-30 评审会一（studio/REVIEW-1.md）：七表两文件（objects / rooms / vis / props / items / economy / sound + presets + placements）与组件 JSON 外形；三层四目录、七个组件、三档、1 档预算、合成后期、Rodin 正规接光、真显卡截图互斥、Python 拼接、Schema 校验前置、canPlace 纯函数、编辑器动作对象 —— Claude 定；房间 4.5 × 3.5、四时段加雨天、角色光圈仅夜晚、HUD 四样、默认静音、货币名与软增益与三道门、时间盒与预算与外请触发 —— 待用户定
- 2026-10-30 规矩改为「博采众长：学各家（暗黑 2、炉石、魔兽、恶意不息、kriss）的机制、结构、表、流程、光与镜头；不把任何一家的资产放进仓库和产品；本机可读其文件研究」—— 用户定，写入 CLAUDE.md
- 2026-10-30 采纳暗黑 2 的结构（D2R-DISSECTION 第 7 节）：一切是表（objects / rooms / vis / props）、交互物件三态状态机、vis 式光照记录、角色独立布光与光圈、每件独立贴图、墙段透明、硬件分档 —— Claude 定，技术决定
- 2026-10-30 角色基础身体用四视图 02（design/concepts/character_turnaround_02.jpg）—— 用户定
- 2026-10-30 阶段 1 风格圣经过门 —— 用户说「过」。资产规范（design/ASSET-SPEC.md）：单位 1 米、网格 0.5、原点底面中心正面 -Z、房间 5.2 × 4.2 × 3.0、六种槽位类型、尺寸与面数表、交付六件、包目录、角色身高 1.5 头身比 1 : 4.5 标准人形骨骼 —— Claude 定（技术规矩，可逆）
- 2026-10-30 渲染风格：手绘贴图风，主视觉定稿 design/concepts/keyart_modern_r2_B.jpg —— 用户定（Claude 建议过清爽哑光 A）。约定：阶段 3 开头五天手绘复现验证，材质与整体感不到 3.5 分则回 A 并保留 B 的角色比例与暖色板
- 2026-10-30 色板草稿六色（ART-BIBLE 第 5 节）：暖米白 #f3ddb9、橡木 #987755、墨青 #182121、黄铜 #dfaa6d、本色 #e5c08e、炭 #3f2814 —— Claude 从 B 取色，阶段 2 前可微调
- 2026-10-30 视角与操控：在场为底，对焦为点 —— 镜头锚在角色上、固定俯角约 40 度、跟随、两级放大；书墙 / 笔记本架 / 案头三处点一下切到 kriss 式对焦机位；点书自动走过去取下；地址即传送。用户定。推翻 10-28 的"四景别机位、路由即镜头、相机在房外"。阶段 3 时间盒改三周
- 2026-10-30 角色为皮克斯式卡通人物（风格类别，不用 IP）；资产复用规矩七条（ART-BIBLE 第 7 节）—— 用户提出复用与商店，Claude 定技术规矩
- 2026-10-30 格子家具（书墙、笔记本架、档案架）由 Blender 按尺寸表建模烘焙，Rodin 只做自由家具与商店物件 —— Claude 定（书盒槽位要和格子严丝合缝），记 ART-BIBLE 第 9 节
- 2026-10-30 范围第二稿（design/SCOPE.md，用户已说定，阶段 0 过门）：笔记本是书架上的实体、多本、日记并入；植物动物不随阅读生长，做成商店里带三维形态的卡片，买回放预设槽位；角色是游戏式三维人物（骨骼动画）而非纸人；社交放阶段 5；风格做成包，第一个包 kriss 式现代书房，之后宋朝田园小院、酒馆、魔法书院 —— 用户定，Claude 同意并记录代价。**推翻**：文竹主角与随读生长（10-28）、一种风格纸木墨铜（10-29）、纸人（10-30）、砚笔入口（10-30）。
- 2026-10-30 项目改按制作总计划推进（design/PRODUCTION-PLAN.md）：五个阶段各有交付物、门、预算、时间盒；每次会话开头报阶段与交付物；新想法进待办区不打断当前阶段 —— 用户提出要项目经理思维，Claude 按游戏制作流程排定
- 2026-10-30 练习顺序：先临摹 kriss 的一间房（咨询室），再农场，再回到书房 —— 用户定。
- 2026-10-30 决策方式（design/HOW-WE-DECIDE.md）：用户只在看得见的事上做决定（图、动效、上手），技术决定由 Claude 做并记录、可逆；愿景板 + 十条验收单 + 对照墙六项打分；两轮不像就换方向。
- 2026-10-29 总体方案（design/MASTER-PLAN.md）：运行时照 kriss、资产照农场视频的生产线，三层结构（资产 / 世界 / 运行）；小镇式横向铺开不做纵向叠楼；主线一种风格（纸木墨铜、概念图 B 方向），风格包机制预留，魔法书院只作以后的风格包且不用 IP；烘焙的三维（不是预渲染图片也不是游戏引擎）；不请架构师，需要时请一位三维美术做主角家具与 look-dev。
- 2026-10-29 图生三维先用 fal 上的接口（Rodin Gen-2 / 2.5 fast、Hunyuan3D 等），不开 Hyper3D 网页账号 —— 用户定；已有 fal 钥匙，按次计费、可脚本化。
- 2026-10-28 默认光定晴窗，夜读 / 雨天作切换模式 —— 色彩板对照后用户定；第一眼要亮、干净、有纸的质感。
- 2026-10-28 版本 2 的镜头视场角定为：院子 5 度、整间 8 度、案头 12 度（长焦，相机在房外）—— 静帧对照后用户按建议定；构图细节由 Claude 先改一轮再做色彩板。
- 2026-10-28 建模分工定为 CC0 套件 + 程序化起步 —— 没有三维美术，先把镜头、槽位、光的流程跑通，正式美术以后再定。
- 2026-10-28 版本 2 首屏主角定为案头的文竹，今天的牌放桌上第二位 —— 文竹是唯一随时间生长的物件，三维里的生长最能体现"养"。
- 2026-10-28 现有网页版定为版本 1 系列，保留并继续可开发；版本 2 在同仓库 `world/` 目录开发，共用数据层和二维阅读器 —— 版本 1 兼作低端设备的回退界面。
- 2026-10-28 版本 2 引擎选 Three.js 原生 + importmap，不引入 React / Svelte / 打包器 —— 现有代码无框架，团队熟悉，国内不能依赖任何 CDN 和云编辑器。
- 2026-10-28 渲染分两层：建筑层 Blender 烘焙、物件层程序化几何实时 —— 书、盒、牌是数据生成的，不可能逐件建模。
- 2026-10-28 第二间房选花房不选宠物间 —— 植物的"养"有现成数据，宠物要另起一套行为系统。
- 2026-10-27 气质与材质纪律（纸木墨铜、一盏灯、三间房、四景别）见 `design/BRIEF.md`。

## 未决问题

- 第二种风格包选哪个。
- 在制品：brain 已有 5 个进行中项目，研习录登记后是第 6 个，开工前要暂停一个。
- 版本 2 的"走进别人的院子"与 2026-07 的"智慧树型社交"是否合并成一个愿景的两种形态。
- 宝石规则是否改成按"能不能回忆"定（沿自 BRIEF）。

## 日志

- 2026-11-04 用户给两条抖音（Astra 一夜做游戏、Tripo P2.0 + Opus 5.5 在 Godot 拼水上村落）：取视频抽帧看完，落 REFERENCES；结论是画质先靠光与地面层，资产走模块化套件 + 尺寸脚本 + 禁项提示词 + 人形实测，图集与"每件独立贴图"相冲待定
- 2026-11-03 Baba：/opt/yanxilu-world 克隆 + /opt/yanxilu/world 链接完成，线上 /world 恢复（页面 / three.module.js / world.js / vis.json 均 200）；拆分全部收口
- 2026-11-03 用户在网页建了 cnyanghai/yanxilu-world（公开）并推送，远端与本地一致（2b33157）；剩 Baba 一步
- 2026-11-02 拆分后续：baba_mock 在没有书架首页与嵌入脚本时也能起（游戏仓库单独跑测试）；REFERENCES 的 frontmatter 改为本项目名；发现 world/ 用 ../vendor 引 three.js 与字体，拆分后线上会找不到，vendor/three 与 vendor/fonts 已挪进 world/vendor/，world/index.html、world.js、room/index.html 改为相对 world/ 的路径，回归通过；线上只需书架克隆里一个 world 链接；GitHub 建仓与推送、Baba 的 /world 链接仍留给用户
- 2026-11-02 拆分成独立项目：从 yanxilu 本地克隆（全部历史），删版本 1 的 src / index.html / server / dist / reports / study / build.py / katex / pdfjs / pwa 与档案架测试，去掉 v1 标签；CLAUDE.md 与 README 重写；brain 登记、记忆目录（五条反馈记忆复制过来）、tools/out 本机产物搬来；GitHub 仓库建立与 Baba 的 /world 链接留给用户
- 2026-11-02 用户要求拆成两个对话项目；盘点结论：版本 1 与版本 2 代码互不引用可干净拆开，分配表与四个决定已交用户，未动手。tools/out 下的回归截图是测试产物不入库
- 2026-11-01 排练阶段四：拆野蛮人状态机（65 态 440 动画 14 类手持物 4225 转移淡接 0.2）、时间线（278 条 30 帧 8 种事件，声音 618 脚印 146 释放点 31）、宝箱门三态；合成预制体把三档部件 21 件拼成三个人本机渲白天夜晚；写 characters.json 第九张表 + Schema（骨架 ≤ 80、部件三档、14 状态、6 手持物、绑定规则、转移默认 + 例外、时间线事件五种）并登记 tables.js；objects 的门盒牌书三态加 loop / crossfade，transitions any；PIPELINE.md 生产流程 1.0 草案七节；D2R-DISSECTION 第 19 节；tables_check 登记 characters 表校验通过，world_test 回归跑完再提交；四阶段对照图（本机 tools/out 下，不入库）均已发用户
- 2026-11-01 阶段三补一轮（用户评图后）：地面底层换小路土层 + 草地层噪声成片 + 印章层、主光 1.1 环境 .4、环境图跟主光色 → 白天泛绿消失、光比 1.6、黎明暖黄昏蓝紫；夜晚死黑升到 43%（压环境光的代价）；白天 3 夜晚 3.5 黎明 3 黄昏 3；REHEARSAL 数字表改成三列，学到的加三条（底层是土、黎明靠色、必须有环境遮蔽）；一行内注释吞代码的低级错误耗了一轮
- 2026-11-01 排练阶段三：vis 六时段导成紧凑表（俯角一律 47°、曝光恒 4.0、世界光只一盏主光 + IBL + 深度雾、角色另有 8 盏）；scene.html 改 vis 驱动 + 两层地面（草地层 + 印章 alpha 加噪声）+ 17 贴花 + 贴地网格 alpha 混合 + 合成后期；五轮调参：发现合成后期的深度雾在 swiftshader 下读不到深度（整图糊白，Composite 加 samples 选项）、vis 灯方向四元数指向太阳要翻、线性映射白天冲灰夜晚死黑 → 主光 √功率 IBL^0.4；定稿白天中位 57 跨度 61、夜晚死黑 38%；vis.json 加 ibl / characterShadow / characterBrightness / itemBrightness 与 mapping，vis.schema 同步；TECH-NOTES 卡十二；D2R-DISSECTION 第 18 节
- 2026-11-01 排练阶段二：拆 towne1.json（1639 实体 16 组件、7 个预制体、105 特效 171 音源、墙透明全在藤蔓上、朝向与缩放分布）、pf_town_tent02（88 实体）与 pf_town_campfire01（147）、act1_outdoors 生物群系（10 地面层 + 杂物 + IBL）、vis 白天夜晚逐字段对照；写 scratchpad/d2r_prefab.py（解包 lod0 → 转换清单 → 贴图解包解码 → 场景清单，封包路径小写重试）与 d2r_local/scene.html（多实例、点灯、档位）；46 模型 84 贴图一次转完，帐篷预制体四张截图；preset.schema 加 9 个组件定义；D2R-DISSECTION 第 17 节
- 2026-11-01 用户放行转换器 → 权限文件只留 `python3 -I ~/.local/src/d2rconv/*`（dotnet 两条删了）；转换器补静态网格两行，加 run.py 把用户 site-packages 加回隔离模式；箱子 / 帐篷布 / 右臂转 glb；cascx 补解帐篷营地贴图 21 张；写本机看图页 view.html（去蒙皮按绑定姿势、藏占位材质、程序化环境图、白天夜晚两套灯）+ Playwright 截图；发现 texture2ddecoder 输出 BGRA（皮肤红蓝均值反了）修 d2_decode；金属度读对后要环境图；四格对照图发用户；学到的八条记 REHEARSAL，D2R-DISSECTION 第 16 节补贴图实测
- 2026-11-01 排练立项（REHEARSAL.md 四阶段 + 五条护栏）：tables_check 加 d2r_local 守卫；按用户选的第二条加 dotnet 构建权限规则并编译 LSLib → 卡在 Windows 专用 GpLex / Gppg；再查 .model 段头发现 261 个样本 522 段全是 BitKnit2（类型 4），LSLib 解它要 granny2.dll 而 D2R 静态链接无 dll → LSLib 排除；搜到 WindyYam 的 MIT 纯 Python 转换器（自带 BitKnit2 纯净室解码），克隆到 ~/.local/src/d2rconv 并审阅，运行被分类器拦下等用户授权；.model 容器与顶点格式写入 D2R-DISSECTION 第 16 节，四条参考落位
- 2026-11-01 用户授权装 texture2ddecoder → 重制版 .texture 格式推出来了：头 '<DE(' + 格式号（61 线性 / 62 sRGB）+ 宽高 + mip 数 + mip 表（offset 相对表项），块是 BC3 而非 BC7，mip0 从文件尾倒推；解出木箱三件套、野蛮人头部颜色与法线、帐篷、兵营柱墙，拼图发用户；解码并入 tools/d2_decode.py（texture 子命令）
- 2026-11-01 用户要看暗黑 2 资产图：写 tools/d2_decode.py（DT1 瓦片、DC6 精灵、重制版 SpA1 sprite 的纯 Python 解码；.texture 是 BC7 自有格式，装解码库被权限拦下未解），解出城镇地砖 8 块、弓与头盔图标、长剑胸甲盔甲的背包精灵，拼图发给用户；解出的图只在 tools/out/d2assets 本机看，不入库
- 2026-11-01 落进工具：asset_import.py（图片走 Rodin PBR → gltf-transform 减面到预算 → Shaded 自发光搬回 baseColor → 贴图 JPEG 1024 → 包根节点落地居中按占地缩放 → JSON glTF → packs/<包>/<类>/<id>/ 加定义 JSON → props 登记；偏差超 35% 提醒）重导 desk / deskchair / chair；tiles.json（地面块 6、墙段 6、屋顶 2）+ rooms.tiles（书房 9 × 7 地面网格与四边墙段含窗门、院子 7 × 9 含门楼竹篱石板路菜畦）+ Schema + 校验（网格尺寸、四边墙段正好覆盖一遍）；tables.js 与单测加载 tiles；1 档截图无报错
- 2026-11-01 用户否了 NB2 白天图，要求深拆暗黑 2 的流程 / 图像 / 摆放 / 资产 / 动作 / 装备 → 从封包取 towne1.ds1（解析版本 18：57 × 41 格、2 墙层 1 地层 1 影层、9 个瓦片集、43 个物件）、floor.dt1（144 块 160 × 128 地砖）、帐篷目录（5 级 LOD + 布料 + 骨骼）、野蛮人（65 状态 440 动画 × 14 武器类、部件 lit / med / hvy 三档）、旧版 COF 150 个（模式 × 武器类）、长剑定义、armor.txt 外观列；写 D2R-DISSECTION 第 9 到 15 节
- 2026-11-01 Midjourney 无官方 API（只有违反条款的第三方壳）；写 3-Resources/media-toolkit/fal_image.py 通用端点脚本；Nano Banana 2 2K 出宋代院落白天两张（0.24 美元）存 concepts/song_court_day_nb2_*，结论按活分工：NB2 管布局与套件、gpt-image-2 管光；青绿山水色板取色石青 #073a67 天青 #6baec9 月白 #bedbe2 泥金 #c9a05a 靛 #1b3a6b，做天与皮不做地；夜景等引擎里出
- 2026-10-31 宋代田园营地主视觉两张 + 套件表一张（1.13 元）存 concepts/song_camp_*；ART-BIBLE 第一版作废为参考，开第二版一节；讨论记录：地面是材质层 + 遮罩 + 印章贴花、草石散布实例、大件手摆
- 2026-10-31 用户看效果后提出：不该再用 kriss 时期的图和晃动镜头，要按暗黑 2 的视觉与布局微调进项目，学习养成种植社交之外还提了塔防刷怪；团队意见已答（换参考与镜头、风格化写实 PBR、小镇枢纽、塔防刷怪动支柱要单裁）；用户收回映射讨论，定为先找风格再验证能否做出罗格营地；制作人建议营地切片替代书房切片，等用户定。tools/out 的截图是临时产物不入库
- 2026-10-31 回归超时的根子：swiftshader 4 帧每秒，每帧步进上限 0.05 秒让 2 秒过渡走十几秒 → 上限放宽到 0.1 秒、测试等待 45 秒并打印每条路由耗时；tools/asset_shrink.py（glTF 内嵌贴图 PNG → JPEG，重建 buffer）三件家具 13.6 → 0.4 MB；回归通过
- 2026-10-31 M1 第 3 天第一步：objects 加高度；props 指向 packs/modern/furniture/（Rodin 三件 Draco 后转 .gltf.json，约 13.6 MB，KTX2 后再减）；world.js 的 VERIFY_SLOTS 换成 loadPresetFurniture（按预设实体 + 占地宽深高缩放 + 原点落地）；桌椅模型里混进一把椅子加一个凳子（Rodin 第二版把参考图两件一起出了），占位先用
- 2026-10-31 M1 第 2 天收尾：rooms 加 preset 字段避免 404；?tier=1 截图三种光验证合成后期；world_test 通过；提交
- 2026-10-31 M1 第 2 天（技术总监）：表格式定稿为厘米；world/data/tables.js（loadTables、validate、visFor）、world/sim/grid.js（Grid、roomGrid、astar、canPlace）、world/render/{post,tiers}.js；world.js 导入三者，LIGHTS 常量换成 vis 表 + 雨天天气层 + bakeSet 别名（黎明借白天、黄昏借夜晚，待重烘四时段）、曝光随 vis、1 档以上走合成后期、工坊面板显示档位与表状态；world/package.json 声明模块让 Node 能测；sim_test 暴露格心半厘米问题 → 占地内缩 1 厘米
- 2026-10-31 M1 第 1 天：studio/level/study-plan.md（平面图、对焦站、走点规则、检验）、studio/GDD.md、world/data/{objects,rooms,vis,props,items,economy,sound}.json、presets/study.json（实体-组件，模板 ^ 多实例 @ 删除 -）、schema/ 九张、tools/tables_check.py（Schema + 交叉引用 + 格子越界重叠）；首跑抓出 7 处错已修；ASSET-SPEC 房间改 4.5 × 3.5
- 2026-10-30 十个代理回齐：refs/redalert-source.md、refs/openra.md、proposals/01 到 08；写 REVIEW-1（裁决表、七项冲突裁决、M0 到 M6 里程碑、七条待用户定、技术决定清单）；PRODUCTION-PLAN 顶部改为指向 REVIEW-1
- 2026-10-30 用户定：摒弃自设限制，完全以暗黑 2 设计思路为基准，团队建制照暗黑 2，每岗提案再推进；红警用 EA 开源源码与 OpenRA 分析不下载游戏；授权 Claude 自行判断用代理。建 design/studio/（README 建制与流程、proposals/00 两份裁判页），克隆红警源码与 OpenRA 到本机临时目录，派 2 个读源码代理 + 8 个岗位分叉代理；01 首席设计师提案已回（核心循环、货币「墨」、舒适度公式、六张表、八个函数名）
- 2026-10-30 用户授权编译 CascLib → 读 D2R 封包 175,813 文件：导出 364 张表、vis 369 个、prop_palette、towne1 预设、门箱状态机、biome、LUT；统计贴图 1024² 为主 2.2 万张、8232 网格各 5 级 LOD；写 design/D2R-DISSECTION.md（8 节，采纳清单 14 条）；误导出的 9 GB 音效界面已删，导出物只在本机临时目录
- 2026-10-30 用户给暗黑 2 重制版三张截图与恶意不息农舍视频，问能否读源码、为何精细、视频启发 → 看了 D2R 安装目录（无源码，CASC 封包，不解包）；视频经页内接口取回 56 秒截帧；三项分析与舒适度机制写入 ART-BIBLE 第 9 节第四天续，REFERENCES 落位两条
- 2026-10-30 用户：渲染远达不到画质标准，先不做先分析 → 量了明度中位数（B 38 / 我们 71）、明暗跨度、墙地毯地板明度（B 有层次、我们一样亮）、壳贴图 205 像素/米；六条原因按影响排序与各自代价写入 ART-BIBLE 第 9 节第四天；第 3 天的「通过」作废
- 2026-10-30 验证第 3 天：格子书墙与斜面档案架建模烘焙（两次重烘，斜面板旋转修正）、书盒逐格、读书椅窗边、桌子三轴缩放、桌椅重出仍是凳子；对照墙 concepts/verify_day3.jpg 打分 3.5 / 3.5，画法路线定稿记 ART-BIBLE 第 9 节；验证合计约 18 元
- 2026-10-30 验证第 3 天开工：study_scene.py 格子家具（shelf_unit 加隔板、厚板圆边、斜面板）、FREE_FURN 关掉桌椅灰盒、config() 导出 cols/side/div/slant/free_furn；world.js 加 cells() 书盒逐格摆放、VERIFY_SLOTS 只剩桌椅与读书椅（椅放窗边 -1.85,-0.45）；Rodin 桌椅第二版（带靠背提示词，0.4 美元）；paint_verify 加 day3 步骤；重烘中
- 2026-10-30 验证第 2 天收尾：去黑影重烘提交；对照墙存 concepts/verify_day2.jpg；图生图贴图路线排除、paint_ai 目录删除；打分 3.5 / 3
- 2026-10-30 验证第 2 天：色板材质重烘三种光；四件家具 Rodin（1.6 美元）减面放入 assets/verify；Rodin Shaded 贴图在 emissiveMap、亮度乘 bake_scale 对齐；烘壳时隐家具去黑影（bake_study.py）重烘中；打分材质 3.5 整体感 3，记 ART-BIBLE 第 9 节；world_test 单独重跑通过
- 2026-10-30 验证第 2 天开工：study_scene.py 加 srgb() 与 grain 参数，材质按六色色板重设（墙暖米白噪点、地板与木作波纹木纹、扶手椅墨青），后台重烘三种光；world.js 加 VERIFY_SLOTS / loadVerify / applyRodin 与「Rodin 家具」开关；paint_verify.py 加 day2 步骤；gltf-transform 要用 nvm 的 node 24（系统 18 跑不了），椅子 3.6 万面减到 2854 面；world_test 超时一次（与烘焙同时跑），待重验
- 2026-10-30 阶段 2 过门 → 阶段 3 验证第 1 天：tools/fal_image3d.py（Rodin）、tools/paint_texture.py、world.js 四个工坊开关（画风贴图滤镜 / 图生图、画风后期、验证椅子）、tools/tests/paint_verify.py 对照墙；打分记 ART-BIBLE 第 9 节，技术卡十、十一；结论：灰盒加滤镜到不了 B，第 2 天壳上色重烘 + Rodin 换家具
- 2026-10-30 院子鸟瞰一张（0.38 元）存 concepts/yard_modern.jpg；阶段 2 交付物清单写入 ASSET-SPEC 第 9 节（合计 2.64 元），角色动作示意省掉（动作来自动作库）；等过门
- 2026-10-30 商店首批卡片两张（0.75 元）存 concepts/shop_plants.jpg、shop_animals.jpg；观察：叶子要简化、吊绿萝归墙面类型、猫鸟头再大一点；院子鸟瞰方案写入 ASSET-SPEC
- 2026-10-30 家具一组图一张（0.38 元）存 concepts/furniture_lineup.jpg，七件同比例可单独裁切送图生三维；商店首批卡片方案写入 ASSET-SPEC
- 2026-10-30 角色定 02；笔记本一族一张（0.38 元）存 concepts/notebooks_family.jpg，取六种封面色；家具一组图方案写入 ASSET-SPEC
- 2026-10-30 角色四视图：图生图参考 B 两张（0.75 元）存 concepts/character_turnaround_01/02.jpg，建议 02 为基础身体；笔记本一族出图方案写入 ASSET-SPEC
- 2026-10-30 阶段 1 过门 → 阶段 2：写 design/ASSET-SPEC.md；角色四视图出图方案等用户
- 2026-10-30 BRIEF 重写为跨包不变 / 随包变两部分，旧决定与未决列清；阶段 1 交付物齐，等用户过门
- 2026-10-30 材质板：五块手绘风样块（1.88 元）存 concepts/material_board_B.jpg 与 mat_1..5.jpg；观察：墙与封皮色相太近、黄铜过亮，画贴图时修不重出；零件表九件与验收单第 11 条写入 ART-BIBLE
- 2026-10-30 三种光：图生图参考 B 出夜读、雨天（0.75 元）存 concepts/light_night_B.jpg、light_rain_B.jpg；观察：夜读书墙要亮一档，雨天物件固有色只降饱和不改色相；材质样块方案等用户
- 2026-10-30 用户定 B（手绘贴图）→ 记入 SCOPE / ART-BIBLE / STATUS；PRODUCTION-PLAN 阶段 3 开头改为五天手绘复现验证（三条路并行、门 3.5 分、止损回 A）；从 B 按角色取六色出色卡 concepts/palette_modern_B.png；材质板五种草稿与手绘三规矩；三种光出图方案等用户
- 2026-10-30 主视觉第二轮：图生图带第一轮 02 参考，A 清爽哑光 / B 手绘贴图各一张（0.75 元）存 concepts/keyart_modern_r2_A/B.jpg；验证 40 度俯角下远墙书墙可读；建议定 A、从 B 搬角色比例与暖色
- 2026-10-30 用户给鲍勃列侬魔兽练级回忆视频，问在场模式下风格要不要重定 → 抖音登录墙挡住图片未绕；ART-BIBLE 第 0 节把风格拆成渲染风格（全项目一种）与题材（按包换），建议清爽哑光加手绘调味、第一个包仍现代书房，用第二轮主视觉 A/B 两张让用户定；第 8 节地方感七条；REFERENCES 落位
- 2026-10-30 用户定「在场为底，对焦为点」→ SCOPE 签补、PRODUCTION-PLAN 阶段 1 到 3 改、MASTER-PLAN / INTERACTION / TECH-NOTES 加注记；ART-BIBLE 写主视觉第二轮方案（带参考图 02、游戏画面取景、皮克斯式角色），等用户看提示词
- 2026-10-30 用户提出用暗黑的设计思维重梳（镜头跟角色、原地放大，不分几级机位）→ SCOPE 加「视角与操控」第三稿草案：展柜与在场对比表、书墙竖面与高俯角的冲突、推荐"在场为底，对焦为点"（跟随镜头两级放大 + 书墙 / 笔记本架 / 案头三个对焦站）、对阶段 1 到 3 的影响；待用户定
- 2026-10-30 用户问物件复用与商店、角色改皮克斯式卡通 → ART-BIBLE 第 7 节资产复用七条（比例尺、锚点、占地与放置类型、面数预算、材质板、自带阴影、数据物件不进商店）；角色定皮克斯式记入 SCOPE；"自由摆放"与 SCOPE 的槽位制冲突，标待确认，建议槽位制但按网格坐标存
- 2026-10-30 主视觉第一轮：gpt-image-2 两张（0.75 元）存 concepts/keyart_modern_01/02.jpg，对照墙打分与问题记在 ART-BIBLE 第 1 节，推荐 02；意外收获：笔记本架做成斜面展示架
- 2026-10-30 用户说「定」，阶段 0 过门 → 进阶段 1：建 `design/ART-BIBLE.md` 骨架（主视觉出图方案、风格包边界、十条验收单、禁止项、材质色板占位），主视觉提示词等用户过目
- 2026-10-30 用户改范围六处并提出风格包先做 kriss 式 → SCOPE.md 第二稿、PRODUCTION-PLAN 阶段 1 到 6 跟着改（概念图 B 与纸人归第二个包），技术结论：角色走骨骼动画、卡片共用渲染器分区绘制、新集合 items / inventory / placements、风格包定义
- 2026-10-30 用户指出缺项目领导、产出散点 → 写 `design/PRODUCTION-PLAN.md`（唯一计划：规矩、五阶段表、已有物归位、待办区）和 `design/SCOPE.md`（阶段 0 的一页纸，八个场景三选一，带建议）；STATUS 顶部挂当前阶段；旧文档的下一步全部作废
- 2026-10-30 用户选小人方向「只出纸人」→ gpt-image-2 中档一张（0.38 元）存 `design/concepts/attendant_paper.jpg`：折纸层叠身体、墨线勾边、胸前朱印、黄铜坠、木屐，站姿与走姿并排；待用户定稿
- 2026-10-30 用户给 -Duduu-《岩洞村落》落地思路（抖音图文六张）并提家具功能 / 设计高级感 / 小人特色 → 抓图分析，写 `design/FUNCTION-AND-CHARACTER.md`：Duduu 的流水线六步、每件家具的容器 / 动作 / 状态表、高级感四件事、小人三个方向（纸人 / 墨童 / 木偶）与书童的职责；小人概念图提示词等过目
- 2026-10-30 练习二开工：`studies/kriss/scene.py`（bpy 灰盒加色块：厚楼板大圆边、弧形隔断、楼梯、灯箱、桌椅灯植物与人物占位、摄影棚三盏区域光、4.1 度长焦）+ `render.sh`（Windows Blender 显卡 12 秒一张，自动与 kriss 截图并排）；三版对照图在 tools/out/kriss_study/；家具参考图提示词写在 `studies/kriss/PROMPTS.md` 等过目
- 2026-10-30 用户定路线「先临摹 kriss 和农场，积累经验和工具，再用到研习录」→ 写 `design/STUDIES.md`：练习一秋日农场（跑通 AI 出模 → 清洗 → 烘焙 → 网页 + 简单动画，五天）、练习二 kriss 的一间房（look-dev 与交互，七天）、练习三回到书房；建 `studies/` 目录 → 等用户定顺序与预算
- 2026-10-30 用户要「技术也看得见、边开发边进步」→ HOW-WE-DECIDE 加第 7 节；写 `design/TECH-NOTES.md` 九张技术卡（长焦、烘焙、三套光、实例化、贴图集、glTF 压缩、路由即镜头、三层结构、数据驱动槽位）；/world 加「工坊」面板（反引号键或 ?dev=1）：帧率 / draw call / 三角面 / 视场角 / 距离，线框、关烘焙、广角对比、显示热点、看贴图集、停呼吸六个开关；测试通过
- 2026-10-30 用户说没有三维制作经验、这些提法没法拍板 → 写 `design/HOW-WE-DECIDE.md`：分工、决定怎么摆、每步出图、对照墙打分、止损；下一步起草愿景板与验收单给用户改
- 2026-10-29 用户提五个根本问题（程序风格、叠楼还是小镇、风格、贴图还是引擎、要不要请架构师）→ 写 `design/MASTER-PLAN.md` 总体方案，五问五答加三层结构与流程 → 等用户讨论
- 2026-10-29 用户定「先用 fal 接口不用 Hyper3D」；讨论房间里的交互（浏览、取书、打开、展开、回架、动画规矩、手机、技术路径），写成 `design/INTERACTION.md` 讨论稿 → 等用户讨论
- 2026-10-29 讨论：游戏家园系统的做法（套件 + 网格 + 数据 + 实时光）、我们「可养不可建」、形态以 kriss 式固定机位为主体；拆浩克肥虫的 Blender + Hyper3D 视频（Rodin Agentic Mode 整场景生成并自动拆件、Low Poly、生成端改材质）→ 写进 KRISS-ANALYSIS 第 10 节，建议拿 B 试一次 Rodin
- 2026-10-29 用户定「先 AI 生图再按图建模」；Grok 命令行工具登录态过期、网页弹条款确认页（没替用户点），改用 ai-studio 的 gpt-image-2（fal）出四张概念图（A 按渲染改、B 自由发挥、院子、夜读，共约 1.5 元），收进 `design/concepts/` → 等用户选目标图
- 2026-10-28 用户看线上后问为什么还和 kriss 不一样 → 写诊断（KRISS-ANALYSIS 第 8 节）：不是工具、主要不是流程，是资产问题；代码能解决的一组（AgX、柔光、AO、后期、大倒角、降噪）与资产来源的四条路，等用户选
- 2026-10-28 第 3 步上线并验证（线上截图正常）；512 采样重烘（11 分钟）替换了贴图，颗粒明显减少 → 等用户看效果
- 2026-10-28 第 3 步：`study_scene.py` 共用模块 + `bake_study.py`（lightmap_pack 打包 UV、Cycles 烘 Combined、导出 glTF、写 study.json）+ `bake.sh`；发现 Windows 侧有 Blender 4.5 带 OptiX，可从 WSL 调用，六张 2048 图 128 采样共 9 分钟；gltf-transform 把几何压到 146 KB，再转成内嵌 base64 的 `.gltf.json`（Baba 类型表只认 .json，.glb 已加进 Baba 代码待部署）；`world.js` 重写：加载烘焙壳、两图淡接的无光照材质、长焦镜头（走位 fov 先宽后窄、呼吸、围绕焦点的视差、竖屏补偿）、滚轮弹簧扳机；测试通过，draw call 4 到 19，首屏资产约 1.5 MB
- 2026-10-28 用户「按建议定」视场角 → 构图改一轮（房间 5.2×4.2、桌前移、窗挪左墙中段、加桌椅 / 读书椅 / 地毯、文竹改层叠羽叶、档案盒上名色）；第 2 步色彩与材质板渲完：三机位 × 晴窗 / 夜读 / 雨天九张（96 采样，每张约 100 秒），发给用户 → 等用户定默认光
- 2026-10-28 九张静帧渲完并拼成对照图发给用户；Claude 的判断：院子 5 度、整间 8 度、案头 10 到 12 度；房间偏空、桌偏小、窗靠前、文竹占位像伞 → 等用户定
- 2026-10-28 用户选「出静帧」→ 写 `tools/blender/study_frames.py`（bpy 搭有厚度带倒角的书房剖面灰模 + 院子，晴窗光，三机位按视场角反算距离）和 `contact_sheet.py`（拼对照图）；系统包的 Blender 没有降噪器也看不到显卡，改成 CPU 64 采样不降噪，每张约 72 秒；5、8、12 度三档共九张渲染中，试渲已证明长焦 + 厚墙就是模型屋的感觉
- 2026-10-28 第二轮：还原 kriss 的 JS 排版逐段精读，解析其场景文件的 glTF 头（XOR 伪加密的 GLB，glTF-Transform 打包，89 张 KTX2 共 17.6 MB，112 个 _BAKED 材质把烘焙贴图放 emissive、底色黑、着色器无光照；相机 fov 2.3 到 4.1 度；镜头 / 热点在 Blender 里摆）→ 写进 `design/KRISS-ANALYSIS.md` 第 7 节，列出九条可直接搬的做法
- 2026-10-28 用户问为什么和 kriss.ai 差那么多 → 真浏览器 + 网络 + JS 包深拆 kriss（29 MB 单文件场景、全烘焙无实时阴影、长焦房外镜头、房色系统），写 `design/KRISS-ANALYSIS.md`：差异来源八条，我们的做法调整八条，新的五步计划；发现本机有 Blender 4.0.2 可无头烘焙 → 等用户定默认光与活物
- 2026-10-28 用户打开线上 /world 是黑屏 → 原因：页面地址没有尾斜杠，`./world.js` 被解析到 `/world.js`（404）。修法：index.html 开头一段脚本补 `<base>`（已推送）；Baba 的通配路由也加了 base 注入（12cbf4e，已推送、未部署，下次部署 Baba 时一起上）。
- 2026-10-28 用户问为什么要人部署 → 解释后选「改通配路由再部署」；Baba 通配路由已部署上线，线上 /world 验证通过；CLAUDE.md 同步
- 2026-10-28 用户选「先修外观」→ 外观第一轮：文竹叶形、夜读亮度、屋顶瓦纹、平放的书、灯罩；测试通过
- 2026-10-28 用户拍板：首屏主角文竹；建模走 CC0 加程序化起步。随后写出 `world/` 第一版（灰盒书房、四景别、三种光、程序化书 / 盒 / 牌 / 文竹），three.js 自带进 vendor，Baba 加 /world 路由，截图测试通过 → 等用户看效果。
- 2026-10-28 研究 igloo.inc、kriss.ai（实地看、读 Awwwards 案例）、Bruno Simon my-room-in-3d、flo-bit/room、Rooms.xyz、img2threejs；截图诊断 `room/` 样机；写 `design/V2-ROADMAP.md`；建 STATUS / REFERENCES；打标签 `v1` → 版本 2 立项，等拍板。
- 2026-10-28 书房样机 `room/index.html` 上线；CLAUDE.md、设计简报、测试工具进仓库。
- 2026-10-27 档案架上线卡牌与卡包；去掉侧栏，盒和夹点开是整屏桌面。
