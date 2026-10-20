# great-directors（TSPDT 250 · 第一期）

## 路由

- **导演头像瓦块**：`/great-directors/`
- **影片瓦块**：`/great-directors/films/`
- 旧链 `/great-directors/directors/` → 跳转到 `/great-directors/`
- 导演介绍 + 片单：`/great-directors/{slug}/`（如 `d001-alfred-hitchcock`）
- 数据 list id：`great-directors`（不用通用 `[list].astro` 长列表 UI）

## 数据流水线

```bash
npm run great-directors-seed   # docs/最佳导演榜单_v3_片单.xlsx → db/seed/
npm run seed -- great-directors
npm run db -- export
npm run build
```

- **第一期范围**：Excel 中「经典 **或** 奖项 **或** 热议」，且 **排除短片**（约 2258 条 / 249 位导演有片）。
- 作品主键：优先合并库内已有条目；新作暂用 `wd-Q…`（Wikidata）。
- 导演元数据：`db/seed/great-directors-directors.json`（TSPDT 名次、国籍、评点、大师/流派标签）。
- 评点来源：从 v3 **docx** 第三章 TSPDT 表解析（按 Excel 名次锚点，**250/250**）。**Excel 片单 sheet 没有导演评点列**，只有片级字段。

## 筛选标签

定义见 `scripts/lib/great-directors-tags.mjs` / `src/lib/great-directors.ts`：

- **大师**：《视与听》2002 并集（影评人 11 + 导演 11，可重叠，约 15 人）；子标签 `ss2002-critic` / `ss2002-director` 各 11 人
- **国籍**：docx 第三章按「名次 + 中文名」锚点解析；左侧为国家全名（非单字）
- **流派**：单选；按钮旁数字为榜单内已标注人数，`0` 为尚未挂标签（非缺导演）
- **流派**：德国表现主义、苏联蒙太奇、新浪潮等（评点关键词启发式 + 可手工改 JSON）
- **奖项**：从每行「奖项」列解析（奥斯卡、戛纳、柏林、威尼斯、金球、BAFTA、凯撒）

## 合导（待定）

Excel 仍为一导演一行；数据库可有多行指向同一 Wikidata 作品。UI 暂未单独标注，详情见 `list_entries.note`。

## 与 `people` 的关系

- 种子脚本已按 **英文名 `en`** 关联 `people` 与 credits；**同一人在库中只有一条 `people` 记录**。
- **`/great-directors/{slug}/`**：TSPDT 策展视图（名次、评点、第一期片单、标签）。
- **`/people/{id}/`**：全站人物页（跨榜单参演/执导等）。
- **不建议把 250 导演合并进 people 列表 UI**；应在数据层共用 `people`，导演页展示标签 + TSPDT 评点，若 TMDB/`people.bio_zh` 更长则追加「人物资料」段落并链到 people 页。

## 后续

- Wikidata → IMDb/TMDB 批量解析 + `npm run tmdb -- --list great-directors`
- 补全 250 人评点、手工校正流派/国籍标签
- 大陆译名：seed 用 Excel 中文列，再 Douban/TMDB 覆盖
- 第二期：纳入其余长片 / 可选短片开关
