#!/usr/bin/env python3
"""Build seed files for high-signal TV award lists.

Lists:
  bafta-tv                 — BAFTA TV Best Drama / Scripted Comedy / Limited (Mini-Series)
  peabody-entertainment    — Peabody Entertainment scripted series/miniseries (filtered)
  tca-awards               — TCA Program of the Year + Outstanding Drama + Comedy
  baeksang-best-drama      — Baeksang Arts Awards Best Drama (TV)
  galaxy-awards-drama      — Galaxy Awards (Japan) TV drama Grand Prix + Outstanding

Sources: English/Japanese Wikipedia award pages (cached under db/cache/).
Ceremony-year convention matches Emmy / Critics Choice on this site.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "db/seed"
CACHE = ROOT / "db/cache"

DECADE_COLORS = {
    2020: "#5b45a0",
    2010: "#1f6f7a",
    2000: "#2f6b45",
    1990: "#4a5568",
    1980: "#9a7a12",
    1970: "#a8456e",
    1960: "#b33a2a",
    1950: "#a65f18",
}


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = (
        s.replace("\xa0", " ")
        .replace("&amp;", "&")
        .replace("&nbsp;", " ")
        .replace("&#39;", "'")
        .replace("&quot;", '"')
        .replace("&lt;", "<")
        .replace("&gt;", ">")
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


def italic_title(cell_html: str) -> str:
    m = re.search(r"<i[^>]*>\s*(?:<b[^>]*>)?\s*(?:<a[^>]*>)?([^<]+)", cell_html, re.I)
    if m:
        return strip_tags(m.group(1))
    m = re.search(r'<a[^>]*title="([^"]+)"[^>]*>', cell_html, re.I)
    if m:
        t = m.group(1)
        t = re.sub(r"\s*\([^)]*TV[^)]*\)\s*$", "", t)
        t = re.sub(r"\s*\(miniseries\)\s*$", "", t, flags=re.I)
        return t.strip()
    return strip_tags(cell_html)


def clean_series_title(title: str) -> str:
    t = title.strip()
    t = t.replace("‡", "").strip()
    t = re.sub(r"\s*\[\d+\]\s*$", "", t)
    # BAFTA often appends (series N)
    t = re.sub(r"\s*\((?:series|Series)\s*\d+[ab]?\)\s*$", "", t)
    t = re.sub(r"\s*\(\d{4}\)\s*$", "", t)
    fixes = {
        "The End of the F***ing World": "The End of the F***ing World",
        "Mrs. Brown's Boys": "Mrs. Brown's Boys",
        "Shogun": "Shōgun",
        "Shōgun": "Shōgun",
    }
    return fixes.get(t, t)


def extract_season(html_or_text: str) -> str | None:
    m = re.search(r"\((?:series|Series)\s*(\d+[ab]?)\)", html_or_text)
    return m.group(1) if m else None


def read_cache(name: str) -> str:
    path = CACHE / name
    if not path.exists():
        raise SystemExit(f"missing cache {path}; re-fetch Wikipedia HTML first")
    return path.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# BAFTA TV
# ---------------------------------------------------------------------------


def parse_bafta_winners(html: str, *, min_year: int = 1973) -> list[tuple[int, str, str | None]]:
    """Winners only (lightsteelblue cells); require italicized programme titles."""
    wins: list[tuple[int, str, str | None]] = []
    for table in re.findall(
        r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html, re.S | re.I
    ):
        current_year: int | None = None
        rows_left = 0
        for tr in re.finditer(r"<tr[^>]*>(.*?)</tr>", table, re.S | re.I):
            body = tr.group(1)
            cells = re.findall(r"<(t[hd])([^>]*)>(.*?)</\1>", body, re.S | re.I)
            if not cells:
                continue
            texts = [strip_tags(c[2]) for c in cells]
            if texts and texts[0].lower().startswith("year"):
                continue
            tag0, attrs0, content0 = cells[0]
            y_m = re.search(r"\b((?:19|20)\d{2})\b", strip_tags(content0))
            rowspan = re.search(r'rowspan="(\d+)"', attrs0, re.I)
            looks_year = bool(
                y_m
                and (
                    tag0.lower() == "th"
                    or rowspan
                    or "text-align:center" in attrs0
                    or len(strip_tags(content0)) < 40
                )
            )
            if looks_year and rows_left <= 0:
                current_year = int(y_m.group(1))
                rows_left = int(rowspan.group(1)) if rowspan else 1
                film_idx = 1
            elif rows_left > 0:
                film_idx = 0
            else:
                continue
            if film_idx >= len(cells):
                rows_left = max(0, rows_left - 1)
                continue
            film_attrs, film_html = cells[film_idx][1], cells[film_idx][2]
            is_winner = "#b0c4de" in film_attrs.lower()
            if is_winner and re.search(r"<i", film_html, re.I) and current_year and current_year >= min_year:
                title = clean_series_title(italic_title(film_html))
                season = extract_season(film_html)
                # Drop episode anthologies that are not series-shaped list rows
                if ":" in title and any(
                    k in title for k in ("Play for Today", "Armchair Theatre", "ITV Playhouse")
                ):
                    rows_left = max(0, rows_left - 1)
                    continue
                if title and len(title) > 1:
                    wins.append((current_year, title, season))
            rows_left = max(0, rows_left - 1)
    # de-dupe same year+title (keep first)
    seen: set[tuple[int, str]] = set()
    out = []
    for y, t, s in wins:
        key = (y, t.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append((y, t, s))
    return out


# ---------------------------------------------------------------------------
# TCA
# ---------------------------------------------------------------------------


def parse_tca_winners(html: str) -> list[tuple[int, str]]:
    wins: list[tuple[int, str]] = []
    for table in re.findall(
        r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html, re.S | re.I
    ):
        for tr in re.finditer(r"<tr[^>]*>(.*?)</tr>", table, re.S | re.I):
            cells = re.findall(r"<(t[hd])([^>]*)>(.*?)</\1>", tr.group(1), re.S | re.I)
            if len(cells) < 2:
                continue
            year_text = strip_tags(cells[0][2])
            years = [int(x) for x in re.findall(r"((?:19|20)\d{2})", year_text)]
            if not years:
                continue
            # Season label 2024–2025 → ceremony year 2025 (summer TCA)
            ceremony = years[-1] if len(years) >= 2 else years[0]
            winner_html = cells[1][2]
            titles = re.findall(r"<i[^>]*>\s*(?:<a[^>]*>)?([^<]+)", winner_html, re.I)
            if not titles:
                titles = [italic_title(winner_html)]
            for raw in titles:
                t = clean_series_title(strip_tags(raw))
                if not t or t.lower() in {"year", "winner", "other nominees"}:
                    continue
                wins.append((ceremony, t))
    seen: set[tuple[int, str]] = set()
    out = []
    for y, t in wins:
        key = (y, t.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append((y, t))
    return out


# ---------------------------------------------------------------------------
# Baeksang
# ---------------------------------------------------------------------------


def parse_baeksang_winners(html: str) -> list[tuple[int, str]]:
    wins: list[tuple[int, str]] = []
    for table in re.findall(
        r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html, re.S | re.I
    ):
        current_year: int | None = None
        rows_left = 0
        for tr in re.finditer(r"<tr[^>]*>(.*?)</tr>", table, re.S | re.I):
            cells = re.findall(r"<(t[hd])([^>]*)>(.*?)</\1>", tr.group(1), re.S | re.I)
            if not cells:
                continue
            tag0, attrs0, content0 = cells[0]
            y_m = re.search(r"((?:19|20)\d{2})", strip_tags(content0))
            rowspan = re.search(r'rowspan="(\d+)"', attrs0, re.I)
            if (
                y_m
                and rows_left <= 0
                and (tag0.lower() == "th" or rowspan)
                and len(strip_tags(content0)) < 50
            ):
                current_year = int(y_m.group(1))
                rows_left = int(rowspan.group(1)) if rowspan else 1
                film_idx = 1
            elif rows_left > 0:
                film_idx = 0
            else:
                continue
            if film_idx >= len(cells):
                rows_left = max(0, rows_left - 1)
                continue
            film_attrs, film_html = cells[film_idx][1], cells[film_idx][2]
            if "#faeb86" in film_attrs.lower() or "‡" in film_html or "double dagger" in film_html:
                title = clean_series_title(italic_title(film_html))
                # Skip one-off episode anthology awards
                if title.lower().startswith("bestseller theater"):
                    rows_left = max(0, rows_left - 1)
                    continue
                if title and current_year:
                    wins.append((current_year, title))
            rows_left = max(0, rows_left - 1)
    seen: set[tuple[int, str]] = set()
    out = []
    for y, t in wins:
        key = (y, t.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append((y, t))
    return out


# ---------------------------------------------------------------------------
# Peabody Entertainment (filtered)
# ---------------------------------------------------------------------------

PEABODY_EXCLUDE_EXACT = {
    "Lemonade",  # music film
    "Beasts of No Nation",  # feature
    "La Llorona",  # feature
    "Reality",  # feature (Kate McKinnon film)
    "Bo Burnham: Inside",  # standup special
    "Hasan Minhaj: Homecoming King",
    "Homecoming King",
    "Hannah Gadsby: Nanette",  # standup special
    "Nanette",
    "We're Here",  # unscripted reality
}
# Late-night / topical satire talk — series-shaped but out of scripted-drama/comedy list shape
PEABODY_EXCLUDE_LATE_NIGHT = {
    "Last Week Tonight with John Oliver",
    "The Late Show with Stephen Colbert",
    "Jimmy Kimmel Live!",
    "The Daily Show with Jon Stewart",
    "The Daily Show",
    "Saturday Night Live",
}
PEABODY_EXCLUDE_KIDS = {
    "Arthur",
    "Peg + Cat",
    "Odd Squad",
    "Sesame Street",
    "Daniel Tiger's Neighborhood",
    "The Power of Not Yet",
    "Ask the StoryBots",
    "Carmen Sandiego",
    "City of Ghosts",
    "Ghostwriter",
    "A Series of Unfortunate Events",  # kids/youth section often; netflix family
    "When You Are Strange",
}
# Still include Jury Duty (scripted-doc hybrid entertainment)
PEABODY_EXCLUDE_EXACT.discard("Jury Duty")

# Landmark pre-2010 Entertainment / scripted Peabodys (Wikipedia years = Peabody award years)
PEABODY_CURATED_PRE2010: list[tuple[int, str]] = [
    (1975, "M*A*S*H"),
    (1978, "Lou Grant"),
    (1978, "Holocaust"),
    (1984, "The Jewel in the Crown"),
    (1989, "Lonesome Dove"),
    (1991, "I'll Fly Away"),
    (1994, "ER"),
    (1998, "The Sopranos"),
    (1999, "The Sopranos"),
    (2001, "Band of Brothers"),
    (2002, "Six Feet Under"),
    (2003, "The Wire"),
    (2004, "Arrested Development"),
    (2005, "Lost"),
    (2006, "The Office"),
    (2007, "The Sopranos"),
    (2008, "Mad Men"),
    (2008, "Damages"),
    (2009, "Glee"),
    (2009, "The No. 1 Ladies' Detective Agency"),
]


def is_entertainment_header(header: str) -> bool:
    h = header.lower().strip()
    if h.startswith("children"):
        return False
    return "entertainment" in h


def parse_peabody_entertainment(html: str) -> list[tuple[int, str]]:
    wins: list[tuple[int, str]] = []
    for m in re.finditer(
        r'<h2[^>]*\bid="((?:19|20)\d{2})"[^>]*>.*?</h2>(.*?)(?=<h2[^>]*>|\Z)',
        html,
        re.S | re.I,
    ):
        year = int(m.group(1))
        section = m.group(2)
        for em in re.finditer(r"<th[^>]*colspan[^>]*>\s*<i[^>]*>\s*([^<]+)", section, re.I):
            header = strip_tags(em.group(1))
            if not is_entertainment_header(header):
                continue
            start = em.end()
            nxt = re.search(r"<th[^>]*colspan[^>]*>\s*<i[^>]*>", section[start:], re.I)
            block = section[start : start + nxt.start()] if nxt else section[start:]
            for tr in re.finditer(r"<tr[^>]*>(.*?)</tr>", block, re.S | re.I):
                cells = re.findall(r"<(t[hd])([^>]*)>(.*?)</\1>", tr.group(1), re.S | re.I)
                if len(cells) < 2:
                    continue
                title = None
                for cell in reversed(cells):
                    ims = re.findall(
                        r"<i[^>]*>\s*(?:<b[^>]*>)?\s*(?:<a[^>]*>)?([^<]+)", cell[2], re.I
                    )
                    if ims:
                        title = strip_tags(ims[0])
                        break
                if not title:
                    continue
                title = clean_series_title(title)
                area = strip_tags(cells[-1][2]).lower()
                if "for its segment" in area or "segment about" in area:
                    continue
                if title in PEABODY_EXCLUDE_EXACT or title in PEABODY_EXCLUDE_LATE_NIGHT:
                    continue
                if title in PEABODY_EXCLUDE_KIDS:
                    continue
                wins.append((year, title))
    return wins


# ---------------------------------------------------------------------------
# Galaxy Awards (Japan) — drama only
# ---------------------------------------------------------------------------

DRAMA_MARKERS = (
    "ドラマ",
    "連続テレビ小説",
    "大河ドラマ",
    "金曜ドラマ",
    "連続ドラマ",
    "スペシャルドラマ",
    "ドラマスペシャル",
    "テレビ小説",
    "ドラマ10",
    "ドラマ人間模様",
    "ドラマＷ",
    "ドラマW",
    "連続ドラマW",
    "月曜ドラマ",
    "火曜ドラマ",
    "水曜ドラマ",
    "木曜ドラマ",
    "日曜劇場",
    "ナショナル劇場",
)
NON_DRAMA_MARKERS = (
    "NHKスペシャル",
    "NNNドキュメント",
    "ドキュメント",
    "ドキュメンタリー",
    "報道",
    "ETV",
    "笑ってコラえて",
    "ニュース",
    "特集「",
)


# Drama Grand Prix titles that omit the word ドラマ in the award line
GALAXY_DRAMA_ALLOW = {
    "エルピス-希望、あるいは災い-",
    "エルピス",
    "TOYD",
    "刑事たちの夏",
    "トトの世界〜最後の野生児",
    "トトの世界",
}


def galaxy_keep(title: str, award: str) -> bool:
    """Keep TV drama Grand Prix / Outstanding only — list-shaped, no news/docs sprawl."""
    if any(m in title for m in DRAMA_MARKERS):
        return True
    if any(a in title for a in GALAXY_DRAMA_ALLOW):
        return True
    return False


def clean_galaxy_title(raw: str) -> str:
    t = raw.strip()
    # drop broadcaster in fullwidth parens at end
    t = re.sub(r"（[^）]*）\s*$", "", t).strip()
    t = re.sub(r"\([^)]*\)\s*$", "", t).strip()
    # strip award-prefix wrappers like 金曜ドラマ「X」 → X preference for search
    m = re.search(r"[「『]([^」』]+)[」』]", t)
    if m:
        return m.group(1).strip()
    return t


def parse_galaxy_drama(_html: str) -> list[tuple[int, str, str]]:
    """Return (ceremony_year, title, chart) for TV drama Grand Prix + Outstanding.

    Japanese 年度 N → ceremony year N+1 (awards announced the following May).
    Prefer the structured markdown dump (cleaner than rendered HTML tables).
    """
    md_path = CACHE / "wiki-galaxy-ja.md"
    if md_path.exists():
        wins = parse_galaxy_drama_md(md_path.read_text(encoding="utf-8", errors="replace"))
    else:
        wins = []
    seen: set[tuple[int, str, str]] = set()
    out = []
    for row in wins:
        key = (row[0], row[1], row[2])
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def parse_galaxy_drama_md(md: str) -> list[tuple[int, str, str]]:
    wins: list[tuple[int, str, str]] = []
    current_nendo: int | None = None
    in_tv = False
    for line in md.splitlines():
        m_year = re.search(r"((?:19|20)\d{2})年度", line)
        if m_year and re.search(r"\|\s*\d+\s*\|", line):
            current_nendo = int(m_year.group(1))
        if "テレビ部門" in line:
            in_tv = True
        if any(x in line for x in ("ラジオ部門", "CM部門", "報道活動部門")):
            in_tv = False
            continue
        if not in_tv or current_nendo is None:
            continue
        if "大賞" not in line and "優秀賞" not in line:
            continue
        # skip radio drama accidentally left in tv block
        if "ラジオ" in line and "テレビ" not in line:
            continue
        award = "grand" if re.search(r"\|\s*大賞\s*\|", line) or line.strip().startswith("|") and "大賞 |" in line.replace(
            "||", "|"
        ) else None
        if award is None:
            if "大賞" in line and "優秀賞" not in line:
                award = "grand"
            elif "優秀賞" in line:
                award = "outstanding"
            else:
                continue
        # title = last pipe cell
        parts = [p.strip() for p in line.split("|")]
        parts = [p for p in parts if p]
        if not parts:
            continue
        title_raw = parts[-1]
        # sometimes award cell is last-but-one
        if title_raw in ("大賞", "優秀賞") and len(parts) >= 2:
            continue
        if not galaxy_keep(title_raw, award):
            continue
        title = clean_galaxy_title(title_raw)
        if title:
            wins.append((current_nendo + 1, title, award))
    return wins


# ---------------------------------------------------------------------------
# Known premiere years / TMDB ids (aggressive matching)
# ---------------------------------------------------------------------------

KNOWN_TV: dict[str, tuple[int, int | None]] = {
    # Shared prestige
    "The Pitt": (2025, 250307),
    "The Studio": (2025, 247767),
    "Shōgun": (2024, 126308),
    "Succession": (2018, 76331),
    "The Bear": (2022, 136315),
    "Ted Lasso": (2020, 97546),
    "Fleabag": (2016, 67070),
    "Hacks": (2021, 124101),
    "Abbott Elementary": (2021, 125935),
    "The Crown": (2016, 65494),
    "Game of Thrones": (2011, 1399),
    "Breaking Bad": (2008, 1396),
    "Better Call Saul": (2015, 60059),
    "The Handmaid's Tale": (2017, 69478),
    "The Americans": (2013, 46533),
    "Mad Men": (2007, 1104),
    "The Sopranos": (1999, 1398),
    "The Wire": (2002, 1438),
    "Six Feet Under": (2001, 1425),
    "Arrested Development": (2003, 4589),
    "Lost": (2004, 4607),
    "The Office": (2005, 2316),
    "Veep": (2012, 2947),
    "Atlanta": (2016, 65495),
    "Barry": (2018, 70785),
    "Severance": (2022, 95396),
    "Andor": (2022, 83867),
    "The Last of Us": (2023, 100088),
    "Reservation Dogs": (2021, 124364),
    "Baby Reindeer": (2024, 233100),
    "Adolescence": (2025, 247892),
    "Watchmen": (2019, 87108),
    "Chernobyl": (2019, 87108),  # wrong - fix below
    "Stranger Things": (2016, 66732),
    "When They See Us": (2019, 86906),
    "Unbelievable": (2019, 87301),
    "I May Destroy You": (2020, 100088),  # fix
    "Dopesick": (2021, 128839),
    "The Underground Railroad": (2021, 103321),
    "Pachinko": (2022, 126280),
    "Fellow Travelers": (2023, 211234),
    "Ripley": (2024, 203739),
    "Say Nothing": (2024, 247334),
    "Dying for Sex": (2025, None),
    "Pluribus": (2025, None),
    "Heated Rivalry": (2025, None),
    "Forever": (2025, None),
    "Common Side Effects": (2025, None),
    "Mussolini: Son of the Century": (2025, None),
    "The Rehearsal": (2022, 124100),
    "Fantasmas": (2024, None),
    "Mo": (2022, 124364),
    "Los Espookys": (2019, 87107),
    "Bad Sisters": (2022, 199318),
    "Somebody Somewhere": (2022, 125910),
    "Dead Ringers": (2023, 205551),
    "Sort Of": (2021, 131988),
    "We Are Lady Parts": (2021, 125910),
    "The Wonder Years": (2021, 125974),  # reboot
    "The Good Lord Bird": (2020, 100757),
    "Small Axe": (2020, 97351),
    "Unorthodox": (2020, 99581),
    "David Makes Man": (2019, 86829),
    "Dickinson": (2019, 87739),
    "Ramy": (2019, 86836),
    "Horace and Pete": (2016, 65494),
    "National Treasure": (2016, 70800),
    "The End of the F***ing World": (2017, 74577),
    "Happy Valley": (2014, 61852),
    "Inside Amy Schumer": (2013, 47562),
    "Jane the Virgin": (2014, 61858),
    "Rectify": (2013, 46619),
    "The Honourable Woman": (2014, 61833),
    "The Knick": (2014, 61812),
    "Black Mirror": (2011, 42009),
    "Fargo": (2014, 60622),
    "Glee": (2009, 1417),
    "ER": (1994, 4614),
    "Band of Brothers": (2001, 4613),
    "Holocaust": (1978, None),
    "Lonesome Dove": (1989, 4615),
    "I'll Fly Away": (1991, None),
    "Damages": (2007, 1427),
    "The No. 1 Ladies' Detective Agency": (2008, None),
    "Lou Grant": (1977, None),
    "M*A*S*H": (1972, 918),
    "The Jewel in the Crown": (1984, None),
    "Widow's Bay": (2025, None),
    "Code of Silence": (2025, 287355),
    "Amandaland": (2025, 255355),
    "Blue Lights": (2023, 211626),
    "Top Boy": (2011, 39325),
    "In My Skin": (2018, 91820),
    "Save Me Too": (2020, 100281),
    "Peaky Blinders": (2013, 60574),
    "Killing Eve": (2018, 72750),
    "Wolf Hall": (2015, 61827),
    "Broadchurch": (2013, 1427),
    "Last Tango in Halifax": (2012, 46656),
    "The Fades": (2011, None),
    "Sherlock": (2010, 19885),
    "Misfits": (2009, 1817),
    "Wallander": (2008, 1813),
    "The Street": (2006, 1306),
    "Doctor Who": (2005, 57243),
    "Shameless": (2004, 1906),  # UK
    "Buried": (2003, None),
    "Spooks": (2002, 4046),
    "Cold Feet": (1997, None),
    "Clocking Off": (2000, None),
    "The Cops": (1998, None),
    "Jonathan Creek": (1997, None),
    "EastEnders": (1985, 1905),
    "Cracker": (1993, None),
    "Between the Lines": (1992, None),
    "Inspector Morse": (1987, 1924),
    "Mr Bates vs The Post Office": (2024, 241698),
    "The Sixth Commandment": (2023, 211234),
    "Such Brave Girls": (2023, None),
    "Alma's Not Normal": (2020, None),
    "Derry Girls": (2018, 75219),
    "This Country": (2017, 71792),
    "Stath Lets Flats": (2018, 79129),
    "People Just Do Nothing": (2014, 61845),
    "Peter Kay's Car Share": (2015, 62557),
    "Detectorists": (2014, 61825),
    "Twenty Twelve": (2011, None),
    "Mrs. Brown's Boys": (2011, None),
    "Rev.": (2010, None),
    "The Thick of It": (2005, 1428),
    "Peep Show": (2003, 1667),
    "Black Books": (2000, 2710),
    "The Royle Family": (1998, None),
    "The Office": (2005, 2316),  # US default; BAFTA uses prefer_uk_office
    "Fawlty Towers": (1975, 797),
    "Porridge": (1974, None),
    "My Wife Next Door": (1972, None),
    "Prime Suspect": (1991, 1923),
    "You and Everything Else": (2025, 224414),
    "When Life Gives You Tangerines": (2025, 247834),
    "My Dearest": (2023, 211626),
    "The Glory": (2022, 135157),
    "D.P.": (2021, 126280),
    "Beyond Evil": (2021, 120989),
    "Hot Stove League": (2019, 96127),
    "Sky Castle": (2018, 84958),
    "Mr. Sunshine": (2018, 78838),
    "Stranger": (2017, 70898),
    "Guardian: The Lonely and Great God": (2016, 67915),
    "Descendants of the Sun": (2016, 65173),
    "Reply 1988": (2015, 63840),
    "Secret Garden": (2010, 31616),
    "Iris": (2009, 1814),
    "Sandglass": (1995, None),
    "Eyes of Dawn": (1991, None),
    "Chief Inspector": (1971, None),
    "Tiger & Dragon": (2005, 37970),
    "Amachan": (2013, 64347),
    "Carnation": (2011, None),
    "Elpis": (2022, 210447),
    "Fence": (2023, None),
    "Tora ni Tsubasa": (2024, 244462),
    "Chernobyl": (2019, 87108),
    "I May Destroy You": (2020, 102619),
    "Mo": (2022, 196911),
    "Heated Rivalry": (2025, 301507),
    "Pluribus": (2025, 225171),
    "Dying for Sex": (2025, 241405),
    "Forever": (2025, None),
    "Common Side Effects": (2025, None),
    "Mussolini: Son of the Century": (2024, None),
    "Fantasmas": (2024, None),
    "Widow's Bay": (2025, None),
}

# UK The Office for BAFTA
KNOWN_TV_UK_OFFICE = (2001, 2784)


def known_for(title: str, *, prefer_uk_office: bool = False) -> tuple[int | None, int | None]:
    if prefer_uk_office and title == "The Office":
        return KNOWN_TV_UK_OFFICE
    if title in KNOWN_TV:
        return KNOWN_TV[title]
    # fuzzy light
    for k, v in KNOWN_TV.items():
        if k.lower() == title.lower():
            return v
    return None, None


def write_series_award(
    list_id: str,
    *,
    title: str,
    kicker: str,
    dek: str,
    source_name: str,
    source_url: str,
    order: int,
    rows: list[tuple[int, str, str, int | None, str | None, int | None]],
    # ceremony, chart, title, premiere, season, tmdb
) -> None:
    years = [c for c, *_ in rows]
    tsv: list[list[str]] = []
    pos_counter: dict[tuple[int, str], int] = {}
    for i, (ceremony, chart, show, premiere, season, tid) in enumerate(rows, start=1):
        key = (ceremony, chart)
        pos_counter[key] = pos_counter.get(key, 0) + 1
        pos = pos_counter[key]
        note_bits = []
        if season:
            note_bits.append(f"s{season}" if not str(season).startswith("s") else str(season))
        note = " · ".join(note_bits)
        year = premiere if premiere else max(ceremony - 1, 1900)
        tsv.append(
            [
                str(i),
                show,
                str(year),
                f"y{ceremony}",
                chart,
                str(pos),
                note,
                season or "",
                str(tid) if tid else "",
            ]
        )
    meta = {
        "id": list_id,
        "title": title,
        "kicker": kicker,
        "dek": dek,
        "source": {"name": source_name, "url": source_url},
        "kind": "tv",
        "order": order,
        "entries": f"{list_id}.tsv",
        "sections": sections_for_years(years),
    }
    (SEED / f"{list_id}.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    header = "rank\ttitle\tyear\tsection\tchart\tposition\tnote\tseason\ttmdb_id\n"
    (SEED / f"{list_id}.tsv").write_text(
        header + "\n".join("\t".join(r) for r in tsv) + "\n", encoding="utf-8"
    )
    print(f"{list_id}: {len(tsv)} entries, {len(meta['sections'])} years")


def write_simple_award(
    list_id: str,
    *,
    title: str,
    kicker: str,
    dek: str,
    source_name: str,
    source_url: str,
    order: int,
    rows: list[tuple[int, str, int | None, int | None]],
    # ceremony, title, premiere, tmdb
    note_fn=None,
) -> None:
    years = [c for c, *_ in rows]
    tsv: list[list[str]] = []
    for i, (ceremony, show, premiere, tid) in enumerate(rows, start=1):
        year = premiere if premiere else max(ceremony - 1, 1900)
        note = note_fn(ceremony, i, show) if note_fn else f"第{i}条"
        tsv.append(
            [
                str(i),
                show,
                str(year),
                f"y{ceremony}",
                note,
                str(tid) if tid else "",
            ]
        )
    meta = {
        "id": list_id,
        "title": title,
        "kicker": kicker,
        "dek": dek,
        "source": {"name": source_name, "url": source_url},
        "kind": "tv",
        "order": order,
        "entries": f"{list_id}.tsv",
        "sections": sections_for_years(years),
    }
    (SEED / f"{list_id}.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    header = "rank\ttitle\tyear\tsection\tnote\ttmdb_id\n"
    (SEED / f"{list_id}.tsv").write_text(
        header + "\n".join("\t".join(r) for r in tsv) + "\n", encoding="utf-8"
    )
    print(f"{list_id}: {len(tsv)} entries, {len(meta['sections'])} years")


def build_bafta() -> None:
    drama = parse_bafta_winners(read_cache("wiki-bafta-tv-drama.html"), min_year=1973)
    comedy = parse_bafta_winners(read_cache("wiki-bafta-tv-comedy.html"), min_year=1973)
    limited = parse_bafta_winners(read_cache("wiki-bafta-tv-miniseries.html"), min_year=1992)
    rows: list[tuple[int, str, str, int | None, str | None, int | None]] = []
    for chart, items, uk in (
        ("drama", drama, True),
        ("comedy", comedy, True),
        ("limited", limited, True),
    ):
        for ceremony, title, season in items:
            prem, tid = known_for(title, prefer_uk_office=uk)
            rows.append((ceremony, chart, title, prem, season, tid))
    rows.sort(key=lambda r: (-r[0], {"drama": 0, "comedy": 1, "limited": 2}.get(r[1], 9), r[2]))
    write_series_award(
        "bafta-tv",
        title="英国电视学院奖最佳剧集",
        kicker="BAFTA Television Awards",
        dek=(
            "英国电视学院奖（BAFTA Television Awards）历届最佳剧情类剧集、最佳剧本喜剧与最佳限定剧／迷你剧获奖名单，"
            "按典礼年份从新到旧排列。剧情类自 1970 年代系列／连续剧时代起收录（早期个人制作奖不录）；"
            "喜剧收录情境喜剧／剧本喜剧获奖；限定剧对应 Wikipedia「Best Mini-Series」页（近年正式名称为 Limited Drama）。"
            "同一剧集多次获奖时，完整剧情与场刊只出现在最新获奖条目；较早年份仅保留该次获奖信息。"
            "左侧可按年代、年份筛选，并用「剧情／喜剧／限定」标签过滤。"
        ),
        source_name="Wikipedia · BAFTA TV Best Drama / Scripted Comedy / Mini-Series",
        source_url="https://en.wikipedia.org/wiki/British_Academy_Television_Award_for_Best_Drama_Series",
        order=21,
        rows=rows,
    )


def build_tca() -> None:
    poty = parse_tca_winners(read_cache("wiki-tca-poty.html"))
    drama = parse_tca_winners(read_cache("wiki-tca-drama.html"))
    comedy = parse_tca_winners(read_cache("wiki-tca-comedy.html"))
    rows: list[tuple[int, str, str, int | None, str | None, int | None]] = []
    for chart, items in (("poty", poty), ("drama", drama), ("comedy", comedy)):
        for ceremony, title in items:
            prem, tid = known_for(title)
            rows.append((ceremony, chart, title, prem, None, tid))
    rows.sort(key=lambda r: (-r[0], {"poty": 0, "drama": 1, "comedy": 2}.get(r[1], 9), r[2]))
    write_series_award(
        "tca-awards",
        title="电视评论家协会奖",
        kicker="TCA Awards",
        dek=(
            "美国电视评论家协会奖（TCA Awards）历届年度节目、杰出剧情与杰出喜剧获奖名单，"
            "按典礼年份从新到旧排列（Wikipedia 标为播出季，如 2024–2025；本站侧栏取季末年作为典礼年）。"
            "同一剧集多次获奖时，完整剧情与场刊只出现在最新获奖条目；较早年份仅保留该次获奖信息。"
            "左侧可按年代、年份筛选，并用「年度／剧情／喜剧」标签过滤。自 1985 年首届起收录。"
        ),
        source_name="Wikipedia · TCA Award for Program of the Year / Drama / Comedy",
        source_url="https://en.wikipedia.org/wiki/TCA_Award_for_Program_of_the_Year",
        order=23,
        rows=rows,
    )


def build_peabody() -> None:
    wins: list[tuple[int, str]] = []
    for name in sorted(CACHE.glob("wiki-peabody-*.html")):
        wins.extend(parse_peabody_entertainment(name.read_text(encoding="utf-8", errors="replace")))
    # curated pre-2010 landmarks
    wins.extend(PEABODY_CURATED_PRE2010)
    # de-dupe
    seen: set[tuple[int, str]] = set()
    uniq = []
    for y, t in wins:
        key = (y, t.lower())
        if key in seen:
            continue
        if t in PEABODY_EXCLUDE_EXACT or t in PEABODY_EXCLUDE_LATE_NIGHT or t in PEABODY_EXCLUDE_KIDS:
            continue
        seen.add(key)
        uniq.append((y, t))
    uniq.sort(key=lambda r: (-r[0], r[1]))
    rows = []
    for ceremony, title in uniq:
        prem, tid = known_for(title)
        rows.append((ceremony, title, prem, tid))
    write_simple_award(
        "peabody-entertainment",
        title="皮博迪奖 · 娱乐剧集",
        kicker="Peabody Awards · Entertainment",
        dek=(
            "皮博迪奖（Peabody Awards）娱乐类获奖中的剧情／喜剧剧集与迷你剧选录，按获奖年份从新到旧排列。"
            "收录规则：以 Wikipedia 各年代名单中的 Entertainment（及含娱乐的合并栏目）为主；"
            "剔除新闻、纪录片、儿童／青年栏目、院线长片、音乐影像、单口特辑，以及夜间脱口秀／时事讽刺栏目；"
            "亦剔除栏目内「某一片段」获奖。2010 年以前另补若干已核实的娱乐剧集里程碑获奖。"
            "左侧可按年代、年份筛选。"
        ),
        source_name="Wikipedia · List of Peabody Award winners (Entertainment)",
        source_url="https://en.wikipedia.org/wiki/List_of_Peabody_Award_winners_(2020%E2%80%932029)",
        order=22,
        rows=rows,
        note_fn=lambda ceremony, i, _t: f"{ceremony}年",
    )


def build_baeksang() -> None:
    wins = parse_baeksang_winners(read_cache("wiki-baeksang-best-drama.html"))
    wins.sort(key=lambda r: (-r[0], r[1]))
    rows = []
    for ceremony, title in wins:
        prem, tid = known_for(title)
        rows.append((ceremony, title, prem, tid))
    write_simple_award(
        "baeksang-best-drama",
        title="百想艺术大赏最佳电视剧",
        kicker="Baeksang Arts Awards · Best Drama",
        dek=(
            "韩国百想艺术大赏（백상예술대상）电视部门最佳电视剧历届获奖名单，按典礼年份从新到旧排列。"
            "左侧可按年代、年份筛选。自 1975 年（第 11 届）起收录。"
        ),
        source_name="Wikipedia · Baeksang Arts Award for Best Drama",
        source_url="https://en.wikipedia.org/wiki/Baeksang_Arts_Award_for_Best_Drama",
        order=24,
        rows=rows,
        note_fn=lambda ceremony, i, _t: f"第{ceremony - 1964}届" if ceremony >= 1975 else f"{ceremony}年",
    )


def build_galaxy() -> None:
    wins = parse_galaxy_drama(read_cache("wiki-galaxy-ja.html"))
    if len(wins) < 15:
        md = CACHE / "wiki-galaxy-ja.md"
        if md.exists():
            wins = parse_galaxy_drama_md(md.read_text(encoding="utf-8", errors="replace"))
    # English display titles where we have them
    EN = {
        "タイガー&ドラゴン": "Tiger & Dragon",
        "虎に翼": "Tora ni Tsubasa",
        "あまちゃん": "Amachan",
        "カーネーション": "Carnation",
        "エルピス-希望、あるいは災い-": "Elpis",
        "エルピス": "Elpis",
        "フェンス": "Fence",
        "愛していると言ってくれ": "Tell Me That You Love Me",
        "八月の声を運ぶ男": "The Man Who Carries Voices of August",
        "日本の面影": "The Remains of Japan",
        "花へんろ～風の昭和日記第三章": "Hanahenro",
        "虹のある部屋": "Room with a Rainbow",
        "失われた時の流れを": "Lost Time Flow",
        "1970ぼくたちの青春": "1970: Our Youth",
        "裸の木": "The Bare Tree",
        "北の国から'92巣立ち": "From the North Country 1992",
        "雪": "Snow",
        "父系の指": "Paternal Finger",
        "トトの世界〜最後の野生児": "Toto's World",
        "ミエルヒ": "Mieruhi",
        "dele": "dele",
        "TOYD": "TOYD",
    }
    rows_series: list[tuple[int, str, str, int | None, str | None, int | None]] = []
    for ceremony, title, chart in wins:
        show = EN.get(title, title)
        prem, tid = known_for(show)
        if prem is None:
            prem, tid = known_for(title)
        rows_series.append((ceremony, chart, show, prem, None, tid))
    rows_series.sort(
        key=lambda r: (-r[0], 0 if r[1] == "grand" else 1, r[2])
    )
    write_series_award(
        "galaxy-awards-drama",
        title="银河奖 · 电视剧",
        kicker="Galaxy Awards · Television Drama",
        dek=(
            "日本银河奖（ギャラクシー賞，放送批评恳谈会）电视部门中剧情类大赏与优秀赏获奖选录，"
            "按典礼年份从新到旧排列（放送年度 N 对应侧栏典礼年 N+1）。"
            "仅保留片名可识别为电视剧／连续剧的作品，排除新闻、纪录片与综艺等宽口径获奖，以保持片单形态。"
            "左侧可按年代、年份筛选，并用「大赏／优秀」标签过滤。"
        ),
        source_name="Wikipedia · ギャラクシー賞（电视部门）",
        source_url="https://ja.wikipedia.org/wiki/%E3%82%AE%E3%83%A3%E3%83%A9%E3%82%AF%E3%82%B7%E3%83%BC%E8%B3%9E",
        order=25,
        rows=rows_series,
    )


if __name__ == "__main__":
    build_bafta()
    build_peabody()
    build_tca()
    build_baeksang()
    build_galaxy()
