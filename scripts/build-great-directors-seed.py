#!/usr/bin/env python3
"""Excel + docx → db/seed/great-directors.{json,tsv} and great-directors-directors.json (phase 1)."""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "docs/最佳导演榜单_v3_片单.xlsx"
DOCX = ROOT / "docs/最佳导演榜单_v3.docx"
OUT_JSON = ROOT / "db/seed/great-directors.json"
OUT_TSV = ROOT / "db/seed/great-directors.tsv"
OUT_DIR = ROOT / "db/seed/great-directors-directors.json"

SS2002_CRITIC = {
    "Orson Welles",
    "Alfred Hitchcock",
    "Jean-Luc Godard",
    "Jean Renoir",
    "Stanley Kubrick",
    "Akira Kurosawa",
    "Federico Fellini",
    "John Ford",
    "Sergei Eisenstein",
    "Francis Ford Coppola",
    "Yasujiro Ozu",
}
# BFI 2002 directors' poll — top ten directors (11 names; document §1-B).
SS2002_DIRECTOR = {
    "Akira Kurosawa",
    "Alfred Hitchcock",
    "Federico Fellini",
    "Ingmar Bergman",
    "Jean-Luc Godard",
    "John Ford",
    "Luis Buñuel",
    "Orson Welles",
    "Satyajit Ray",
    "Stanley Kubrick",
    "Steven Spielberg",
}


def slugify_en(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "director"


def docx_text() -> str:
    with zipfile.ZipFile(DOCX) as z:
        xml = z.read("word/document.xml").decode("utf-8", "ignore")
    xml = re.sub(r"</w:p>", "\n", xml)
    return re.sub(r"<[^>]+>", "", xml)


def excel_directors(rows) -> list[dict]:
    """One row per TSPDT rank from the film sheet (authoritative names)."""
    by_rank: dict[int, dict] = {}
    for r in rows:
        rank = int(r[0])
        if rank not in by_rank:
            by_rank[rank] = {"rank": rank, "zh": str(r[1]).strip(), "en": str(r[2]).strip(), "ss2002": r[3]}
    return [by_rank[k] for k in sorted(by_rank)]


def parse_tspdt_bios(text: str, directors: list[dict]) -> dict[str, dict]:
    """Parse TSPDT table in docx §3 by anchoring on Excel rank + Chinese name (250 rows)."""
    start = text.find("三、列表二：TSPDT")
    end = text.find("四、", start)
    chunk = text[start:end] if start >= 0 else text
    out: dict[str, dict] = {}
    dirs = sorted(directors, key=lambda d: d["rank"])

    def rank_zh_marker(rank: int, zh: str) -> str:
        return rf"{rank}\s*{re.escape(zh)}"

    def valid_country_token(s: str) -> bool:
        s = s.strip()
        if not (2 <= len(s) <= 8):
            return False
        if re.search(r"[，。；！？""以《]", s):
            return False
        if any(w in s for w in ("电影", "导演", "被称为", "代表", "新浪潮", "风格", "大师")):
            return False
        return True

    def is_country_line(line: str) -> bool:
        line = line.strip()
        if not line or len(line) > 28:
            return False
        parts = [p.strip() for p in re.split(r"/|、", line) if p.strip()]
        return bool(parts) and all(valid_country_token(p) for p in parts)

    for i, d in enumerate(dirs):
        m_start = re.search(rank_zh_marker(d["rank"], d["zh"]), chunk)
        pos = m_start.start() if m_start else chunk.find(d["en"])
        if pos < 0:
            continue

        if i + 1 < len(dirs):
            nxt = dirs[i + 1]
            m_end = re.search(rank_zh_marker(nxt["rank"], nxt["zh"]), chunk[pos + 1 :])
            end_pos = pos + 1 + m_end.start() if m_end else len(chunk)
        else:
            end_pos = len(chunk)
        block = chunk[pos:end_pos]

        en = d["en"]
        rest = block.split(en, 1)[1] if en in block else block
        rest = rest.strip()
        m_f = re.search(r"(\d+|-)\s*(\d+)\s*/\s*(\d+)\s*$", rest, re.M)
        prev, t1000, other = (None, None, None)
        if m_f:
            prev, t1000, other = m_f.groups()
            rest = rest[: m_f.start()].strip()

        countries: list[str] = []
        bio = ""
        lines = [ln.strip() for ln in rest.split("\n") if ln.strip()]
        if lines:
            head = lines[0]
            if is_country_line(head):
                countries = [p.strip() for p in re.split(r"/|、", head) if p.strip()]
                lines = lines[1:]
            else:
                m_c = re.match(
                    r"^((?:[\u4e00-\u9fff·]{2,8}(?:[/、][\u4e00-\u9fff·]{2,8})*))(?=[^/、]|$)",
                    head,
                )
                if m_c:
                    countries = [
                        p.strip()
                        for p in re.split(r"/|、", m_c.group(1))
                        if valid_country_token(p.strip())
                    ]
                    tail = head[m_c.end() :].strip()
                    lines = ([tail] if tail else []) + lines[1:]
        countries = [c for c in countries if valid_country_token(c)]
        bio = "\n".join(lines).strip("“”\"").strip()[:2000]
        if bio and bio[0] not in "“\"" and re.search(r"[”\"]", bio[:48]):
            bio = "“" + bio

        out[en] = {
            "tspdtRank": d["rank"],
            "zh": d["zh"],
            "en": en,
            "countries": countries,
            "bioZh": bio,
            "tspdtPrevRank": None if prev in (None, "-") else int(prev),
            "tspdt1000Count": int(t1000) if t1000 is not None else None,
            "tspdtOtherCount": int(other) if other is not None else None,
        }
    return out


def is_short(note: str | None) -> bool:
    if not note:
        return False
    n = str(note)
    return "短片" in n or "短剧" in n


def phase1_row(r) -> bool:
    if is_short(r[8]):
        return False
    if r[10] or r[9]:
        return True
    if r[13] in ("是", True, "Y", "y", 1):
        return True
    return False


def award_tags(awards: str | None) -> list[str]:
    s = awards or ""
    tags = []
    if "奥斯卡" in s:
        tags.append("oscar")
    if "戛纳" in s:
        tags.append("cannes")
    if "柏林" in s:
        tags.append("berlin")
    if "威尼斯" in s:
        tags.append("venice")
    if "金球" in s:
        tags.append("golden-globe")
    if "BAFTA" in s or "英国电影学院" in s:
        tags.append("bafta")
    if "凯撒" in s:
        tags.append("cesar")
    return tags


def style_tags_from_bio(bio: str) -> list[str]:
    s = bio or ""
    tags = []
    if re.search(r"德国表现主义|表现主义大师", s):
        tags.append("german-expressionism")
    if re.search(r"苏联蒙太奇|蒙太奇理论", s):
        tags.append("soviet-montage")
    if "法国印象主义" in s:
        tags.append("french-impressionism")
    if "超现实" in s:
        tags.append("surrealism")
    if re.search(r"黑色电影|noir", s, re.I):
        tags.append("film-noir")
    if "新客观" in s:
        tags.append("neue-sachlichkeit")
    if "新德国" in s:
        tags.append("new-german")
    if re.search(r"巴西新电影|Cinema Novo", s, re.I):
        tags.append("cinema-novo")
    if "日本新浪潮" in s:
        tags.append("japanese-new-wave")
    if re.search(r"法国新浪潮|新浪潮最激进|被新浪潮", s):
        tags.append("nouvelle-vague")
    if "捷克新浪潮" in s:
        tags.append("czech-new-wave")
    if "新现实主义" in s:
        tags.append("italian-neorealism")
    if "道格玛" in s:
        tags.append("dogme95")
    if re.search(r"华语新电影|两岸", s):
        tags.append("chinese-new")
    return list(dict.fromkeys(tags))


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    rows = list(wb["片单"].iter_rows(values_only=True))[1:]
    wb.close()

    directors_excel = excel_directors(rows)
    bios = parse_tspdt_bios(docx_text(), directors_excel)

    filtered = [r for r in rows if phase1_row(r)]
    filtered.sort(key=lambda r: (int(r[0]), int(r[4] or 0), str(r[6] or "")))

    directors: dict[str, dict] = {}
    for r in rows:
        en = str(r[2]).strip()
        rank = int(r[0])
        if en not in directors:
            meta = bios.get(en, {})
            master = []
            if en in SS2002_CRITIC:
                master.append("ss2002-critic")
            if en in SS2002_DIRECTOR:
                master.append("ss2002-director")
            if en in SS2002_CRITIC or en in SS2002_DIRECTOR:
                master.append("ss2002")
            slug = f"d{rank:03d}-{slugify_en(en)}"
            bio = meta.get("bioZh", "")
            directors[en] = {
                "slug": slug,
                "tspdtRank": rank,
                "zh": str(r[1]).strip(),
                "en": en,
                "countries": meta.get("countries") or [],
                "bioZh": bio,
                "masterTags": list(dict.fromkeys(master)),
                "styleTags": style_tags_from_bio(bio),
                "tspdt1000Count": meta.get("tspdt1000Count"),
                "tspdtOtherCount": meta.get("tspdtOtherCount"),
            }

    tsv_lines = [
        "rank\ttitle\tyear\tsection\tposition\tchart\tnote\twikidata\timdb_id\tdirector_en"
    ]
    rank = 0
    section_counts: dict[str, int] = {}

    for r in filtered:
        en = str(r[2]).strip()
        d = directors[en]
        section = d["slug"]
        section_counts[section] = section_counts.get(section, 0) + 1
        pos = section_counts[section]
        rank += 1

        tags = []
        if r[10]:
            tags.append("classic")
        if r[13] in ("是", True):
            tags.append("hot")
        tags.extend(award_tags(r[9]))
        chart = "|".join(dict.fromkeys(tags))

        title = str(r[7] or r[6] or r[5] or "Untitled").strip()
        zh = str(r[5]).strip() if r[5] else ""
        if zh and zh not in title:
            title = f"{zh} {title}" if title else zh
        year = int(r[4])
        note = str(r[8] or "").strip()
        if r[9]:
            note = (note + "；" if note else "") + str(r[9])
        wd = str(r[14]).strip()
        tsv_lines.append(
            "\t".join(
                [
                    str(rank),
                    title.replace("\t", " "),
                    str(year),
                    section,
                    str(pos),
                    chart,
                    note.replace("\t", " ")[:500],
                    wd,
                    "",
                    en,
                ]
            )
        )

    sections = []
    for en in sorted(directors.values(), key=lambda x: x["tspdtRank"]):
        if section_counts.get(en["slug"], 0) == 0:
            continue
        sections.append(
            {
                "id": en["slug"],
                "order": en["tspdtRank"],
                "name": en["zh"],
                "blurb": en["bioZh"][:280] if en["bioZh"] else "",
                "color": "#4a5568",
            }
        )

    meta = {
        "id": "great-directors",
        "title": "TSPDT 250 大导演",
        "kicker": "They Shoot Pictures, Don't They?",
        "dek": "TSPDT 2026 版 Top 250 导演策展片单：经典、获奖与热议长片（不含短片）。可按国家、大师、流派与电影节奖项筛选；按导演或按影片浏览。",
        "source": {
            "name": "TSPDT Top 250 Directors (2026) · Grok 整理 v3",
            "url": "https://www.theyshootpictures.com/gf1000_top250directors.htm",
        },
        "kind": "movie",
        "order": 11,
        "entries": "great-directors.tsv",
        "sections": sections,
    }

    OUT_JSON.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_TSV.write_text("\n".join(tsv_lines) + "\n", encoding="utf-8")
    OUT_DIR.write_text(
        json.dumps({"directors": sorted(directors.values(), key=lambda x: x["tspdtRank"])}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    missing_bio = [d["en"] for d in directors_excel if d["en"] not in bios or not bios[d["en"]].get("bioZh")]
    print(
        f"phase1 entries: {rank}, directors with films: {len(sections)}, "
        f"bios parsed: {sum(1 for b in bios.values() if b.get('bioZh'))}/{len(directors_excel)}"
    )
    if missing_bio:
        print(f"  bios missing ({len(missing_bio)}):", ", ".join(missing_bio[:8]), "..." if len(missing_bio) > 8 else "")


if __name__ == "__main__":
    main()
