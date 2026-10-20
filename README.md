# 场刊

影视片单整理。一页一份片单：中英文名、时间、主创或导演、主演、评分、剧情和看点，每部配海报。

## 现在有什么

- `/nyt-100-tv/`：《纽约时报》「21 世纪 100 部最佳剧集」，按类型分七个区，附剧情与看点。
- `/nyt-100-movies/`：《纽约时报》「21 世纪 100 部最佳电影」，按类型分七个区，附剧情和看点。导演和主演的中文名来自 TMDB。电影看点译自《纽约时报》榜单页上的推荐短文。
- `/criterion-spine/`：Criterion Collection，按官方 Spine Number 排列，可用国家、类型、形式标签筛选；看点取自各片官方介绍页。
- `/sight-sound-2020/`：《视与听》影史百佳 2020 版整理，按类型分七个阅读分区，分区内按原榜名次排列。
- `/afi-100-movies/`：AFI「百年百大」2007 十周年版；默认展示正式百佳，可展开当年 400 部候选，左侧用标签筛选。
- `/japan-academy-picture/`：日本电影学院奖（日本アカデミー賞）历届最優秀作品，按届次从新到旧排列。
- `/kinema-junpo-ten/`：《电影旬报》历年十佳（艺术／娱乐、日本／外国等分榜）；左侧按年代折叠筛选年度，并可用榜单类型标签过滤。
- `/cannes-palme-dor/`：戛纳国际电影节主竞赛金棕榈奖，历届获奖与提名；左侧按 festival 年份筛选，可用「获奖／提名」标签过滤。
- `/berlin-golden-bear/`：柏林国际电影节主竞赛金熊奖，历届获奖与提名；同上。
- `/venice-golden-lion/`：威尼斯国际电影节主竞赛金狮奖，历届获奖与提名；同上。

页内搜索认中文名、英文名、别名、主创、主演和名次。回车或点选结果会跳到那一部。剧集的剧情和看点是我们自己写的，电影看点译自《纽约时报》原文，只有审过的才上页面。右上角可以在中文和英文之间切换：英文只显示英文；中文模式下标题、主创和主演保留英文，其余为中文。

## 片单来源

每份片单在 `lists` 表里有 `source_name` / `source_url`，页面页脚会链回去。主要来源如下：

| 片单 | 路由 | 主要来源 |
| --- | --- | --- |
| 21 世纪百佳剧集 | `/nyt-100-tv/` | [NYT · The 100 Best TV Shows of the 21st Century](https://www.nytimes.com/bestTV) |
| 21 世纪百佳电影 | `/nyt-100-movies/` | [NYT · The 100 Best Movies of the 21st Century](https://www.nytimes.com/interactive/2025/movies/best-movies-21st-century.html) |
| Criterion Collection | `/criterion-spine/` | [Criterion · Shop All Films（按 spine number）](https://www.criterion.com/shop/browse/list?sort=spine_number)；各片看点来自对应 `criterion.com/films/…` 介绍页 |
| 视与听影视百佳 2020版 | `/sight-sound-2020/` | [IMDb list ls098836998](https://www.imdb.com/list/ls098836998/)（Sight & Sound’s 100 Greatest Movies of All Time, 2020 version） |
| AFI 百大电影 | `/afi-100-movies/` | [AFI · 100 Years…100 Movies — 10th Anniversary Edition](https://www.afi.com/afis-100-years-100-movies-10th-anniversary-edition/)；候选名单见 [400-film ballot PDF](https://prdaficalmjediwestussa.blob.core.windows.net/images/2019/08/Movies_ballot_06.pdf) |
| 日本电影学院奖最佳影片 | `/japan-academy-picture/` | [豆瓣豆列 · 历届日本电影学院奖最佳影片](https://www.douban.com/doulist/991214/) |
| 《电影旬报》历年十佳 | `/kinema-junpo-ten/` | [豆瓣豆列 · 《电影旬报》历年十佳](https://www.douban.com/doulist/145457359/) |
| 戛纳金棕榈奖 | `/cannes-palme-dor/` | [豆瓣电影 · 戛纳电影节获奖/提名](https://movie.douban.com/awards/cannes/) |
| 柏林金熊奖 | `/berlin-golden-bear/` | [豆瓣电影 · 柏林电影节获奖/提名](https://movie.douban.com/awards/berlinale/) |
| 威尼斯金狮奖 | `/venice-golden-lion/` | [豆瓣电影 · 威尼斯电影节获奖/提名](https://movie.douban.com/awards/venice/) |

## 本地运行

需要 Node 22.13 以上（用到内置的 `node:sqlite`）。

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # 输出到 dist/，纯静态，可直接部署（构建前会自动 npm run verify）
npm run verify   # 检查每份片单的 DB 名次、分区、旬报年度计数等
npm run verify:dist  # 再对照 dist/ 里每页的 #show-N 与人物页徽章链接
```

## 数据

所有元数据在 SQLite 文件 `db/playbill.db` 里，表结构见 `db/schema.sql`。构建时 Astro 从这个库读数据（`src/loaders/sqlite.ts`），网站本身不连数据库。

- `works`、`work_aliases`：作品。`kind` 为 `tv` 或 `movie`。主键 `works.id` 优先用 TMDB（`tmdb-m-{id}` / `tmdb-tv-{id}`），没有 TMDB 再用豆瓣（`douban-{id}`）；都没有时 seed 先写 `local-…`，等 `npm run tmdb` / `douban` 再升级。中文片名不进主键。
- `people`、`credits`：人名（中英文、照片、简介、TMDB 和豆瓣 ID），按 `creator` / `director` / `writer` / `cast` 关联作品。每人有独立页 `/people/{id}/`。
- 作品独立页：`/movies/{works.id}/`、`/tvs/{works.id}/`（内部 id，与库主键一致）。
- `editorial`：作品上的剧情和「场刊」短注。页面上**有文案就展示**；`reviewed` 仅用于脚本避免覆盖人工撰写。
- `list_highlights`：榜单原生「看点」（例如《纽约时报》为该榜写的推荐短文），挂在「片单 × 作品」上。
- `ratings`：每次抓取存一行，保留历史，页面取最新一行。`douban_subjects` 存豆瓣的条目，剧集每季一条。
- `lists`、`list_sections`、`list_entries`：片单、分区和名次。

`db/export/*.jsonl` 是每张表的文本导出，排序固定，用来看 diff 和备份。改完数据库后运行 `npm run db -- export`；数据库文件冲突时可以用 `npm run db -- import` 从导出重建。

抓到的原始响应缓存在 `db/cache.db`（不进仓库），重跑不会重复请求。

## 加一份片单

1. 在 `db/seed/` 放 `<name>.json`（标题、来源、类型）和 TSV（名次、英文片名、年份），参考 `nyt-100-movies`。
2. `npm run seed -- <name>`：建片单和缺少的作品。TSV 列是 `rank`、`title`、`year`，可选 `tmdb_id`、`douban_id`、`imdb_id`、`id`（有外部 ID 时直接写成规范主键；有 `imdb_id` 时优先按 IMDb 复用已有作品，`npm run tmdb` 也会用 `/find` 精确匹配）。Criterion 片单用 `spine_number` 代替 `rank`（编号即名次）。
3. `npm run tmdb`：匹配 TMDB，把作品 id 收成 `tmdb-m-` / `tmdb-tv-`，补中文名、原名、国家、片长、导演和主演、IMDb ID，下载海报到 `public/posters/`。豆列片单建议先跑 `douban` 再跑 `tmdb`（均支持 `--list kinema-junpo-ten` 等）。
4. `npm run people`：给人补 TMDB id（按英文名搜索）、简介和头像到 `public/people/`。人物页按角色列出场刊内作品，并列出同片合作过的人。
5. `npm run imdb`：读 IMDb 每日公开评分文件。
6. `npm run douban`：找豆瓣条目，记评分；没有 TMDB 的作品会收成 `douban-{id}`；电影还会补中文人名。从豆瓣豆列 seed 的 `douban-{id}` 会直接打开条目页 API，写入中文名、**剧情 intro**、外文名（含 aka 里的英文），供 TMDB 检索。
7. `npm run db -- export`，然后构建。

### Criterion Collection

`criterion-spine` 按官方 Spine Number 排列。更新目录：

```bash
npm run criterion                  # 尝试直接抓取浏览页并重写 TSV
npm run criterion -- page.html     # Cloudflare 拦了就用浏览器另存的 HTML/Markdown
npm run criterion -- --seed        # 抓完后立刻 seed
npm run seed -- criterion-spine    # 只根据现有 TSV 重建片单条目
```

TSV 列是 `spine_number`、`title`、`year`、`director`；没有年份的盒装会跳过。`list_entries.rank` 存的就是 spine number。

三大电影节最高奖（金棕榈／金熊／金狮，含主竞赛提名）可从豆瓣获奖页生成 seed：

```bash
npm run festival-seed -- cannes-palme-dor   # 或 berlin-golden-bear、venice-golden-lion
npm run festival-seed -- --all              # 三个一起抓（需 .env 里 DOUBAN_COOKIE）
npm run seed -- cannes-palme-dor
npm run douban -- --list cannes-palme-dor
npm run tmdb -- --list cannes-palme-dor
npm run festival-enrich                       # 三个片单依次 TMDB + Douban（较慢间隔）
npm run fill-plots -- --list cannes-palme-dor # 补剧情：TMDB 中文简介 → 英译中 → Wikipedia；并补导演/主演
npm run fill-plots -- --engine ollama --model qwen2.5:3b   # 本地 Ollama 翻译（可选）
./scripts/festival-pipeline.sh                # 上述 + 写 seed + 两次 build/deploy（日志默认 /tmp/festival-pipeline.log）
```

`festival-seed` 会先抓豆瓣获奖页（含提名），再用豆列补全缺届的**获奖**条目（戛纳/柏林/威尼斯 winner 豆列）；提名仍以获奖页为准。

TMDB 需要在 `.env` 里放 `TMDB_API_READ_ACCESS_TOKEN`（`.env` 不进仓库）。匹配错的作品可以直接改库里的 `tmdb_id` / `imdb_id` 再重跑，或在脚本的 `HINTS` 里加搜索提示。

## 豆瓣

豆瓣按季分开打分。多季剧集显示各季平均分，评分人数不到 1000 的季不计入。

豆瓣没有公开 API。脚本用的是网站的联想搜索和移动版条目接口。移动版条目接口（`subject_ip_rate_limit`）同一 IP 大约每几分钟只能打二十来次；不登录更严。`.env` 里可放浏览器登录后的 `DOUBAN_COOKIE`（完整 Cookie 字符串，不是占位符），必要时把 `DOUBAN_GAP_MS` 调到 `15000` 以上。`npm run douban -- --list …` 对豆列 seed 的 `douban-{id}` 只拉条目详情（剧情、外文名），不再额外请求演职员接口，减少一半流量。遇到限流会跳过当前条目并继续，已缓存的响应在 `db/cache.db`，重跑会从断点接着写库。

跑长任务时建议把 **stderr 也打进日志**，否则终端里往往只剩限流行、看不到成功行（成功摘要写在 stderr）：

```bash
npm run douban -- --list kinema-junpo-ten 2>&1 | tee -a /tmp/douban-kinema.log
```

日志含义：`douban cache …` = 命中本地缓存；`douban fetch OK …` = 真正打到豆瓣且成功；`douban RATE …` = IP 限流等待；`douban OK   work-id …` = 该作品已写入评分/剧情；结尾有 `douban done: works ok=… api cache=… network=…` 汇总。

## 来源

本站使用 TMDB API，但未获得 TMDB 的认可或认证。IMDb 评分来自 IMDb 公开数据集（非商业使用）。
