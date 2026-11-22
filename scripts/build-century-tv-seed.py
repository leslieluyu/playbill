#!/usr/bin/env python3
"""docs/20世纪全球优秀电视剧汇总清单.pdf → db/seed/century-tv-20th.* (chapters 1–9)."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "docs/20世纪全球优秀电视剧汇总清单.pdf"
OUT_JSON = ROOT / "db/seed/century-tv-20th.json"
OUT_TSV = ROOT / "db/seed/century-tv-20th.tsv"
OUT_CARDS = ROOT / "db/seed/century-tv-20th-cards.jsonl"

CHAPTER_MARKERS = [
    ("cn", r"^一、"),
    ("uk", r"^二、"),
    ("jp", r"^三、"),
    ("euro", r"^四、"),
    ("us-picks", r"^五、"),
    ("tv-book", r"^六、"),
    ("us-decades", r"^七、"),
    ("aesthetics", r"^八、"),
    ("more-art", r"^九、"),
]

DECADE_MARKERS = [
    ("us70", r"^（一）\s*1970"),
    ("us80", r"^（二）\s*1980"),
    ("us90", r"^（三）\s*1990"),
    ("us00", r"^（四）\s*2000"),
    ("us10", r"^（五）\s*2010"),
]

ENTRY_RE = re.compile(r"^(\d+)\.\s+(.+)$")
YEAR_LINE_RE = re.compile(r"^\((\d{4})")
BULLET_RE = re.compile(r"^[●•]\s*")

SECTION_BLURBS: dict[str, tuple[str, str, str]] = {
    "cn": ("华语地区", "大陆与港台电视史上具代表性的古典名著、历史巨制与时代剧。", "#b33a2a"),
    "uk": ("英国", "BBC 与 ITV 古典改编、政治讽刺与喜剧标杆。", "#2a5a8a"),
    "jp": ("日本", "日剧黄金时代都市爱情、推理与家庭史诗。", "#a8456e"),
    "euro": ("欧洲与拉美", "德国史诗、意大利犯罪剧与巴西现象级连续剧。", "#a65f18"),
    "us-picks": ("美剧精选", "20 世纪范围内影响力突出的美国剧集精选。", "#5b45a0"),
    "tv-book": ("TV: The Book", "Sepinwall & Seitz 合著评选中的美剧史 TOP 30。", "#9a7a12"),
    "us70": ("1970 年代美剧", "大众电视黄金期与社会共情。", "#1f6f7a"),
    "us80": ("1980 年代美剧", "家庭收视盛世与合家欢狂潮。", "#2f6b45"),
    "us90": ("1990 年代美剧", "全民追剧与公共台全盛期。", "#8a4a12"),
    "us00": ("2000 年代美剧", "网络讨论狂潮与现象级破圈。", "#4a6a8a"),
    "us10": ("2010 年代美剧", "流媒体崛起与全球爆款。", "#6a4a8a"),
    "aesthetics": ("视听美学", "镜头调度、构图与声景艺术向推荐。", "#3d5a40"),
    "more-art": ("艺术向延伸", "21 世纪多部高口碑剧作的补充推荐。", "#4a4a4a"),
}


def pdf_text() -> str:
    if not PDF.is_file():
        sys.exit(f"missing {PDF}")
    out = subprocess.check_output(["pdftotext", "-layout", str(PDF), "-"], text=True)
    return out.replace("\r\n", "\n")


def is_stop_line(line: str) -> bool:
    return line.startswith("十、")


def pick_section(line: str, chapter: str | None) -> str | None:
    if chapter != "us-decades":
        return chapter
    for sec, pat in DECADE_MARKERS:
        if re.match(pat, line.strip()):
            return sec
    return chapter


def parse_year(s: str) -> int | None:
    m = re.search(r"(\d{4})", s)
    return int(m.group(1)) if m else None


def split_title_line(rest: str) -> tuple[str, str, str | None]:
    """Return (search_title, title_zh, year_tail)."""
    rest = rest.strip()
    year_m = re.search(r"\((\d{4}[^)]*)\)\s*$", rest)
    year_part = year_m.group(1) if year_m else None
    head = rest[: year_m.start()].strip() if year_m else rest

    en_m = re.search(r"\(([^()]*[A-Za-z][^()]*)\)\s*$", head)
    if en_m:
        en = en_m.group(1).strip()
        zh = head[: en_m.start()].strip().rstrip("/").strip()
        search = en
    else:
        zh = re.sub(r"\[[^\]]+\]", "", head).strip()
        search = zh.split("/")[0].strip() if zh else head
        en = ""
    if not search:
        search = head
    return search, zh, year_part


@dataclass
class Entry:
    section: str
    position: int
    title_search: str
    title_zh: str
    title_en: str
    year: int
    plot: str = ""
    hook: str = ""
    genres: str = ""
    extra: dict = field(default_factory=dict)


def field_label(line: str) -> tuple[str | None, str]:
    line = BULLET_RE.sub("", line.strip())
    for key, prefixes in (
        ("plot", ("剧情介绍", "剧情梗概", "剧情")),
        (
            "hook",
            (
                "核心看点",
                "影评人核心评价",
                "流行与收视亮点",
                "看点",
                "视听/剧作亮点",
                "视听亮点",
                "视听水准与核心看点",
                "视觉美学与镜头调度",
                "色彩光影与声景设计",
                "画幅转换与视觉符号学",
                "镜头调度与希区柯克式声景",
                "视觉美学与空间调度",
                "自然声景与氛围营造",
                "光影控制与极简声景",
            ),
        ),
        ("genres", ("类型",)),
        ("creators", ("主创", "主创/导演", "主创/编剧", "主创/监制")),
        ("cast", ("主要演员", "主要配音", "主要演员/配音")),
        ("tags", ("视听标签",)),
    ):
        for p in prefixes:
            if line.startswith(p):
                val = line.split("：", 1)[-1].split(":", 1)[-1].strip()
                return key, val
    return None, line


def parse_entries(text: str) -> list[Entry]:
    lines = [ln.rstrip() for ln in text.split("\n")]
    chapter: str | None = None
    section: str | None = None
    entries: list[Entry] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if is_stop_line(line):
            break
        if not line or line == "\f":
            i += 1
            continue

        for sec, pat in CHAPTER_MARKERS:
            if re.match(pat, line):
                chapter = sec
                section = sec
                i += 1
                continue

        if chapter == "us-decades":
            for sec, pat in DECADE_MARKERS:
                if re.match(pat, line):
                    section = sec
                    i += 1
                    break

        em = ENTRY_RE.match(line)
        if not em or not section:
            i += 1
            continue

        position = int(em.group(1))
        rest = em.group(2)
        year_part = None
        if not re.search(r"\(\d{4}", rest):
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                nxt = lines[j].strip()
                if re.match(r"^\(\d{4}", nxt):
                    year_part = nxt.strip("()")
                    rest = f"{rest} ({year_part})"
                    i = j

        title_search, title_zh, year_part = split_title_line(rest)
        year = parse_year(year_part or rest)
        if year is None:
            print(f"warn: no year for #{position} {title_zh or title_search}", file=sys.stderr)
            i += 1
            continue

        i += 1
        fields: dict[str, list[str]] = {k: [] for k in ("plot", "hook", "genres", "creators", "cast", "tags", "other")}
        buf_key: str | None = None
        while i < len(lines):
            raw = lines[i]
            s = raw.strip()
            if not s or s == "\f":
                i += 1
                continue
            if is_stop_line(s):
                break
            if any(re.match(pat, s) for _, pat in CHAPTER_MARKERS):
                break
            if chapter == "us-decades" and any(re.match(pat, s) for _, pat in DECADE_MARKERS):
                break
            if ENTRY_RE.match(s):
                break
            key, val = field_label(s)
            if key:
                buf_key = key
                fields[key].append(val)
            elif buf_key:
                fields[buf_key].append(s)
            i += 1

        plot = "".join(fields["plot"]).strip()
        hook_parts = fields["hook"] or fields["other"]
        hook = "".join(hook_parts).strip()
        if not hook and fields.get("tags"):
            hook = "视听标签：" + "、".join(fields["tags"])

        entries.append(
            Entry(
                section=section,
                position=position,
                title_search=title_search,
                title_zh=title_zh,
                title_en=title_search if re.search(r"[A-Za-z]", title_search) else "",
                year=year,
                plot=plot,
                hook=hook,
                genres="、".join(fields["genres"]),
            )
        )

    return entries


def write_outputs(entries: list[Entry]) -> None:
    seen_sections: list[str] = []
    for e in entries:
        if e.section not in seen_sections:
            seen_sections.append(e.section)

    sections = []
    for ord_i, sid in enumerate(seen_sections):
        name, blurb, color = SECTION_BLURBS.get(sid, (sid, "", "#666666"))
        sections.append({"id": sid, "order": ord_i, "name": name, "blurb": blurb, "color": color})

    meta = {
        "id": "century-tv-20th",
        "title": "20 世纪全球优秀电视剧",
        "kicker": "场刊整理 · 汇总清单",
        "dek": (
            "汇总 20 世纪（及延伸篇章中部分 21 世纪）全球代表性剧集，"
            "按华语、英国、日本、欧美等分区整理，分区内保持原清单顺序。"
            "每部附剧情与看点；条目可与站内其他剧榜重复出现。"
        ),
        "source": {
            "name": "20 世纪全球优秀电视剧汇总清单（场刊整理）",
            "url": "https://playbill.icdp.uk/century-tv-20th/",
        },
        "kind": "tv",
        "order": 12,
        "entries": "century-tv-20th.tsv",
        "sections": sections,
    }
    OUT_JSON.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    global_rank = 0
    tsv_lines = ["rank\ttitle\tyear\tsection\tposition\ttitle_zh"]
    with OUT_CARDS.open("w", encoding="utf-8") as cards:
        for e in entries:
            global_rank += 1
            title = e.title_search.replace("\t", " ")
            zh = e.title_zh.replace("\t", " ")
            tsv_lines.append(f"{global_rank}\t{title}\t{e.year}\t{e.section}\t{e.position}\t{zh}")
            cards.write(
                json.dumps(
                    {
                        "rank": global_rank,
                        "section": e.section,
                        "position": e.position,
                        "title_zh": e.title_zh,
                        "title_search": e.title_search,
                        "year": e.year,
                        "plot": e.plot,
                        "hook": e.hook,
                        "genres": e.genres,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

    OUT_TSV.write_text("\n".join(tsv_lines) + "\n", encoding="utf-8")
    print(f"century-tv-20th: {len(entries)} entries, {len(sections)} sections")


def main() -> None:
    entries = parse_entries(pdf_text())
    if not entries:
        sys.exit("no entries parsed")
    write_outputs(entries)


if __name__ == "__main__":
    main()