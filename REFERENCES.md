---
type: references
project: yanxilu-world
last_scan: 2026-11-05
---

> 2026-11-02 起本页属于 yanxilu-world（版本 2 游戏项目）；版本 1 书架网页的参考留在 yanxilu/REFERENCES.md 的副本里。

# 已有方案与参考

## 结论（先看这里）

- 可直接复用：Three.js（引擎，自带进 vendor）；gltf-transform 做 Draco / KTX2 压缩；Kenney、Kay Lousberg 的 CC0 低多边形家具包做灰盒；版本 1 已有的 canvas 书脊 / 盒面 / 牌背绘制逻辑直接当三维贴图。
- 值得借鉴：kriss.ai 的"一个 URL 一间房、总览是剖面"的结构和"说明卡片贴在屏幕边上不进三维"；Bruno Simon 的"光照烘焙进贴图、场景里不放实时光"；igloo.inc 的"一种材质、UI 画在场景里、装饰承担信息"。
- 我们的差异点：参考站的房间内容是写死的，我们的每间房由个人数据生成并每天变化（几百本书、几十个盒、几百张牌、会长的植物）；参考站是看一次的展示页，我们是每天用的工具；材质宇宙是纸木墨铜而不是黏土或冰。
- 书墙画质（2026-11-05 研究）：外面没有能直接拿来按数据摆书的现成方案，GitHub 上的生成器都是 Blender 离线出图；能直接复用的是我们自己版本 1 的结论与素材——公版老书皮切条做书脊、Poly Haven CC0 橡木贴面；书的结构照 Poly Haven 写实书（书壳包书芯、飘口、竹节、皮签），一本压到约 84 面。最大的一处差不是模型，是光：书墙在北墙阴影里，站里中位明度 16，加一盏读书灯后 56。
- 是否应该放弃自研：不放弃。没有现成产品同时满足"数据驱动的房间 + 可换风格 + 自托管 + 国内可用"。但三维资产不自研：建筑和家具用 CC0 套件起步，再决定是 Blender 手工还是 AI 生成。

## 检索记录

| 日期 | 渠道 | 查询词 | 结果概述 |
|---|---|---|---|
| 2026-10-28 | 实地（Chrome） | igloo.inc 首页；kriss.ai 首页、/home/overview、三间房 | 两站都看完整，截图在会话里，不入库 |
| 2026-10-28 | WebFetch | Awwwards 两篇案例研究 | 拿到两站技术栈和制作流程 |
| 2026-10-28 | GitHub | three.js room portfolio / isometric room threejs / react-three-fiber room / my-room-in-3d / threlte / needle-engine / babylon.js / awesome threejs / gaussian splatting web viewer / 3d-portfolio topic | 房间类成品多是作品集，可用的只有 Bruno Simon 和 flo-bit 两个；引擎层 three.js 一家独大 |
| 2026-10-28 | WebSearch | kriss.ai case study；3D room scroll-driven websites；Rooms.xyz；Bruno Simon baked lighting；three.js 国内移动端 glTF Draco KTX2；AI 3D 生成 Tripo Meshy Hunyuan3D | 国内微信浏览器 WebGL 的专项资料没搜到，要自己实测 |
| 2026-10-28 | brain 查重 | three.js / webgl / spline | 只有 3DGS 商业图景对话和微缩IP的 Godot 丹房原型沾边，没有重复项目 |
| 2026-11-04 | 抖音（无头浏览器取视频 + 抽帧 + 转写） | 用户给的两条：Astra 一夜做游戏、Tripo + Opus 拼水上村落 | 两条都落进条目；画面截图只在本机暂存目录 |
| 2026-11-05 | brain 查重（书墙画质研究） | 书架 / 书脊 / bookshelf | 版本 1（yanxilu）做过三件：书皮三轮换路到公版老书皮（docs/cover-masters.md）、书架设计审视（docs/shelf-design-review.md）、拱形书柜专业流程（docs/bookcase-production.md）；结论全部可搬 |
| 2026-11-05 | GitHub | book generator blender / bookshelf blender / books geometry nodes / bookshelf three.js / bookshelf r3f / procedural bookshelf | 没有成气候的项目（星数个位到两位数）；读了三个 README，另一个 95 星的 three.js 唱片架只借动效 |
| 2026-11-05 | Poly Haven 接口 | 模型里 book / shelf，贴图里 wood | CC0：两套书（6.7 万、11 万面）、四个书架、橡木贴面；采纳 oak_veneer_01 |
| 2026-11-05 | WebSearch | stylized bookshelf game art breakdown；polycount book row；宋代书房书架卷轴牙签函套；燕云十六声 / 逆水寒 书房书架 | 游戏美术拆解没搜到，只有商店参数（一本 200 到 300 三角面、4 种书型配 16 张皮）；宋代书架形制、国产宋风游戏书房都没有可靠资料，要另查图录 |

## 条目

| 来源 | 是什么 | 可借鉴 | 不适用的原因 | 结论 |
|---|---|---|---|---|
| https://www.igloo.inc/ 与 https://awwwards.com/igloo-inc-case-study.html | Pudgy Penguins 母公司落地页，Abeto × Bureaux；Three.js + three-mesh-bvh + Svelte + GSAP + Vite，Houdini / Blender 建模 | 一种材质做到极致；滚动驱动镜头与生长时间线；UI 用 WebGL 画在场景里；低端机持续实测；开场用代码生成不用视频 | 只有三章的展示页，专业图形团队，自研工具链；我们每天用、无美术 | 借鉴 |
| https://kriss.ai/home/overview 与 https://www.awwwards.com/case-study-ai-with-a-human-touch-the-new-face-of-kriss-ai.html | 牙科 AI 助手官网，Studio 28K；OGL + Svelte 5 + Blender + PayloadCMS + Cloudflare。2026-10-28 深拆见 `design/KRISS-ANALYSIS.md`：单文件 29 MB 场景、KTX2 贴图、全烘焙 lightmap 无实时阴影、透光玻璃、长焦 3/4 俯视、2 到 2.8 秒 inOutCubic 镜头、待机呼吸、房色系统 | 房间即单元、楼即总览、一个 URL 一间房；厚度 + 圆角 + 剖切面；烘焙光；镜头在房外看进去；每房一色 UI 跟随；卡片贴边；先草图再三维 | 八间房内容写死；黏土粉彩风与我们材质宇宙不同；29 MB 首包我们不许；OGL 生态薄 | 借鉴（方法样板，不抄风格） |
| https://github.com/brunosimon/my-room-in-3d | Bruno Simon 的个人房间，Blender 建模 + 烘焙光照 + Three.js，4.5k 星，2021 | 烘焙进贴图、场景无实时光是网页上"一间房"好看又跑得动的标准做法 | 单间、静态、无数据 | 借鉴（渲染路线） |
| https://github.com/flo-bit/room | Svelte + Threlte 的小房间编辑器，存到 Bluesky 账号，MIT，89 星 | 用 Kenney / Kay Lousberg CC0 套件快速起步；摆放偏好单独存 | 用 Svelte；功能是自由摆家具，不是数据生成 | 仅参考（资产来源可抄） |
| https://rooms.xyz | 体素风房间搭建 + Lua 小游戏，a16z 投，Apple 设计奖 | "房间是舞台，物件是道具"的定义；每个物件可编程 | 用户生成内容平台，体素风，闭源 | 仅参考 |
| https://github.com/img2threejs/img2threejs | 把参考图重建为纯代码的程序化 Three.js 模型，19.6k 星，Apache-2.0 | 数据驱动的物件（书、盒、牌、叶）走程序化几何而非模型文件 | 面向单件物体重建，不是场景 | 借鉴（程序化思路） |
| https://github.com/mrdoob/three.js | WebGL 引擎，117k 星，MIT | 引擎本体；GLTFLoader / DRACOLoader / KTX2Loader / InstancedMesh | 无 | 采纳 |
| https://github.com/threlte/threlte | Svelte 的 Three.js 框架，3.4k 星 | 无 | 要引入 Svelte 全套 | 排除 |
| https://github.com/pmndrs/react-three-fiber | React 的 Three.js 渲染器，33k 星 | 无 | 要引入 React 全套；现有代码无框架 | 排除 |
| https://github.com/needle-tools/needle-engine-support | Unity / Blender 到网页的引擎，带云部署 | Blender 直出网页的流程值得看一眼 | 绑定 Needle 云与许可证，国内访问不可控 | 排除 |
| https://github.com/BabylonJS/Babylon.js | 全功能网页 3D 引擎，26k 星 | 无 | 体积大，物理 / 多人我们用不上 | 排除 |
| Spline、PlayCanvas、Godot 网页导出 | 云编辑器或重运行时 | 无 | 云依赖或 30 MB 运行时，手机开不动 | 排除 |
| https://kenney.nl/assets 与 https://kaylousberg.itch.io/ | CC0 低多边形家具与房间套件 | 灰盒阶段的建筑与家具 | 风格偏卡通，正式版要替换 | 采纳（灰盒阶段） |
| Tripo / Hunyuan3D 2.1 / TRELLIS.2 / Meshy | AI 文生图生三维，出 glb | 中式家具小件的候选来源 | 拓扑脏，要 Blender 减面展 UV | 待看（第 3 步前试一件） |
| https://threejs-journey.com/ | Bruno Simon 的 Three.js 课程，含 Blender 烘焙章节 | 烘焙流程教材 | 付费课 | 仅参考 |

| 抖音 浩克肥虫《用 Blender 和 Hyper3D 打造你的秋日农场》（aweme 7698717083856669995） | Blender + Hyper3D Rodin Gen-2 Agentic Mode 教程：几张参考图一次生成整个农场并自动拆件，Low Poly 选项，参数化和自然语言改模型，材质命名改色，下载后 Blender 打光绑定动画 | 整场景生成且拆件；材质在生成端定好减少 Blender 重复工作；AI 出资产 Blender 做光的分工 | 室外农场，室内未验证；拆件仍要减面展 UV | 借鉴（下一步拿 B 试一次） |
| https://hyper3d.ai （Rodin，影眸科技）与 https://fal.ai/models/fal-ai/hyper3d/rodin | 图生三维与场景生成；国内可用；fal 上 Gen-2 约 0.4 美元一次、2.5 fast 约 0.1 美元 | 主角家具与整间书房的资产来源候选 | Agentic Mode 大概只在网页版；按下载扣点 | 待看（试用后定） |

| 抖音 -Duduu-《岩洞村落》一些落地思路（note 7696959765440715775，AIGC × Photoshop × Tripo） | 概念到可建造的完整流水线六张图：主视觉 → 沙盘加材质板 → 主体建筑四视图与图生三维 → 构件套件 → 室内一组与墙体模块 → 全套件平铺加地图 | 材质板挂引线；室内按一组出图再拆件；构件零件表统一造型语言；人物是套件；Tripo 四边面低模 | 写实布衣与岩洞风格不是我们的 | 借鉴（方法，见 design/FUNCTION-AND-CHARACTER.md 第 1 节） |
| 抖音 鲍勃列侬《魔兽世界》练级回忆第 177 集（note 7697824398761381160，2026-10-17）"以前练级，走到哪儿都能待半天"：杜隆塔尔、荆齿城、西部荒野、银松森林、暮色森林夜色镇 | 玩家对魔兽各地图的停留感；登录墙挡住了图片，只看到标题与首帧 | 地方感：每图自己的色彩脚本、地标、能停的角落、活物、昼夜（写成 ART-BIBLE 第 8 节）；"待半天"作为验收第 11 条 | 手绘贴图风格生产成本高且 AI 难统一；暴雪美术不能用 | 借鉴（设计规矩，不借画法与素材） |
| 暗黑 2 重制版（用户本机安装 D:\Game\AH2CZB；三张截图 + 2026-10-30 用 CascLib 读封包拆解，见 design/D2R-DISSECTION.md） | 两层结构（原版表与拼块 + HD 实体-组件 JSON 表现层）；364 张数据表；每区域 × 时段一个 vis 光照文件；交互物件 = 模型 + 三态状态机 + 表里函数号；每件 1024 PBR 三件套、5 级 LOD、硬件分档 | 一切是表、vis 光照结构、角色独立布光与光圈、室内主光为零靠局部光、墙段透明、道具调色板、变体、分档 | 写实 PBR 方向、二维网格逻辑、布料物理不采纳；资产只在本机读不入库 | 采纳（结构与流程，第 7 节清单） |
| 抖音 猫猫《恶意不息农舍田园风装修》（aweme 7702484953166138687）；游戏 No Rest for the Wicked（Moon Studios） | 手绘风 + 实时局部光的 ARPG，有农舍装修、自由摆放、种菜养花、舒适度评分换增益 | 手绘风三维的画质范本；舒适度 = 基础 + 种类多样性 + 物品多样性 + 质量，换增益；走近高亮、点拾取 / 放置 / 旋转 | 商业游戏素材不用；暗黑奇幻题材与我们的书房不同 | 借鉴（画法目标与房屋系统机制） |

| https://github.com/WindyYam/Diablo2_Resurrected_Model_Converter | D2R `.model` 直转 `.glb` 与写回、`.texture` 转 DDS 的 Python 工具，MIT，自带 carbon_granny 的 BitKnit2 纯净室解码器；FORMAT_NOTES 把 GR2 容器、顶点布局、CRC、重定位全写清了 | 排练阶段一的模型转换工具；格式笔记并入 D2R-DISSECTION 第 16 节 | 只本机研究用，产物不入库；运行外部代码要用户授权 | 采纳（本机研究） |
| https://github.com/Norbyte/lslib （Divine）与 https://github.com/Norbyte/lslib/issues/67 | 博德之门 3 的资产工具链，GR2 ↔ glTF / DAE；议题 67 里有人用它转过 D2R 模型 | 看过 Reader.cs 的段解压流程 | 解 BitKnit2 要 granny2.dll，D2R 没带（静态链进 exe）；Linux 构建卡在 GpLex / Gppg | 排除 |
| https://docs.rs/crate/maclarian 与 pybg3（rans.h） | BitKnit 的纯净室实现（Rust / C） | 转换器出问题时的备用解码器 | 要自己接 GR2 容器 | 备用 |
| https://github.com/harpoonlobotomy/GR2_importer_for_blender_5 与 https://github.com/carbonenginejs/tools-blender | Blender 5 的 GR2 导入插件（后者面向 EVE，carbon_granny 的出处） | 若要在 Blender 里直接看 D2R 模型 | 面向别的游戏，D2R 专有字段未必认 | 仅参考 |
| 抖音 顧然之《Astra 进攻游戏领域了》（aweme 7682655334581931642，30 秒，5348 赞） | 一个 AI 代理（Astra）一夜 8 小时做出的雨后城区小游戏 Afterlight：俯视跟随、角色 + 机器狗、区域名、探索计数、存档；整晚在做天气、Blender 建模和细节，鸟花了一小时，约用掉一周额度的一半 | 画质靠光与氛围撑起来：体积光柱、湿地反射与积水、雾、落叶贴花、环境遮蔽、局部暖灯 + 冷底；近看道具多是方块拼的简单形体。实测明度中位 23 到 38、最暗 5% 约 7，正是我们夜景想要的"近黑底 + 局部光" | 赛博废土题材；引擎与代码不公开；只有 30 秒录屏 | 仅参考（佐证"光与地面层先于模型精度"） |
| 抖音 进化中的阿陈《一句话做不出好游戏》（aweme 7694243597025070371，6 分半） | GPT-6 Astra 出参考图与三视图 → Tripo P2.0 生成 22 个模块化组件（墙、柱、栈道、茅顶等）→ Claude Opus 5.5 写代码在 Godot 里拼出可走的水上村落；角色也用 Tripo 生成并自动绑骨、接免费动作库；Tripo 共耗 4160 积分 | 五条硬规矩：①画出来别光描述（给三视图、黑底单件）；②定尺寸（写对齐脚本自动量组件尺寸，墙 2 × 2.4 米，接缝不漏）；③说明禁项（茅顶镂空率 31.8% → 提示"厚茅草、无缝、从下看也完整"→ 0.4%）；④人形实测（放进人才发现门太矮，全村基准 2 → 2.5 米一键等比放大；地板可走墙不可穿；放一个自动巡检小机器人从船走到骨架验证不掉水；动作自带位移会滑步，改原地播放、按引擎实测速度配步伐）；⑤一套组件一张贴图（23 个材质合成 2 张图集，30 厘米木桩不该占一张 2K、4 米屋顶同尺寸就糊，本质是贴图密度）。另：整栋一体生成被 Tripo 切成 256 块不可用；45 度俯视、进屋自动藏屋顶 | Godot 桌面端，不是网页；沼泽写实题材；面数与贴图预算没给 | 借鉴（①②③④ 待并进 PIPELINE 第 1 节；⑤图集与我们"每件独立贴图"相冲，按档位另定） |
| https://github.com/ahujasid/blender-mcp | Blender 插件 + MCP 服务：在开着的 Blender 窗口里起一个 9876 端口，模型发 Python 命令过去，场景在视口里实时长出来，还能取视口截图；33k 星，MIT，2026-11 仍在更新。抖音上"AI 调出 Blender 建模"的视频多是它 | 边建边看、能截视口图自查、用户可随时手改；适合小试阶段一件件调形状 | 要开着带界面的 Blender；结果不自动落成可重跑的脚本（要另存）；2026-06 在 brain 配过一次，因 WSL 当时无界面 Blender 而删掉 | 借鉴（Windows 侧 Blender 4.5 + 镜像网络可直连；最终资产仍落 tools/blender 脚本） |

| 版本 1 `yanxilu/vendor/covers/`（53 张）与 `docs/cover-masters.md` | 维基共享资源上的公有领域 / CC0 / CC BY 2.0 装帧扫描（1840 到 1910 年代），抹掉原书名，来源逐张在 SOURCES.md；版本 1 用代码画书皮三轮不达标后换成它才过关 | 书脊底图：每张左缘切一条（带边框烫金纹），网页再叠题签、竹节、烫金线、朱印；代码只管排版与状态 | 宋代题材的营地切片里，维多利亚烫金布面不对题 | 采纳（书房占位阶段；`tools/spine_atlas.py`） |
| 版本 1 `docs/shelf-design-review.md` | 2026-11-04 对书架三件家具的设计审视 | 一种木、一种光、一种阴影柔度；板有前沿厚度、板下有影、书有接触阴影；"三样可控的乱"：每格末尾一本斜靠、读完的平放一小摞（每格至多一摞三本）、高矮参差，一格最多一处乱 | 是网页二维的版式，三维要换成几何与光 | 借鉴（前两条第一轮已做，"三样乱"排进下一轮） |
| 版本 1 `docs/bookcase-production.md` | 拱形书柜按专业流程做：蓝本、量尺、粗模、高模（型材扫掠、倒角）、分层材质、看光五区量值、分层渲染合成 | 每阶段一道门、门上必须有"我们 对 蓝本"并排图与量值 | 欧式拱柜不是我们的书墙；出的是二维透明图 | 借鉴（流程与门） |
| https://polyhaven.com/a/oak_veneer_01 | Poly Haven 橡木贴面贴图，CC0，1.83 米见方 | 书架木纹；均值 161/126/87，乘 0.94 正好落到风格圣经的书架橡木 #987755 | 无 | 采纳（1k 与半分辨率两套进 packs/modern/tex*） |
| https://polyhaven.com/a/book_encyclopedia_set_01 、https://polyhaven.com/a/decorative_book_set_01 | CC0 写实书模型（6.7 万、11 万面） | 书的结构参照：书壳包书芯、飘口、竹节、皮签、书口纸页 | 面数高出一个量级；一套书一个网格，没法按数据摆 | 仅参考 |
| https://polyhaven.com/a/wooden_display_shelves_01 | CC0 浅木格子柜 | 读得清的原因：浅木、厚板、看得见前沿、格子里有光 | 现代宜家式 | 仅参考 |
| https://github.com/AnaBriceno/procedural-bookshelf-generator | Blender 5.1 的规则式书架生成插件：宏观构图（每层角色、体积预算、图案）、书与摆件求解、木纹无缝着色、碰撞与占用校验；0 星，2026-09，未声明许可 | 每层分"角色"（满架、半架、平放、摆件）再填书，比我们的"每格七成满"有层次 | 未声明许可；Blender 离线出图，我们要运行时按数据摆 | 借鉴（构图规则） |
| https://github.com/Slaymish/BlenderBookShelf | 几何节点参数化书架，Apache-2.0，2 星，2023 | 无新东西 | 一年以上没更新 | 仅参考 |
| https://github.com/mintdotgg/bookshelf | Side One：three.js 唱片架与播放器，95 星，2026-08；抽出、转过来、看封套、放回的整套动线，避让不穿模、减少动态效果开关 | 下一步"取书 / 读 / 放回"的动线：先退出再转、落定、原路放回 | 未声明许可，只看不搬代码 | 借鉴（取书动效） |
| 韩愈《送诸葛觉往随州读书》"邺侯家多书，插架三万轴，一一悬牙签" | 唐宋藏书的样子：卷轴横插在架上，每轴垂一枚牙签写书名；宋代蝴蝶装书平放、外包书帙或装函 | 宋式书墙的方案：卷轴头朝外、牙签上写书名（天然的可读标签）；函套平放成摞 | 宋代书架、书格的形制没找到可靠图像资料，要查故宫 / 台北故宫图录 | 借鉴（宋式方案的依据，待用户定方向） |
| https://book.douban.com/review/8858294/ | 宋版书装帧（包背、蝴蝶、旋风、卷轴、经折）展览评述 | 宋代书的几种外形 | 二手评述 | 仅参考 |
| CGTrader 等商店的游戏书道具（如 vintage-bookcase-pbr-game-ready、low-poly-bookshelf-pack） | 商业游戏道具参数 | 一本书 200 到 300 三角面；4 种书型配 16 张皮、两本共一张图 | 付费、不可入库 | 仅参考（我们一本约 84 面、一张书脊图集） |

<!-- 结论四选一：采纳 / 借鉴 / 仅参考 / 排除 -->

## 待看

- 微信内置浏览器（X5 内核）的 WebGL 2 内存上限与 KTX2 支持情况：没搜到资料，第 1 步做完直接在用户手机上实测。
- `1-Projects/微缩IP全生态` 的 Godot 丹房原型：看一眼它的资产怎么做的，有没有能借的建模经验。
- igloo.inc 的 three.js 论坛帖 https://discourse.threejs.org/t/landing-site-igloo-inc/67249 。
