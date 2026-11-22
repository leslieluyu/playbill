#!/usr/bin/env python3
"""docs/20世纪全球优秀电视剧汇总清单.pdf ch.10 → db/seed/emmy-outstanding-series.*

Season labels: prefer PDF「第N季」, then curated overrides, then S1 for clear
debut winners. Stored in TSV `season` (4 / 5a / 5b) and encoded into
list_entries.note as s4 / s5a / s5b for the UI.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "docs/20世纪全球优秀电视剧汇总清单.pdf"
OUT_JSON = ROOT / "db/seed/emmy-outstanding-series.json"
OUT_TSV = ROOT / "db/seed/emmy-outstanding-series.tsv"

# Premiere year + optional TMDB id so seed matching reuses existing works
# (Emmy ceremony year lives in section / note, not works.year_start).
KNOWN: dict[str, tuple[int, int | None]] = {
    "24": (2001, 1973),
    "30 Rock": (2006, 4608),
    "All in the Family": (1971, None),
    "Ally McBeal": (1997, None),
    "Arrested Development": (2003, 4589),
    "Barney Miller": (1975, None),
    "Breaking Bad": (2008, 1396),
    "Cagney & Lacey": (1982, None),
    "Cheers": (1982, 141),
    "Dragnet": (1951, None),
    "Elizabeth R": (1971, None),
    "Everybody Loves Raymond": (1996, None),
    "Fleabag": (2016, 67070),
    "Frasier": (1993, None),
    "Friends": (1994, 1668),
    "Game of Thrones": (2011, 1399),
    "Get Smart": (1965, None),
    "Gunsmoke": (1955, None),
    "Hacks": (2021, 124101),
    "Hill Street Blues": (1981, 3828),
    "Homeland": (2011, 1407),
    "I Love Lucy": (1951, 2730),
    "L.A. Law": (1986, None),
    "Law & Order": (1990, 549),
    "Lost": (2004, 4607),
    "Lou Grant": (1977, None),
    "M*A*S*H": (1972, 918),
    "Mad Men": (2007, 1104),
    "Marcus Welby, M.D.": (1969, None),
    "Maverick": (1957, None),
    "Mission: Impossible": (1966, None),
    "Modern Family": (2009, 1421),
    "Murphy Brown": (1988, None),
    "My World and Welcome to It": (1969, None),
    "Northern Exposure": (1990, None),
    "NYPD Blue": (1993, 194),
    "Picket Fences": (1992, None),
    "Police Story": (1973, None),
    "Schitt's Creek": (2015, 61662),
    "Seinfeld": (1989, 1400),
    "Sex and the City": (1998, 105),
    "Shōgun": (2024, 126308),
    "Studio One": (1948, None),
    "Succession": (2018, 76331),
    "Taxi": (1978, None),
    "Ted Lasso": (2020, 97546),
    "The Bear": (2022, 136315),
    "The Bold Ones: The Senator": (1970, None),
    "The Cosby Show": (1984, None),
    "The Crown": (2016, 65494),
    "The Danny Thomas Show": (1953, None),
    "The Defenders": (1961, None),
    "The Dick Van Dyke Show": (1961, None),
    "The Fugitive": (1963, None),
    "The Golden Girls": (1985, None),
    "The Handmaid's Tale": (2017, 69478),
    "The Marvelous Mrs. Maisel": (2017, None),
    "The Mary Tyler Moore Show": (1970, None),
    "The Monkees": (1966, None),
    "The Office": (2005, 2316),  # US remake (Emmy winner)
    "The Phil Silvers Show": (1955, None),
    "The Pitt": (2025, 250307),
    "The Practice": (1997, None),
    "The Rockford Files": (1974, None),
    "The Sopranos": (1999, 1398),
    "The Studio": (2025, None),
    "The Waltons": (1972, 5021),
    "The West Wing": (1999, None),
    "The Wonder Years": (1988, 4500),
    "The X-Files": (1993, 4087),
    "thirtysomething": (1987, 1448),
    "Upstairs, Downstairs": (1971, 492),
    "Veep": (2012, 2947),
    "Will & Grace": (1998, 4454),
}

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

# Curated (en title, ceremony year) → season token when PDF omits 第N季.
# Prefer well-attested Outstanding Drama/Comedy season mappings only.
SEASON_OVERRIDES: dict[tuple[str, int], str] = {
    # Clear debut / limited-series winners the PDF left unlabeled
    ("The Pitt", 2025): "1",
    ("The Studio", 2025): "1",
    ("Shōgun", 2024): "1",
    # Frasier comedy run
    ("Frasier", 1994): "1",
    ("Frasier", 1995): "2",
    ("Frasier", 1996): "3",
    ("Frasier", 1997): "4",
    ("Frasier", 1998): "5",
    ("Frasier", 2000): "7",
    # Hill Street Blues
    ("Hill Street Blues", 1981): "1",
    ("Hill Street Blues", 1982): "2",
    ("Hill Street Blues", 1983): "3",
    ("Hill Street Blues", 1984): "4",
    # Cheers
    ("Cheers", 1983): "1",
    ("Cheers", 1984): "2",
    ("Cheers", 1991): "9",
    # All in the Family
    ("All in the Family", 1971): "1",
    ("All in the Family", 1972): "2",
    ("All in the Family", 1973): "3",
    ("All in the Family", 1978): "8",
    # Mary Tyler Moore
    ("The Mary Tyler Moore Show", 1975): "5",
    ("The Mary Tyler Moore Show", 1976): "6",
    ("The Mary Tyler Moore Show", 1977): "7",
    # Taxi
    ("Taxi", 1979): "1",
    ("Taxi", 1980): "2",
    ("Taxi", 1981): "3",
    # Lou Grant
    ("Lou Grant", 1979): "2",
    ("Lou Grant", 1980): "3",
    # Cagney & Lacey
    ("Cagney & Lacey", 1985): "4",
    ("Cagney & Lacey", 1986): "5",
    # Cosby / Golden Girls
    ("The Cosby Show", 1985): "1",
    ("The Cosby Show", 1986): "2",
    ("The Golden Girls", 1987): "2",
    ("The Golden Girls", 1988): "3",
    # L.A. Law / thirtysomething
    ("L.A. Law", 1987): "1",
    ("L.A. Law", 1989): "3",
    ("L.A. Law", 1990): "4",
    ("thirtysomething", 1988): "1",
    ("thirtysomething", 1991): "4",
    # 1990s dramas
    ("The Practice", 1998): "2",
    ("The Practice", 1999): "3",
    ("Picket Fences", 1993): "1",
    ("Picket Fences", 1994): "2",
    ("Murphy Brown", 1990): "2",
    ("Murphy Brown", 1992): "4",
    ("NYPD Blue", 1995): "2",
    ("The X-Files", 1996): "3",
    ("Law & Order", 1997): "7",
    ("Northern Exposure", 1992): "3",
    ("Ally McBeal", 1999): "2",
    ("Seinfeld", 1993): "4",
    ("The Wonder Years", 1989): "2",
    # I Love Lucy (ceremony years in source)
    ("I Love Lucy", 1953): "2",
    ("I Love Lucy", 1954): "3",
    # Single-season / clear S1 when unlabeled
    ("Lost", 2005): "1",  # also in PDF as 第一季; keep for safety
    ("Homeland", 2012): "1",
    ("The Handmaid's Tale", 2017): "1",
    ("The Marvelous Mrs. Maisel", 2018): "1",
    ("The Bear", 2023): "1",
    ("Get Smart", 1969): "4",
    ("The Monkees", 1967): "1",
    ("The Fugitive", 1966): "3",
    ("M*A*S*H", 1974): "2",
    ("The Waltons", 1973): "1",
    ("Elizabeth R", 1972): "1",
    ("The Bold Ones: The Senator", 1971): "1",
    ("Marcus Welby, M.D.", 1970): "1",
    ("My World and Welcome to It", 1970): "1",
    ("The Rockford Files", 1978): "4",
    ("Police Story", 1976): "3",
    ("Barney Miller", 1982): "8",
    ("Maverick", 1959): "2",
    ("Gunsmoke", 1958): "3",
    # Upstairs, Downstairs (UK series numbering)
    ("Upstairs, Downstairs", 1974): "3",
    ("Upstairs, Downstairs", 1975): "4",
    ("Upstairs, Downstairs", 1977): "5",
    # Mission: Impossible (source lists 1968–1969)
    ("Mission: Impossible", 1968): "2",
    ("Mission: Impossible", 1969): "3",
    # The Defenders / Dick Van Dyke (source highlight ranges expanded per year)
    ("The Defenders", 1962): "1",
    ("The Defenders", 1963): "2",
    ("The Defenders", 1964): "3",
    ("The Dick Van Dyke Show", 1962): "1",
    ("The Dick Van Dyke Show", 1963): "2",
    ("The Dick Van Dyke Show", 1964): "3",
    ("The Dick Van Dyke Show", 1965): "4",
    ("The Dick Van Dyke Show", 1966): "5",
}

CN_DIGITS = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}

BULLET_RE = re.compile(r"^[●•\u25cf\uf0b7][\s\u200b\ufeff]*")
ENTRY_RE = re.compile(
    r"^(?P<y1>\d{4})(?:\s*[–—\-]\s*(?P<y2>\d{4}))?年[：:]\s*(?P<body>.+)$"
)
TITLE_PAIR_RE = re.compile(
    r"《(?P<zh>[^》]+)》\s*"
    r"(?:第(?P<season_cn>[一二三四五六七八九十百零〇两\d]+)季(?P<half>[上下]半部)?)?\s*"
    r"[（(](?P<en>[^）)]+)[）)]"
)


def cn_to_int(s: str) -> int | None:
    s = s.strip()
    if not s:
        return None
    if s.isdigit():
        return int(s)
    if s == "十":
        return 10
    if s == "百":
        return 100
    if re.fullmatch(r"\d+", s):
        return int(s)
    # 十一…十九 / 二十 / 二十一…
    if "十" in s:
        left, _, right = s.partition("十")
        tens = CN_DIGITS.get(left, 1) if left else 1
        ones = CN_DIGITS.get(right, 0) if right else 0
        return tens * 10 + ones
    if s in CN_DIGITS:
        return CN_DIGITS[s]
    return None


def season_token_from_pdf(season_cn: str | None, half: str | None) -> str | None:
    if not season_cn:
        return None
    n = cn_to_int(season_cn)
    if n is None or n < 1:
        return None
    if half == "上半部":
        return f"{n}a"
    if half == "下半部":
        return f"{n}b"
    return str(n)


def pdf_text() -> str:
    if not PDF.is_file():
        sys.exit(f"missing {PDF}")
    out = subprocess.check_output(["pdftotext", "-layout", str(PDF), "-"], text=True)
    return out.replace("\r\n", "\n")


def chapter10(text: str) -> str:
    m = re.search(r"(?:^|\f)十、\s*历届艾[米美]奖", text, re.M)
    if not m:
        sys.exit("chapter 10 marker not found")
    start = text.find("十、", m.start())
    return text[start if start >= 0 else m.start() :]


def normalize_en(en: str) -> str:
    en = en.strip()
    en = en.replace("Shogun", "Shōgun").replace("Shōgun", "Shōgun")
    en = re.sub(r"\s+", " ", en)
    return en


def parse_years(y1: str, y2: str | None) -> list[int]:
    a = int(y1)
    if not y2:
        return [a]
    b = int(y2)
    if b < a:
        a, b = b, a
    return list(range(a, b + 1))


def parse_titles(body: str) -> list[tuple[str, str, str | None]]:
    """Return list of (en, zh, season_token|None)."""
    body = body.strip()
    body = re.sub(r"\s*\n\s*", " ", body)
    pairs = list(TITLE_PAIR_RE.finditer(body))
    if not pairs:
        m = re.search(r"[（(]([^）)]*[A-Za-z][^）)]*)[）)]\s*$", body)
        if m:
            en = normalize_en(m.group(1))
            zh = body[: m.start()].replace("《", "").replace("》", "").strip(" ：:")
            return [(en, zh, None)]
        return [(normalize_en(body), body, None)]
    out: list[tuple[str, str, str | None]] = []
    for p in pairs:
        en = normalize_en(p.group("en"))
        zh = p.group("zh").strip()
        if "/" in zh:
            zh = zh.split("/")[0].strip()
        season = season_token_from_pdf(p.group("season_cn"), p.group("half"))
        out.append((en, zh, season))
    return out


def parse_entries(text: str) -> list[dict]:
    chart: str | None = None
    raw_lines: list[str] = []
    buf = ""

    def entry_complete(s: str) -> bool:
        return bool(re.search(r"[（(][^）)]*[A-Za-z][^）)]*[）)]\s*$", s.split("\t", 1)[-1]))

    def flush():
        nonlocal buf
        if buf:
            raw_lines.append(buf)
            buf = ""

    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if re.match(r"^1\.\s*最佳剧情|^1\.\s*剧情类", s):
            flush()
            chart = "drama"
            continue
        if re.match(r"^2\.\s*最佳喜剧|^2\.\s*喜剧类", s):
            flush()
            chart = "comedy"
            continue
        cleaned = BULLET_RE.sub("", s)
        if ENTRY_RE.match(cleaned):
            flush()
            buf = f"{chart}\t{cleaned}" if chart else cleaned
            if entry_complete(buf):
                flush()
        elif buf:
            buf += cleaned
            if entry_complete(buf):
                flush()
    flush()

    rows: list[dict] = []
    for raw in raw_lines:
        if "\t" in raw:
            ch, rest = raw.split("\t", 1)
        else:
            ch, rest = "drama", raw
        m = ENTRY_RE.match(rest)
        if not m:
            continue
        years = parse_years(m.group("y1"), m.group("y2"))
        titles = parse_titles(m.group("body"))
        if len(titles) == 1:
            en, zh, season = titles[0]
            for y in years:
                rows.append(
                    {
                        "emmy_year": y,
                        "en": en,
                        "zh": zh,
                        "chart": ch,
                        "season": season,
                    }
                )
        elif len(titles) == len(years):
            for y, (en, zh, season) in zip(years, titles):
                rows.append(
                    {
                        "emmy_year": y,
                        "en": en,
                        "zh": zh,
                        "chart": ch,
                        "season": season,
                    }
                )
        else:
            y_anchor = years[-1]
            span = f"{years[0]}–{years[-1]}" if len(years) > 1 else str(years[0])
            for en, zh, season in titles:
                rows.append(
                    {
                        "emmy_year": y_anchor,
                        "en": en,
                        "zh": zh,
                        "chart": ch,
                        "span": span,
                        "season": season,
                    }
                )

    return rows


def premiere_and_tmdb(en: str) -> tuple[int, int | None]:
    if en in KNOWN:
        return KNOWN[en]
    for k, v in KNOWN.items():
        if k.lower() == en.lower():
            return v
    return (0, None)


def resolve_season(en: str, emmy_year: int, parsed: str | None) -> str:
    if parsed:
        return parsed
    override = SEASON_OVERRIDES.get((en, emmy_year))
    if override:
        return override
    # Fuzzy key match for accents
    for (k, y), tok in SEASON_OVERRIDES.items():
        if y == emmy_year and k.lower() == en.lower():
            return tok
    return ""


def encode_note(season: str, span: str | None) -> str:
    bits: list[str] = []
    if season:
        bits.append(f"s{season}" if not season.startswith("s") else season)
    if span:
        bits.append(span)
    return " · ".join(bits)


def build() -> None:
    text = chapter10(pdf_text())
    parsed = parse_entries(text)
    if not parsed:
        sys.exit("no Emmy entries parsed")

    parsed.sort(key=lambda r: (-r["emmy_year"], 0 if r["chart"] == "drama" else 1, r["en"]))

    premiere: dict[str, int] = {}
    tmdb: dict[str, int] = {}
    for r in parsed:
        en = r["en"]
        p, tid = premiere_and_tmdb(en)
        if tid:
            tmdb[en] = tid
        if p:
            premiere[en] = p
        else:
            premiere[en] = min(premiere.get(en, r["emmy_year"]), r["emmy_year"])

    years = sorted({r["emmy_year"] for r in parsed}, reverse=True)
    sections = []
    for y in years:
        decade = (y // 10) * 10
        sections.append(
            {
                "id": f"y{y}",
                "order": -y,
                "name": f"{y}年",
                "blurb": "",
                "color": DECADE_COLORS.get(decade, "#5f5a52"),
            }
        )

    pos_counter: dict[tuple[int, str], int] = {}
    tsv_rows: list[list[str]] = []
    with_season = 0
    for i, r in enumerate(parsed, start=1):
        key = (r["emmy_year"], r["chart"])
        pos_counter[key] = pos_counter.get(key, 0) + 1
        pos = pos_counter[key]
        en = r["en"]
        year_air = premiere[en]
        season = resolve_season(en, r["emmy_year"], r.get("season"))
        if season:
            with_season += 1
        note = encode_note(season, r.get("span"))
        tid = tmdb.get(en)
        tsv_rows.append(
            [
                str(i),
                en,
                str(year_air),
                f"y{r['emmy_year']}",
                r["chart"],
                str(pos),
                note,
                season,
                str(tid) if tid else "",
            ]
        )

    meta = {
        "id": "emmy-outstanding-series",
        "title": "艾美奖最佳剧集",
        "kicker": "Primetime Emmy Awards",
        "dek": (
            "黄金时段艾美奖（Primetime Emmy Awards）历届最佳剧情类与最佳喜剧类剧集获奖名单，"
            "按典礼年份从新到旧排列。每条对应一次获奖季（标明季数）。"
            "同一剧集多次获奖时，完整剧情与场刊只出现在最新获奖条目；较早年份仅保留该次获奖信息。"
            "左侧可按年代、年份筛选，并用「剧情／喜剧」标签过滤。早期年代为代表性获奖作品选录。"
        ),
        "source": {
            "name": "20 世纪全球优秀电视剧汇总清单 · 第十章（场刊整理）",
            "url": "https://playbill.icdp.uk/emmy-outstanding-series/",
        },
        "kind": "tv",
        "order": 13,
        "entries": "emmy-outstanding-series.tsv",
        "sections": sections,
    }

    OUT_JSON.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    header = "rank\ttitle\tyear\tsection\tchart\tposition\tnote\tseason\ttmdb_id\n"
    body = "\n".join("\t".join(cells) for cells in tsv_rows) + "\n"
    OUT_TSV.write_text(header + body, encoding="utf-8")
    print(
        f"emmy-outstanding-series: {len(tsv_rows)} entries, {len(sections)} years, "
        f"{len({r['en'] for r in parsed})} unique titles, "
        f"{with_season}/{len(tsv_rows)} with season → {OUT_JSON.name}"
    )


if __name__ == "__main__":
    build()
