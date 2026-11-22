import {
  SEARCH_TYPE_EN,
  SEARCH_TYPE_ORDER,
  SEARCH_TYPE_ZH,
  searchHitMeta,
  type SearchDocType,
} from "../lib/search-display";

type Hit = {
  type: string;
  href: string;
  titleZh: string;
  titleEn: string;
  subtitle: string;
  tagsLabel: string;
};

type ScoredHit = Hit & { score?: number };

function normalizeQuery(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  const kept = parts.filter((p) => {
    if (/[\u3400-\u9fff]/.test(p)) return p.length >= 1;
    return p.length >= 2;
  });
  return kept.join(" ");
}

async function fetchHits(q: string): Promise<ScoredHit[]> {
  const term = normalizeQuery(q);
  if (!term) return [];
  const url = `/api/search?q=${encodeURIComponent(term)}&limit=24`;
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) throw new Error(String(r.status));
  const data = (await r.json()) as { hits?: ScoredHit[] };
  return data.hits ?? [];
}

function init() {
  const root = document.getElementById("site-search");
  const input = document.getElementById("site-search-input") as HTMLInputElement | null;
  const panel = document.getElementById("site-search-results");
  if (!root || !input || !panel) return;

  function isEn() {
    return document.documentElement.classList.contains("lang-en");
  }

  function syncPlaceholder() {
    input.placeholder = isEn()
      ? (input.dataset.placeholderEn ?? "")
      : (input.dataset.placeholderZh ?? "");
  }
  syncPlaceholder();
  document.addEventListener("playbill-lang", syncPlaceholder);

  function titleOf(h: Hit) {
    return (isEn() ? h.titleEn || h.titleZh : h.titleZh || h.titleEn) || "—";
  }

  function typeLabel(t: string) {
    const key = t as SearchDocType;
    return isEn() ? SEARCH_TYPE_EN[key] ?? t : SEARCH_TYPE_ZH[key] ?? t;
  }

  function groupHits(hits: ScoredHit[]): Map<SearchDocType, ScoredHit[]> {
    const map = new Map<SearchDocType, ScoredHit[]>();
    const seenHref = new Set<string>();
    for (const t of SEARCH_TYPE_ORDER) map.set(t, []);

    for (const h of hits) {
      const type = SEARCH_TYPE_ORDER.includes(h.type as SearchDocType)
        ? (h.type as SearchDocType)
        : "person";
      if (seenHref.has(h.href)) continue;
      seenHref.add(h.href);
      map.get(type)!.push(h);
    }
    return map;
  }

  function render(hits: ScoredHit[]) {
    panel.innerHTML = "";
    if (!hits.length) {
      panel.classList.add("empty");
      panel.innerHTML = `<p class="site-search-empty">${isEn() ? "No matches." : "没有匹配。"}</p>`;
      return;
    }
    panel.classList.remove("empty");

    const grouped = groupHits(hits);
    const perType = 5;
    const frag = document.createDocumentFragment();

    for (const type of SEARCH_TYPE_ORDER) {
      const rows = grouped.get(type)!;
      if (!rows.length) continue;
      const section = document.createElement("section");
      section.className = `site-search-group site-search-group--${type}`;
      section.setAttribute("aria-label", typeLabel(type));

      const head = document.createElement("h3");
      head.className = "site-search-group-title";
      head.textContent = typeLabel(type);
      section.appendChild(head);

      const ul = document.createElement("ul");
      ul.className = "site-search-list";
      for (const h of rows.slice(0, perType)) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = h.href;
        a.className = `site-search-hit site-search-hit--${type}`;
        const meta = escapeHtml(searchHitMeta(h.subtitle ?? "", h.tagsLabel ?? ""));
        a.innerHTML = `<span class="site-search-kind">${escapeHtml(typeLabel(type))}</span>
          <span class="site-search-titles"><strong>${escapeHtml(titleOf(h))}</strong>
          ${meta ? `<span class="site-search-meta">${meta}</span>` : ""}</span>`;
        li.appendChild(a);
        ul.appendChild(li);
      }
      section.appendChild(ul);
      frag.appendChild(section);
    }

    panel.appendChild(frag);
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function close() {
    panel.hidden = true;
    root.classList.remove("open");
  }

  function open() {
    panel.hidden = false;
    root.classList.add("open");
  }

  let searchGen = 0;

  async function search(q: string) {
    const term = normalizeQuery(q);
    if (term.length < 1) {
      panel.hidden = true;
      root.classList.remove("open");
      return;
    }
    const gen = ++searchGen;
    panel.classList.add("empty");
    panel.innerHTML = `<p class="site-search-empty site-search-loading">${isEn() ? "Searching…" : "搜索中…"}</p>`;
    open();
    try {
      const hits = await fetchHits(term);
      if (gen !== searchGen) return;
      render(hits);
      open();
    } catch {
      if (gen !== searchGen) return;
      panel.innerHTML = `<p class="site-search-empty">${isEn() ? "Search unavailable." : "搜索服务未就绪。"}</p>`;
      open();
    }
  }

  let timer = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => search(input.value), 120);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim()) void search(input.value);
  });

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      close();
      input.blur();
    }
  });

  document.addEventListener("click", (ev) => {
    if (!root.contains(ev.target as Node)) close();
  });

  document.addEventListener("keydown", (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
      ev.preventDefault();
      input.focus();
      input.select();
    }
  });
}

init();
