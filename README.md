# 研习录·小世界

研习录的版本 2：一个可以养的三维小世界。书房里有书墙、档案架、案头；院子里有菜畦、长椅、信箱；以后是一座小镇。读的、剪的、写的在里面长成东西，植物和动物从商店买回来放进槽位，朋友可以走进你的院子留言。视觉语法照暗黑 2（近黑的底加局部光、固定俯角、进屋去屋顶、每件各自的高密度贴图），第一个题材包是宋代田园。

书架网页（版本 1）在 [cnyanghai/yanxilu](https://github.com/cnyanghai/yanxilu)，两边共用同一份数据。2026-11-02 从那里拆出。

## 怎么看

- 线上：https://baba.wogucloud.cn/world （按反引号键开工坊面板）
- 本地：`python3 tools/baba_mock.py 8790`，开 http://127.0.0.1:8790/world

## 怎么做

- 计划：`design/PRODUCTION-PLAN.md`；进度：`STATUS.md`
- 生产流程：`design/studio/PIPELINE.md`；它是怎么来的：`design/studio/REHEARSAL.md`
- 表与 Schema：`world/data/`，`python3 tools/tables_check.py`
- 资产入库：`python3 tools/asset_import.py <glb|图片> --id <物件> --kind furniture`
- 风格与规格：`design/ART-BIBLE.md`、`design/ASSET-SPEC.md`

## 不做什么

不引框架不打包不走 CDN；不把任何别家游戏的资产放进仓库；不做实时全局光，建筑与大件用烘焙贴图，三种光是三套贴图淡接。
