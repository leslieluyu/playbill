#!/usr/bin/env python3
"""Critics' Choice Awards → db/seed/critics-choice-{film,tv}.*

Film: Best Picture winners (ceremony years; first awards Jan 1996).
TV: Best Drama Series + Best Comedy Series (from 2011; dual mid/late 2016).

Sources: Wikipedia CCA Best Picture / Best Drama / Best Comedy pages;
official criticschoice.com winners archives (through 31st Annual, Jan 2026).
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "db/seed"

DECADE_COLORS = {
    2020: "#5b45a0",
    2010: "#1f6f7a",
    2000: "#2f6b45",
    1990: "#4a5568",
}

# (ceremony_year, title, premiere_year, tmdb_id|None)
# Ceremony year = Nth Annual Critics Choice Awards calendar year
# (Wikipedia Best Picture table year + 1).
FILM_WINS: list[tuple[int, str, int, int | None]] = [
    (2026, "One Battle After Another", 2025, 1054867),
    (2025, "Anora", 2024, 1064213),
    (2024, "Oppenheimer", 2023, 872585),
    (2023, "Everything Everywhere All at Once", 2022, 545611),
    (2022, "The Power of the Dog", 2021, 600583),
    (2021, "Nomadland", 2020, 581734),
    (2020, "Once Upon a Time... in Hollywood", 2019, 466272),
    (2019, "Roma", 2018, 426426),
    (2018, "The Shape of Water", 2017, 399055),
    (2017, "La La Land", 2016, 313369),
    (2016, "Spotlight", 2015, 314365),
    (2015, "Boyhood", 2014, 85350),
    (2014, "12 Years a Slave", 2013, 76203),
    (2013, "Argo", 2012, 68734),
    (2012, "The Artist", 2011, 74643),
    (2011, "The Social Network", 2010, 37799),
    (2010, "The Hurt Locker", 2008, 12162),
    (2009, "Slumdog Millionaire", 2008, 12405),
    (2008, "No Country for Old Men", 2007, 6977),
    (2007, "The Departed", 2006, 1422),
    (2006, "Brokeback Mountain", 2005, 142),
    (2005, "Sideways", 2004, 9675),
    (2004, "The Lord of the Rings: The Return of the King", 2003, 122),
    (2003, "Chicago", 2002, 1574),
    (2002, "A Beautiful Mind", 2001, 453),
    (2001, "Gladiator", 2000, 98),
    (2000, "American Beauty", 1999, 14),
    (1999, "Saving Private Ryan", 1998, 857),
    (1998, "L.A. Confidential", 1997, 2118),
    (1997, "Fargo", 1996, 275),
    (1996, "Sense and Sensibility", 1995, 4584),
]

# (ceremony_year, chart, title, premiere_year, season|None, note_rest|None, tmdb_id|None)
# Sorted newest first; within 2016, Dec ceremony before mid-year.
TV_WINS: list[tuple[int, str, str, int, str | None, str | None, int | None]] = [
    (2026, "drama", "The Pitt", 2025, "1", None, 250307),
    (2026, "comedy", "The Studio", 2025, "1", None, 247767),
    (2025, "drama", "Shōgun", 2024, "1", None, 126308),
    (2025, "comedy", "Hacks", 2021, "3", None, 124101),
    (2024, "drama", "Succession", 2018, "4", None, 76331),
    (2024, "comedy", "The Bear", 2022, "2", None, 136315),
    (2023, "drama", "Better Call Saul", 2015, "6", None, 60059),
    (2023, "comedy", "Abbott Elementary", 2021, "2", None, 125935),
    (2022, "drama", "Succession", 2018, "3", None, 76331),
    (2022, "comedy", "Ted Lasso", 2020, "2", None, 97546),
    (2021, "drama", "The Crown", 2016, "4", None, 65494),
    (2021, "comedy", "Ted Lasso", 2020, "1", None, 97546),
    (2020, "drama", "Succession", 2018, "2", None, 76331),
    (2020, "comedy", "Fleabag", 2016, "2", None, 67070),
    (2019, "drama", "The Americans", 2013, "6", None, 46533),
    (2019, "comedy", "The Marvelous Mrs. Maisel", 2017, "2", None, 70796),
    (2018, "drama", "The Handmaid's Tale", 2017, "1", None, 69478),
    (2018, "comedy", "The Marvelous Mrs. Maisel", 2017, "1", None, 70796),
    # 7th Critics' Choice Television Awards (Dec 2016)
    (2016, "drama", "Game of Thrones", 2011, "6", "Dec 2016", 1399),
    (2016, "comedy", "Silicon Valley", 2014, "3", "Dec 2016", 60573),
    # 6th Critics' Choice Television Awards (Jan/mid 2016)
    (2016, "drama", "Mr. Robot", 2015, "1", "Jun 2016", 62560),
    (2016, "comedy", "Master of None", 2015, "1", "Jun 2016", 64254),
    (2015, "drama", "The Americans", 2013, "3", None, 46533),
    (2015, "comedy", "Silicon Valley", 2014, "2", None, 60573),
    (2014, "drama", "Breaking Bad", 2008, "5", None, 1396),
    (2014, "comedy", "Orange Is the New Black", 2013, "1", None, 1424),
    (2013, "drama", "Breaking Bad", 2008, "5", None, 1396),
    (2013, "comedy", "The Big Bang Theory", 2007, "6", None, 1418),
    (2012, "drama", "Homeland", 2011, "1", None, 1407),
    (2012, "comedy", "Community", 2009, "3", None, 18347),
    (2011, "drama", "Mad Men", 2007, "4", None, 1104),
    (2011, "comedy", "Modern Family", 2009, "2", None, 1421),
]


def sections_for(years: list[int]) -> list[dict]:
    out = []
    for y in sorted(set(years), reverse=True):
        decade = (y // 10) * 10
        out.append(
            {
                "id": f"y{y}",
                "order": -y,
                "name": f"{y}年",
                "blurb": "",
                "color": DECADE_COLORS.get(decade, "#5f5a52"),
            }
        )
    return out


def write_film() -> None:
    years = [c for c, *_ in FILM_WINS]
    rows: list[list[str]] = []
    for i, (ceremony, title, premiere, tid) in enumerate(FILM_WINS, start=1):
        rows.append(
            [
                str(i),
                title,
                str(premiere),
                f"y{ceremony}",
                f"第{ceremony - 1995}届",
                str(tid) if tid else "",
            ]
        )
    meta = {
        "id": "critics-choice-film",
        "title": "美国评论家选择奖最佳影片",
        "kicker": "Critics Choice Awards · Best Picture",
        "dek": (
            "美国评论家选择奖（Critics Choice Awards，前身为广播影评人协会奖）历届最佳影片获奖名单，"
            "按典礼年份从新到旧排列。左侧可按年代、年份筛选。"
            "自 1996 年首届起收录至最近一届。"
        ),
        "source": {
            "name": "Wikipedia · Critics' Choice Movie Award for Best Picture",
            "url": "https://en.wikipedia.org/wiki/Critics%27_Choice_Movie_Award_for_Best_Picture",
        },
        "kind": "movie",
        "order": 14,
        "entries": "critics-choice-film.tsv",
        "sections": sections_for(years),
    }
    out_json = SEED / "critics-choice-film.json"
    out_tsv = SEED / "critics-choice-film.tsv"
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    header = "rank\ttitle\tyear\tsection\tnote\ttmdb_id\n"
    out_tsv.write_text(header + "\n".join("\t".join(r) for r in rows) + "\n", encoding="utf-8")
    print(f"critics-choice-film: {len(rows)} entries, {len(meta['sections'])} years → {out_json.name}")


def write_tv() -> None:
    years = [c for c, *_ in TV_WINS]
    rows: list[list[str]] = []
    pos_counter: dict[tuple[int, str], int] = {}
    with_season = 0
    for i, (ceremony, chart, title, premiere, season, rest, tid) in enumerate(TV_WINS, start=1):
        key = (ceremony, chart)
        pos_counter[key] = pos_counter.get(key, 0) + 1
        pos = pos_counter[key]
        note_bits: list[str] = []
        if season:
            with_season += 1
            note_bits.append(f"s{season}" if not str(season).startswith("s") else str(season))
        if rest:
            note_bits.append(rest)
        note = " · ".join(note_bits)
        rows.append(
            [
                str(i),
                title,
                str(premiere),
                f"y{ceremony}",
                chart,
                str(pos),
                note,
                season or "",
                str(tid) if tid else "",
            ]
        )
    meta = {
        "id": "critics-choice-tv",
        "title": "美国评论家选择奖最佳剧集",
        "kicker": "Critics Choice Awards · Best Series",
        "dek": (
            "美国评论家选择奖（Critics Choice Awards）历届最佳剧情类与最佳喜剧类剧集获奖名单，"
            "按典礼年份从新到旧排列。每条对应一次获奖季（标明季数）。"
            "同一剧集多次获奖时，完整剧情与场刊只出现在最新获奖条目；较早年份仅保留该次获奖信息。"
            "左侧可按年代、年份筛选，并用「剧情／喜剧」标签过滤。"
            "2016 年因档期调整举行两届（年中与年末），均予收录；电视奖自 2011 年起设立。"
        ),
        "source": {
            "name": "Wikipedia · Critics' Choice Television Award for Best Drama / Comedy Series",
            "url": "https://en.wikipedia.org/wiki/Critics%27_Choice_Television_Award_for_Best_Drama_Series",
        },
        "kind": "tv",
        "order": 15,
        "entries": "critics-choice-tv.tsv",
        "sections": sections_for(years),
    }
    out_json = SEED / "critics-choice-tv.json"
    out_tsv = SEED / "critics-choice-tv.tsv"
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    header = "rank\ttitle\tyear\tsection\tchart\tposition\tnote\tseason\ttmdb_id\n"
    out_tsv.write_text(header + "\n".join("\t".join(r) for r in rows) + "\n", encoding="utf-8")
    print(
        f"critics-choice-tv: {len(rows)} entries, {len(meta['sections'])} years, "
        f"{with_season}/{len(rows)} with season → {out_json.name}"
    )


if __name__ == "__main__":
    write_film()
    write_tv()
