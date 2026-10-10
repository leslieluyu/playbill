# 场刊

影视片单整理。一页一份片单：中英文名、时间、主创或导演、主演、评分、剧情和看点，每部配海报。

## 现在有什么

- `/nyt-100-tv/`：《纽约时报》「21 世纪 100 部最佳剧集」，按类型分七个区，附剧情与看点。
- `/nyt-100-movies/`：《纽约时报》「21 世纪 100 部最佳电影」，按类型分七个区，附剧情和看点。导演和主演的中文名来自 TMDB。电影看点译自《纽约时报》榜单页上的推荐短文。

页内搜索认中文名、英文名、别名、主创、主演和名次。回车或点选结果会跳到那一部。剧集的剧情和看点是我们自己写的，电影看点译自《纽约时报》原文，只有审过的才上页面。右上角可以在中文和英文之间切换：英文只显示英文；中文模式下标题、主创和主演保留英文，其余为中文。

## 本地运行

需要 Node 22.13 以上（用到内置的 `node:sqlite`）。

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # 输出到 dist/，纯静态，可直接部署
```

## 数据

所有元数据在 SQLite 文件 `db/playbill.db` 里，表结构见 `db/schema.sql`。构建时 Astro 从这个库读数据（`src/loaders/sqlite.ts`），网站本身不连数据库。

- `works`、`work_aliases`：作品。`kind` 为 `tv` 或 `movie`。
- `people`、`credits`：人名（中英文、TMDB 和豆瓣 ID），按 `creator` / `director` / `cast` 关联作品。
- `editorial`：我们写的剧情和看点。`reviewed = 1` 才会发布。
- `ratings`：每次抓取存一行，保留历史，页面取最新一行。`douban_subjects` 存豆瓣的条目，剧集每季一条。
- `lists`、`list_sections`、`list_entries`：片单、分区和名次。

`db/export/*.jsonl` 是每张表的文本导出，排序固定，用来看 diff 和备份。改完数据库后运行 `npm run db -- export`；数据库文件冲突时可以用 `npm run db -- import` 从导出重建。

抓到的原始响应缓存在 `db/cache.db`（不进仓库），重跑不会重复请求。

## 加一份片单

1. 在 `db/seed/` 放 `<name>.json`（标题、来源、类型）和 TSV（名次、英文片名、年份），参考 `nyt-100-movies`。
2. `npm run seed -- <name>`：建片单和缺少的作品。
3. `npm run tmdb`：匹配 TMDB，补中文名、原名、国家、片长、导演和主演、IMDb ID，下载海报到 `public/posters/`。
4. `npm run imdb`：读 IMDb 每日公开评分文件。
5. `npm run douban`：找豆瓣条目，记评分；电影还会补中文人名。
6. `npm run db -- export`，然后构建。

TMDB 需要在 `.env` 里放 `TMDB_API_READ_ACCESS_TOKEN`（`.env` 不进仓库）。匹配错的作品可以直接改库里的 `tmdb_id` / `imdb_id` 再重跑，或在脚本的 `HINTS` 里加搜索提示。

## 豆瓣

豆瓣按季分开打分。多季剧集显示各季平均分，评分人数不到 1000 的季不计入。

豆瓣没有公开 API。脚本用的是网站的联想搜索和移动版条目接口，不登录时同一网络大约几十次请求就会被限流，限流后脚本会停下，下次从断点继续。

## 来源

本站使用 TMDB API，但未获得 TMDB 的认可或认证。IMDb 评分来自 IMDb 公开数据集（非商业使用）。
