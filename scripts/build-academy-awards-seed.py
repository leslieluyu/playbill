#!/usr/bin/env python3
"""Build seed files for national/academy Best Film awards + TSPDT 1000.

Lists:
  golden-horse-best-film  — Taipei Golden Horse Best Narrative Feature (winners)
  hkfa-best-film          — Hong Kong Film Awards Best Film (winners)
  bafta-best-film         — BAFTA Best Film (winners; section = ceremony year)
  cesar-best-film         — César Award for Best Film (winners)
  tspdt-1000              — They Shoot Pictures Don't They? 1000 Greatest Films (2025)

Sources: English Wikipedia award pages; TSPDT sortable table
(https://theyshootpictures.com/gf1000_all1000films_table.php).

Ceremony-year convention matches oscar / critics-choice-film: list_entries.section
is y{ceremony}; TSV year is the film's release / eligibility year when known.
BAFTA Wikipedia years are film years → ceremony = year + 1.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "db/seed"
CACHE = ROOT / "db/cache"
CACHE.mkdir(parents=True, exist_ok=True)

UA = "PlaybillSeedBot/1.0 (+local; award winners + TSPDT 1000)"

DECADE_COLORS = {
    2020: "#5b45a0",
    2010: "#1f6f7a",
    2000: "#2f6b45",
    1990: "#4a5568",
    1980: "#9a7a12",
    1970: "#a8456e",
    1960: "#b33a2a",
    1950: "#a65f18",
    1940: "#5b45a0",
    1930: "#1f6f7a",
    1920: "#2f6b45",
    1910: "#4a5568",
    1900: "#5f5a52",
    1890: "#5f5a52",
}

RANK_BAND_COLORS = [
    "#5b45a0",
    "#1f6f7a",
    "#2f6b45",
    "#a65f18",
    "#b33a2a",
    "#a8456e",
    "#9a7a12",
    "#4a5568",
    "#5b45a0",
    "#1f6f7a",
]


def fetch(url: str, cache_name: str) -> str:
    path = CACHE / cache_name
    if path.exists() and path.stat().st_size > 1000:
        return path.read_text(encoding="utf-8", errors="replace")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read().decode("utf-8", errors="replace")
    path.write_text(data, encoding="utf-8")
    return data


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = (
        s.replace("\xa0", " ")
        .replace("&amp;", "&")
        .replace("&nbsp;", " ")
        .replace("&#39;", "'")
        .replace("&quot;", '"')
    )
    return re.sub(r"\s+", " ", s).strip()


def decade_color(year: int) -> str:
    return DECADE_COLORS.get((year // 10) * 10, "#5f5a52")


def sections_for_years(years: list[int]) -> list[dict]:
    out = []
    for y in sorted(set(years), reverse=True):
        out.append(
            {
                "id": f"y{y}",
                "order": -y,
                "name": f"{y}年",
                "blurb": "",
                "color": decade_color(y),
            }
        )
    return out


def normalize_title(title: str) -> str:
    """TSPDT / Wikipedia title cleanup for TMDB search."""
    t = (
        title.strip()
        .replace("&amp;", "&")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
    t = re.sub(r"\s*\[\d{4}\]\s*$", "", t).strip()
    # "Rules of the Game, The" → "The Rules of the Game"
    m = re.match(
        r"^(.+),\s*(The|A|An|Le|La|Les|L'|Il|Lo|Gli|Un|Une|Der|Die|Das|El|Los|Las|O|Os|As)\s*$",
        t,
        re.I,
    )
    if m:
        art = m.group(2)
        rest = m.group(1).strip()
        if art.endswith("'"):
            t = f"{art}{rest}"
        else:
            t = f"{art} {rest}"
    # common TSPDT forms
    fixes = {
        "Atalante, L'": "L'Atalante",
        "Avventura, L'": "L'Avventura",
        "Eclisse, L'": "L'Eclisse",
        "Dolce vita, La": "La Dolce Vita",
        "Jetée, La": "La Jetée",
        "Ronde, La": "La Ronde",
        "Strada, La": "La Strada",
        "Notte, La": "La Notte",
        "Chienne, La": "La Chienne",
        "Maman et la putain, La": "The Mother and the Whore",
        "Mother and the Whore, The": "The Mother and the Whore",
        "Passion of Joan of Arc, The": "The Passion of Joan of Arc",
        "Man with a Movie Camera": "Man with a Movie Camera",
        "Some Like it Hot": "Some Like It Hot",
        "Mulholland Dr.": "Mulholland Drive",
        "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb": "Dr. Strangelove",
    }
    return fixes.get(t, t)


def write_award_list(
    list_id: str,
    *,
    title: str,
    kicker: str,
    dek: str,
    source_name: str,
    source_url: str,
    order: int,
    rows: list[tuple[int, int, str, int | None]],
    note_fn,
) -> None:
    """rows: (ceremony_year, film_year, title, tmdb_id|None) newest first."""
    years = [c for c, *_ in rows]
    meta = {
        "id": list_id,
        "title": title,
        "kicker": kicker,
        "dek": dek,
        "source": {"name": source_name, "url": source_url},
        "kind": "movie",
        "order": order,
        "entries": f"{list_id}.tsv",
        "sections": sections_for_years(years),
    }
    tsv_rows: list[list[str]] = []
    for i, (ceremony, film_year, film_title, tid) in enumerate(rows, start=1):
        tsv_rows.append(
            [
                str(i),
                film_title,
                str(film_year),
                f"y{ceremony}",
                note_fn(ceremony, i, film_title),
                str(tid) if tid else "",
            ]
        )
    out_json = SEED / f"{list_id}.json"
    out_tsv = SEED / f"{list_id}.tsv"
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    header = "rank\ttitle\tyear\tsection\tnote\ttmdb_id\n"
    out_tsv.write_text(header + "\n".join("\t".join(r) for r in tsv_rows) + "\n", encoding="utf-8")
    print(f"{list_id}: {len(tsv_rows)} entries, {len(meta['sections'])} years → {out_json.name}")


# ---------------------------------------------------------------------------
# Wikipedia winners: gold-background film cell (or first row of year group)
# ---------------------------------------------------------------------------


def parse_year_edition(html_or_text: str) -> tuple[int | None, int | None]:
    """Parse ceremony/film year + Nth edition from a Wikipedia year cell.

    Prefer the visible <b>YYYY</b> (avoids citation dates inside data-mw attrs,
    which break naive tag-stripping when attributes contain '>').
    """
    m = re.search(r"<b[^>]*>\s*((?:19|20)\d{2})\s*</b>", html_or_text, re.I)
    if m:
        year = int(m.group(1))
    else:
        # Strip data-mw blobs then tags, then take first year next to (Nth)
        cleaned = re.sub(r"\sdata-mw=(['\"]).*?\1", "", html_or_text, flags=re.S)
        text = strip_tags(cleaned)
        m2 = re.search(r"((?:19|20)\d{2})\s*\((\d+)(?:st|nd|rd|th)\)", text)
        if m2:
            return int(m2.group(1)), int(m2.group(2))
        m3 = re.search(r"(19|20)\d{2}", text)
        if not m3:
            return None, None
        year = int(m3.group(0))
    em = re.search(r"\((\d+)(?:st|nd|rd|th)\)", strip_tags(re.sub(r"\sdata-mw=(['\"]).*?\1", "", html_or_text, flags=re.S)))
    edition = int(em.group(1)) if em else None
    return year, edition


def parse_wikitable_winners(html: str, *, film_cell_offset: int = 0) -> list[dict]:
    """Return list of {year, edition, title} for winners only (gold / bold first)."""
    tables = re.findall(r"<table[^>]*>(.*?)</table>", html, re.S | re.I)
    out: list[dict] = []
    for table in tables:
        # skip nav/infobox-ish
        if table.count("<tr") < 3:
            continue
        plain = strip_tags(table[:800]).lower()
        if "english title" not in plain and "film" not in plain and "year" not in plain:
            continue
        current_year: int | None = None
        current_edition: int | None = None
        rows_left = 0
        for tr_m in re.finditer(r"<tr([^>]*)>(.*?)</tr>", table, re.S | re.I):
            tr_attrs, tr_body = tr_m.group(1), tr_m.group(2)
            cells = re.findall(r"<(t[hd])([^>]*)>(.*?)</\1>", tr_body, re.S | re.I)
            if not cells:
                continue
            texts = [strip_tags(c[2]) for c in cells]
            joined = " ".join(texts).lower()
            if joined.startswith("year") or "english title" in joined and "director" in joined:
                continue
            if "best film from any source" in joined and len(texts) <= 2:
                continue

            film_idx = 0
            year_here: int | None = None
            edition_here: int | None = None

            # Year often in first th/td with rowspan
            tag0, attrs0, content0 = cells[0]
            y0, e0 = parse_year_edition(content0)
            rowspan = re.search(r'rowspan="(\d+)"', attrs0, re.I)
            looks_like_year = y0 is not None and (
                tag0.lower() == "th"
                or bool(re.search(r"\((?:\d+)(?:st|nd|rd|th)\)", strip_tags(content0)))
                or (rowspan and len(strip_tags(content0)) < 40)
            )
            if looks_like_year and rows_left <= 0:
                year_here, edition_here = y0, e0
                current_year, current_edition = y0, e0
                rows_left = int(rowspan.group(1)) if rowspan else 1
                film_idx = 1
            elif rows_left > 0:
                film_idx = 0
            else:
                # BAFTA: year cell is a centered div; film may be cell 1 with gold bg
                if y0 is not None and len(strip_tags(content0)) < 50:
                    year_here, edition_here = y0, e0
                    current_year, current_edition = y0, e0
                    rows_left = int(rowspan.group(1)) if rowspan else 1
                    film_idx = 1

            if current_year is None:
                continue

            film_idx = film_idx + film_cell_offset
            if film_idx >= len(cells):
                if rows_left > 0:
                    rows_left -= 1
                    if rows_left == 0:
                        current_year = None
                continue

            film_tag, film_attrs, film_html = cells[film_idx]
            title = strip_tags(film_html)
            title = re.sub(r"\s*†\s*$", "", title).strip()
            title = re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()  # drop (original) once? careful
            # Prefer title inside <i><b> or <i>
            im = re.search(r"<i[^>]*>\s*(?:<b[^>]*>)?\s*(?:<a[^>]*>)?([^<]+)", film_html, re.I)
            if im:
                title = strip_tags(im.group(1))

            if not title or len(title) < 2:
                if rows_left > 0:
                    rows_left -= 1
                continue
            # skip junk aggregated nominee lists
            if len(title) > 120 or title.count(" ") > 18 and "," not in title[:40]:
                # still might be a long real title; only skip if no italic
                if not im and len(title) > 80:
                    if rows_left > 0:
                        rows_left -= 1
                    continue

            is_gold = bool(
                re.search(r"background\s*:\s*#FAEB86", film_attrs + tr_attrs, re.I)
                or re.search(r"background\s*:\s*#FAEB86", film_html[:80], re.I)
            )
            is_bold = bool(re.search(r"<b[\s>]", film_html, re.I))
            is_first = rows_left > 0 and (
                (rowspan is not None and film_idx >= 1) or year_here is not None
            )
            # When we just set rows_left from year cell, this is the first film row
            first_of_block = year_here is not None

            take = is_gold or (first_of_block and (is_bold or is_gold or True))
            # For nominee-only follow-up rows (rows_left already decremented path): skip
            if not first_of_block and rows_left > 0 and not is_gold:
                take = False

            if take:
                # Clean parenthetical original title if English title is primary
                title = re.sub(r"\s*\([^)]{0,40}\)\s*$", "", title).strip()
                title = title.replace("†", "").strip()
                if title and not title.lower().startswith("best film"):
                    out.append(
                        {
                            "year": current_year,
                            "edition": current_edition or edition_here,
                            "title": title,
                        }
                    )

            if rows_left > 0:
                rows_left -= 1
                if rows_left == 0:
                    current_year = None

    # Dedupe consecutive identical; allow same year for ties
    cleaned: list[dict] = []
    seen: set[tuple[int, str]] = set()
    for w in out:
        key = (w["year"], w["title"].lower())
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(w)
    return cleaned


def winners_newest_first(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda w: (-w["year"], w["title"]))


def build_golden_horse() -> None:
    html = fetch(
        "https://en.wikipedia.org/api/rest_v1/page/html/Golden_Horse_Award_for_Best_Narrative_Feature",
        "wiki-golden-horse-best-narrative.html",
    )
    raw = parse_wikitable_winners(html)
    # Prefer gold/first-per-year; filter years with missing year (parser glitch)
    by_year: dict[int, dict] = {}
    for w in raw:
        y = w["year"]
        if y is None:
            continue
        if y not in by_year:
            by_year[y] = w
    items = winners_newest_first(list(by_year.values()))
    # Edition fallback from chronology
    if items and not items[0].get("edition"):
        # map year→edition from known: 1962=1 … gaps 1964,1974
        pass

    def note(ceremony: int, _rank: int, _title: str) -> str:
        # Find edition
        ed = next((w["edition"] for w in items if w["year"] == ceremony), None)
        if ed:
            return f"第{ed}届"
        return f"{ceremony}"

    rows = []
    for w in items:
        ceremony = w["year"]
        # Film year ≈ ceremony year for Golden Horse (often same-year / prior)
        film_year = ceremony
        rows.append((ceremony, film_year, w["title"], None))

    write_award_list(
        "golden-horse-best-film",
        title="金马奖最佳剧情片",
        kicker="台北金马影展 · 最佳剧情片",
        dek=(
            "金马奖最佳剧情片历届获奖名单，按典礼年份从新到旧排列。"
            "左侧可按年代、年份筛选。缺届年份（1964、1974）未举行，不予收录。"
        ),
        source_name="Wikipedia · Golden Horse Award for Best Narrative Feature",
        source_url="https://en.wikipedia.org/wiki/Golden_Horse_Award_for_Best_Narrative_Feature",
        order=16,
        rows=rows,
        note_fn=note,
    )


def build_hkfa() -> None:
    html = fetch(
        "https://en.wikipedia.org/api/rest_v1/page/html/Hong_Kong_Film_Award_for_Best_Film",
        "wiki-hkfa-best-film.html",
    )
    raw = parse_wikitable_winners(html)
    by_year: dict[int, dict] = {}
    for w in raw:
        if w["year"] is None:
            continue
        if w["year"] not in by_year:
            by_year[w["year"]] = w
    # Fix 1982 if missing year from parser
    if 1982 not in by_year and any(w["title"] == "Father and Son" for w in raw):
        by_year[1982] = {"year": 1982, "edition": 1, "title": "Father and Son"}
    items = winners_newest_first(list(by_year.values()))

    def note(ceremony: int, _r: int, _t: str) -> str:
        ed = next((w.get("edition") for w in items if w["year"] == ceremony), None)
        if not ed:
            ed = ceremony - 1981  # 1982 = 1st
        return f"第{ed}届"

    rows = [(w["year"], w["year"], w["title"], None) for w in items]
    write_award_list(
        "hkfa-best-film",
        title="香港金像奖最佳电影",
        kicker="Hong Kong Film Awards · Best Film",
        dek=(
            "香港电影金像奖最佳电影历届获奖名单，按典礼年份从新到旧排列。"
            "左侧可按年代、年份筛选。自 1982 年首届起收录至最近一届。"
        ),
        source_name="Wikipedia · Hong Kong Film Award for Best Film",
        source_url="https://en.wikipedia.org/wiki/Hong_Kong_Film_Award_for_Best_Film",
        order=17,
        rows=rows,
        note_fn=note,
    )


def build_bafta() -> None:
    html = fetch(
        "https://en.wikipedia.org/api/rest_v1/page/html/BAFTA_Award_for_Best_Film",
        "wiki-bafta-best-film.html",
    )
    # BAFTA: gold background on the winning film <td>.
    # Wikipedia year column = film eligibility/release year; ceremony = year + 1.
    # Walk every gold film cell and read year from the nearest preceding year cell
    # (handles rowspan year headers cleanly).
    raw: list[dict] = []
    # Flatten all wikitable rows with absolute index
    tables = re.findall(r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html, re.S | re.I)
    if not tables:
        tables = re.findall(r"<table[^>]*>(.*?)</table>", html, re.S | re.I)

    for table in tables:
        if "Best Film" not in strip_tags(table[:1500]) and "Film" not in strip_tags(
            table[:500]
        ):
            # still allow decade tables that start mid-history
            if not re.search(r"(19|20)\d{2}", table[:2000]):
                continue
        # Build list of (tr_html, cells)
        row_cells: list[list[tuple[str, str, str]]] = []
        for tr_m in re.finditer(r"<tr([^>]*)>(.*?)</tr>", table, re.S | re.I):
            cells = re.findall(r"<(t[hd])([^>]*)>(.*?)</\1>", tr_m.group(2), re.S | re.I)
            if cells:
                row_cells.append(cells)

        # Carry year forward across rowspan
        current_year: int | None = None
        current_edition: int | None = None
        for cells in row_cells:
            texts = [strip_tags(c[2]) for c in cells]
            if texts and texts[0].lower() in {"year", "film"}:
                continue
            # Detect year header cell (first cell)
            y, e = parse_year_edition(cells[0][2])
            cell0_text = strip_tags(cells[0][2])
            is_year_cell = y is not None and (
                bool(re.search(r"\((?:\d+)(?:st|nd|rd|th)\)", cell0_text))
                or "rowspan=" in cells[0][1].lower()
            )
            if is_year_cell:
                current_year, current_edition = y, e
                film_cells = cells[1:]
            else:
                film_cells = cells

            if current_year is None:
                continue

            for _tag, attrs, content in film_cells:
                if not re.search(r"background\s*:\s*#FAEB86", attrs, re.I):
                    continue
                # Film titles are italicized; producer/director gold cells are not.
                im = re.search(r"<i[^>]*>\s*(?:<b[^>]*>)?\s*(?:<a[^>]*>)?([^<]+)", content, re.I)
                if not im:
                    continue
                title = strip_tags(im.group(1))
                title = title.replace("†", "").strip()
                title = re.sub(r"\s*\[.*?\]\s*$", "", title).strip()
                if not title or len(title) > 120:
                    continue
                raw.append(
                    {
                        "film_year": current_year,
                        "edition": current_edition,
                        "title": title,
                    }
                )

    seen: set[tuple[int, str]] = set()
    items = []
    for w in raw:
        key = (w["film_year"], w["title"].lower())
        if key in seen:
            continue
        # Skip CSS/garbage catches
        if "mw-parser-output" in w["title"] or w["title"].startswith("."):
            continue
        seen.add(key)
        items.append(w)
    items.sort(key=lambda w: (-w["film_year"], w["title"]))

    def note(ceremony: int, _r: int, title: str) -> str:
        film_year = ceremony - 1
        ed = next(
            (w.get("edition") for w in items if w["film_year"] == film_year and w["title"] == title),
            None,
        )
        if not ed:
            ed = film_year - 1946  # 1947 = 1st
        return f"第{ed}届"

    rows = []
    for w in items:
        film_year = w["film_year"]
        ceremony = film_year + 1
        rows.append((ceremony, film_year, w["title"], None))

    write_award_list(
        "bafta-best-film",
        title="英国电影学院奖最佳影片",
        kicker="BAFTA · Best Film",
        dek=(
            "英国电影学院奖（BAFTA）最佳影片历届获奖名单，按典礼年份从新到旧排列。"
            "左侧可按年代、年份筛选。1962 年《士兵之歌》与《江湖浪子》并列获奖，均予收录。"
            "Wikipedia 年份为影片年份；本站侧栏与奥斯卡／评论家选择奖一致，按典礼年份（影片年 + 1）排列。"
        ),
        source_name="Wikipedia · BAFTA Award for Best Film",
        source_url="https://en.wikipedia.org/wiki/BAFTA_Award_for_Best_Film",
        order=18,
        rows=rows,
        note_fn=note,
    )


def build_cesar() -> None:
    html = fetch(
        "https://en.wikipedia.org/api/rest_v1/page/html/C%C3%A9sar_Award_for_Best_Film",
        "wiki-cesar-best-film.html",
    )
    raw = parse_wikitable_winners(html)
    by_year: dict[int, list[dict]] = {}
    for w in raw:
        if w["year"] is None:
            continue
        by_year.setdefault(w["year"], []).append(w)
    items = []
    for y, ws in by_year.items():
        # Smoking/No Smoking etc. — take first winner row only unless gold on multiple
        items.append(ws[0])
    items = winners_newest_first(items)

    def note(ceremony: int, _r: int, _t: str) -> str:
        ed = next((w.get("edition") for w in items if w["year"] == ceremony), None)
        if not ed:
            ed = ceremony - 1975  # 1976 = 1st
        return f"第{ed}届"

    rows = [(w["year"], w["year"], w["title"], None) for w in items]
    write_award_list(
        "cesar-best-film",
        title="凯撒奖最佳影片",
        kicker="César · Meilleur film",
        dek=(
            "法国凯撒奖（César）最佳影片历届获奖名单，按典礼年份从新到旧排列。"
            "左侧可按年代、年份筛选。自 1976 年首届起收录至最近一届。"
        ),
        source_name="Wikipedia · César Award for Best Film",
        source_url="https://en.wikipedia.org/wiki/C%C3%A9sar_Award_for_Best_Film",
        order=20,
        rows=rows,
        note_fn=note,
    )


def build_tspdt() -> None:
    html = fetch(
        "https://theyshootpictures.com/gf1000_all1000films_table.php",
        "tspdt-gf1000-table-2025.html",
    )
    films = []
    for m in re.finditer(r"<tr>\s*((?:<td[^>]*>.*?</td>\s*){7})</tr>", html, re.S):
        cells = re.findall(r"<td[^>]*>\s*(.*?)\s*</td>", m.group(1), re.S)
        cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
        if len(cells) != 7 or not cells[0].isdigit():
            continue
        pos = int(cells[0])
        title = normalize_title(cells[2])
        year_raw = cells[4].strip()
        # Histoire(s) du cinéma etc. span years — use start year for matching
        ym = re.match(r"(\d{4})", year_raw)
        if not ym:
            continue
        year = int(ym.group(1))
        director = cells[3]
        films.append((pos, title, year, director))
    films.sort(key=lambda x: x[0])
    if len(films) != 1000:
        print(f"WARNING: TSPDT parsed {len(films)} films (expected 1000)")

    # Rank-band sections of 100
    sections = []
    for band in range(10):
        start = band * 100 + 1
        end = (band + 1) * 100
        sections.append(
            {
                "id": f"r{start:03d}",
                "order": band,
                "name": f"{start}–{end}",
                "blurb": "",
                "color": RANK_BAND_COLORS[band],
            }
        )

    tsv_rows = []
    for pos, title, year, director in films:
        band_start = ((pos - 1) // 100) * 100 + 1
        section = f"r{band_start:03d}"
        tsv_rows.append([str(pos), title, str(year), section, director, ""])

    meta = {
        "id": "tspdt-1000",
        "title": "TSPDT 影史千佳",
        "kicker": "They Shoot Pictures, Don't They? · 1,000 Greatest Films",
        "dek": (
            "They Shoot Pictures, Don't They?（TSPDT）影史一千佳电影（2025 年版），按官方名次排列。"
            "左侧按名次段（每 100 部）筛选。片名与年份以 TSPDT 排序表为准；"
            "冠词后置等书写已略作规范化以便检索。"
        ),
        "source": {
            "name": "TSPDT · The 1,000 Greatest Films (2025 sortable table)",
            "url": "https://theyshootpictures.com/gf1000_all1000films_table.php",
        },
        "kind": "movie",
        "order": 19,
        "entries": "tspdt-1000.tsv",
        "sections": sections,
    }
    out_json = SEED / "tspdt-1000.json"
    out_tsv = SEED / "tspdt-1000.tsv"
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    header = "rank\ttitle\tyear\tsection\tnote\ttmdb_id\n"
    out_tsv.write_text(header + "\n".join("\t".join(r) for r in tsv_rows) + "\n", encoding="utf-8")
    print(f"tspdt-1000: {len(tsv_rows)} entries, {len(sections)} rank bands → {out_json.name}")


def main() -> None:
    build_golden_horse()
    build_hkfa()
    build_bafta()
    build_tspdt()
    build_cesar()


if __name__ == "__main__":
    main()
