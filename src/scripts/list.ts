function padWidth() {
  const n = Number(document.querySelector("[data-rank-pad]")?.getAttribute("data-rank-pad"));
  return Number.isInteger(n) && n > 0 ? n : 2;
}

const pad = (n: number | string) => String(n).padStart(padWidth(), "0");

type Extras = { plot?: string; plotEn?: string; playbill?: string; playbillEn?: string };

function prefetch(href: string) {
  const url = href.split("#")[0];
  if (!url || url === location.pathname) return;
  if (document.head.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  document.head.appendChild(link);
}

export function initList() {
  // Avoid the browser's native hash scroll — it fights content-visibility estimates.
  if (/^#show-\d+$/.test(location.hash)) {
    history.scrollRestoration = "manual";
  }

  const nav = document.getElementById("nav")!;
  const qEl = document.getElementById("q") as HTMLInputElement;
  const suggest = document.getElementById("suggest")!;
  const status = document.getElementById("status")!;
  const topten = document.getElementById("topten")!;
  const empty = document.getElementById("empty")!;
  const intro = document.getElementById("section-intro");
  const shell = document.querySelector<HTMLElement>(".shell");
  const mainEl = document.getElementById("main");
  const extraSrc = document.getElementById("catalog-extra-src") as HTMLTemplateElement | null;
  let articles = Array.from(document.querySelectorAll<HTMLElement>("article.show"));
  const tagsMode = nav.dataset.mode === "tags";
  const extrasUrl = shell?.dataset.extrasUrl;
  const featuredLimit = Number(shell?.dataset.featuredLimit) || 0;
  const catalogTotal = Number(shell?.dataset.catalogTotal) || 0;
  const catalogToggle = document.getElementById("catalog-toggle");
  const catalogButtons = Array.from(
    catalogToggle?.querySelectorAll<HTMLButtonElement>("button[data-catalog]") ?? [],
  );
  const toptenMore = document.getElementById("topten-more");
  const toptenMoreClosed = toptenMore?.querySelector<HTMLElement>(".when-closed");
  const navButtons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button[data-section]"));
  const tagButtons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button[data-tag]"));
  const clearBtn = document.getElementById("tags-clear") as HTMLButtonElement | null;
  const statusZh = status.querySelector<HTMLElement>(".zh")!;
  const statusEn = status.querySelector<HTMLElement>(".en")!;
  const idleZh = statusZh.textContent ?? "";
  const idleEn = statusEn.textContent ?? "";
  const foundZh = status.dataset.foundZh ?? "找到 {n} 部。";
  const foundEn = status.dataset.foundEn ?? "Found {n}.";
  const noneZh = status.dataset.noneZh ?? "没有匹配。";
  const noneEn = status.dataset.noneEn ?? "No matches.";
  let catalogAll = false;
  let posterIo: IntersectionObserver | null = null;
  let extrasIo: IntersectionObserver | null = null;

  function refreshArticles() {
    articles = Array.from(document.querySelectorAll<HTMLElement>("article.show"));
  }

  function observeNewPosters(root: ParentNode = document) {
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>(".poster img[data-src]"));
    if (!imgs.length) return;
    if (posterIo) imgs.forEach((img) => posterIo!.observe(img));
    else imgs.forEach((img) => {
      if (!img.dataset.src) return;
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
  }

  function observeNewExtras(root: ParentNode = document) {
    if (!extrasUrl) return;
    const hosts = Array.from(root.querySelectorAll<HTMLElement>(".copy[data-extras-for]"));
    if (!hosts.length) return;
    if (extrasIo) hosts.forEach((el) => extrasIo!.observe(el));
  }

  /** Move deferred nominees out of <template> into the live list (or back). */
  function mountCatalogExtras() {
    if (!extraSrc?.content.childNodes.length || !mainEl) return;
    const frag = extraSrc.content;
    mainEl.append(frag);
    refreshArticles();
    observeNewPosters(mainEl);
    observeNewExtras(mainEl);
  }

  function unmountCatalogExtras() {
    if (!extraSrc || !mainEl) return;
    const extras = mainEl.querySelectorAll("article.show.catalog-extra");
    if (!extras.length) return;
    for (const a of extras) extraSrc.content.append(a);
    refreshArticles();
  }

  const sectionMeta = new Map(
    navButtons
      .filter((b) => b.dataset.section && b.dataset.section !== "all")
      .map((b) => [
        b.dataset.section!,
        {
          nameZh: b.dataset.nameZh ?? "",
          nameEn: b.dataset.nameEn ?? "",
          blurbZh: b.dataset.blurbZh ?? "",
          blurbEn: b.dataset.blurbEn ?? "",
          color: b.style.getPropertyValue("--sec"),
          count: b.querySelector("em")?.textContent ?? "",
        },
      ]),
  );

  const lang = () => (document.documentElement.classList.contains("lang-en") ? "en" : "zh");

  let active = -1;
  let matches: HTMLElement[] = [];
  let sectionFilter = "all";
  let searchQ = "";
  const selectedTags = new Set<string>();

  function setCurrent(id: string) {
    navButtons.forEach((b) =>
      b.dataset.section === id ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"),
    );
  }

  function showIntro(id: string) {
    if (!intro || tagsMode) return;
    const meta = sectionMeta.get(id);
    if (!meta || id === "all") {
      intro.hidden = true;
      return;
    }
    intro.hidden = false;
    intro.style.setProperty("--sec", meta.color);
    const zh = intro.querySelector<HTMLElement>("[data-zh]");
    const en = intro.querySelector<HTMLElement>("[data-en]");
    const count = intro.querySelector<HTMLElement>("[data-count]");
    const blurbZh = intro.querySelector<HTMLElement>("[data-blurb-zh]");
    const blurbEn = intro.querySelector<HTMLElement>("[data-blurb-en]");
    if (zh) zh.textContent = meta.nameZh;
    if (en) en.textContent = meta.nameEn;
    if (count) count.textContent = meta.count;
    if (blurbZh) blurbZh.textContent = meta.blurbZh;
    if (blurbEn) blurbEn.textContent = meta.blurbEn;
    const blurb = intro.querySelector<HTMLElement>(".blurb");
    if (blurb) blurb.hidden = !(meta.blurbZh || meta.blurbEn);
  }

  function articleTags(a: HTMLElement): string[] {
    return (a.dataset.tags || "").split(/\s+/).filter(Boolean);
  }

  function articleRank(a: HTMLElement): number {
    return Number(a.dataset.rank) || 0;
  }

  function inCatalogScope(a: HTMLElement): boolean {
    if (!featuredLimit || catalogAll) return true;
    return articleRank(a) <= featuredLimit;
  }

  function setCatalog(all: boolean) {
    if (!featuredLimit) return;
    const was = catalogAll;
    catalogAll = all;
    shell?.setAttribute("data-catalog", all ? "all" : "featured");
    catalogButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String((b.dataset.catalog === "all") === all)),
    );
    if (all && !was) mountCatalogExtras();
    else if (!all && was) unmountCatalogExtras();
    if (toptenMoreClosed) {
      const n = all ? catalogTotal || articles.length : featuredLimit;
      const zh = toptenMoreClosed.querySelector(".zh");
      const en = toptenMoreClosed.querySelector(".en");
      if (zh) zh.textContent = `全部 ${n}`;
      if (en) en.textContent = `All ${n}`;
    }
  }

  function matchesTags(a: HTMLElement): boolean {
    if (!selectedTags.size) return true;
    const tags = new Set(articleTags(a));
    const byGroup = new Map<string, string[]>();
    for (const id of selectedTags) {
      const group = id.split(":")[0];
      const list = byGroup.get(group) ?? [];
      list.push(id);
      byGroup.set(group, list);
    }
    for (const ids of byGroup.values()) {
      if (!ids.some((id) => tags.has(id))) return false;
    }
    return true;
  }

  function updateTagChrome() {
    if (!tagsMode) return;
    tagButtons.forEach((b) => b.setAttribute("aria-pressed", String(selectedTags.has(b.dataset.tag!))));
    if (clearBtn) clearBtn.hidden = selectedTags.size === 0;

    // Live counts: for each tag, count articles that would match if that tag were selected
    // with the other current selections (excluding its own group for OR within group).
    for (const btn of tagButtons) {
      const tagId = btn.dataset.tag!;
      const group = btn.dataset.group!;
      const probe = new Set([...selectedTags].filter((id) => !id.startsWith(group + ":")));
      probe.add(tagId);
      const byGroup = new Map<string, string[]>();
      for (const id of probe) {
        const g = id.split(":")[0];
        const list = byGroup.get(g) ?? [];
        list.push(id);
        byGroup.set(g, list);
      }
      let n = 0;
      for (const a of articles) {
        if (!inCatalogScope(a)) continue;
        if (searchQ) {
          const rank = a.dataset.rank!;
          if (!(a.dataset.blob!.includes(searchQ) || rank === searchQ || pad(rank) === searchQ)) continue;
        }
        const tags = new Set(articleTags(a));
        let ok = true;
        for (const ids of byGroup.values()) {
          if (!ids.some((id) => tags.has(id))) {
            ok = false;
            break;
          }
        }
        if (ok) n++;
      }
      const em = btn.querySelector<HTMLElement>("[data-count]");
      if (em) em.textContent = String(n);
      btn.disabled = n === 0 && !selectedTags.has(tagId);
    }
  }

  let locateHoldUntil = 0;
  let locatedWatch: IntersectionObserver | null = null;
  let locateTarget: HTMLElement | null = null;

  function clearLocated() {
    articles.forEach((a) => a.classList.remove("located"));
    locateTarget = null;
  }

  function watchLocated(el: HTMLElement) {
    locatedWatch?.disconnect();
    if (!("IntersectionObserver" in window)) return;
    locatedWatch = new IntersectionObserver(
      (entries) => {
        if (Date.now() < locateHoldUntil) return;
        for (const en of entries) {
          if (!en.isIntersecting && en.target.classList.contains("located")) {
            en.target.classList.remove("located");
            if (locateTarget === en.target) locateTarget = null;
          }
        }
      },
      // Clear only once the article has left a generous band around the viewport.
      { rootMargin: "240px 0px 240px 0px", threshold: 0 },
    );
    locatedWatch.observe(el);
  }

  /** Reveal nearby rows so content-visibility estimates don't throw off scroll. */
  function revealAround(el: HTMLElement, before = 40, after = 2) {
    const idx = articles.indexOf(el);
    if (idx < 0) return;
    const from = Math.max(0, idx - before);
    const to = Math.min(articles.length - 1, idx + after);
    for (let i = from; i <= to; i++) {
      if (articles[i].hidden) continue;
      articles[i].style.contentVisibility = "visible";
    }
    el.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
      img.src = img.dataset.src!;
      img.removeAttribute("data-src");
    });
    // Force layout so subsequent scroll math uses real heights, not estimates.
    void articles[to]?.offsetTop;
  }

  /** Expand 100→400 catalog when the target rank sits outside the featured set. */
  function ensureCatalogForRank(rank: number): boolean {
    if (!featuredLimit || catalogAll || rank <= featuredLimit) return false;
    setCatalog(true);
    return true;
  }

  /** Pin article top under the sticky finder (respects scroll-margin-top). */
  function alignLocated(el: HTMLElement) {
    el.scrollIntoView({ behavior: "auto", block: "start" });
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const top = el.getBoundingClientRect().top;
    const drift = top - margin;
    if (Math.abs(drift) > 2) window.scrollBy(0, drift);
  }

  function resettleLocated(el: HTMLElement = locateTarget!) {
    if (!el || !el.classList.contains("located")) return;
    revealAround(el);
    alignLocated(el);
  }

  /** Highlight a show without scrolling (e.g. user clicked it while browsing). */
  function markLocated(el: HTMLElement) {
    clearLocated();
    locateTarget = el;
    el.classList.add("located");
    if (!tagsMode) setCurrent(sectionFilter === "all" ? el.dataset.section! : sectionFilter);
    revealAround(el, 2, 2);
    watchLocated(el);
  }

  /** Jump to a show and highlight it (search / 原榜 / deep link). */
  function locate(el: HTMLElement) {
    // content-visibility:auto uses ~480px estimates; long jumps overshoot unless
    // everything above the target is forced to lay out first.
    locateHoldUntil = Date.now() + 1600;
    articles.forEach((a) => a.classList.remove("located"));
    locateTarget = el;
    el.classList.add("located");
    if (!tagsMode) setCurrent(sectionFilter === "all" ? el.dataset.section! : sectionFilter);
    revealAround(el, articles.length, 3);
    alignLocated(el);
    watchLocated(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resettleLocated(el));
    });
    window.setTimeout(() => resettleLocated(el), 80);
    window.setTimeout(() => resettleLocated(el), 320);
    window.setTimeout(() => resettleLocated(el), 700);
  }

  function markText(text: string, q: string) {
    const frag = document.createDocumentFragment();
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    let i = 0;
    while (i < text.length) {
      const j = ql ? lower.indexOf(ql, i) : -1;
      if (j < 0) {
        frag.append(text.slice(i));
        break;
      }
      if (j > i) frag.append(text.slice(i, j));
      const m = document.createElement("mark");
      m.textContent = text.slice(j, j + q.length);
      frag.append(m);
      i = j + q.length;
    }
    return frag;
  }

  function closeSuggest() {
    suggest.classList.remove("open");
  }

  function apply(raw: string) {
    searchQ = raw.trim().toLowerCase();
    closeSuggest();
    suggest.textContent = "";
    active = -1;
    // Searching a nominee outside the featured 100 auto-opens the full catalog.
    if (featuredLimit && searchQ && !catalogAll) {
      const matchBlob = (a: HTMLElement) => {
        const rank = a.dataset.rank!;
        return a.dataset.blob!.includes(searchQ) || rank === searchQ || pad(rank) === searchQ;
      };
      const deferred = extraSrc
        ? Array.from(extraSrc.content.querySelectorAll<HTMLElement>("article.show"))
        : [];
      if (deferred.some(matchBlob)) setCatalog(true);
    }
    matches = articles.filter((a) => {
      const rank = a.dataset.rank!;
      const inSection = tagsMode || sectionFilter === "all" || a.dataset.section === sectionFilter;
      const inTags = !tagsMode || matchesTags(a);
      const searchHit =
        !searchQ || a.dataset.blob!.includes(searchQ) || rank === searchQ || pad(rank) === searchQ;
      const ok = inCatalogScope(a) && inSection && inTags && searchHit;
      a.hidden = !ok;
      return ok;
    });
    const facetActive = tagsMode ? selectedTags.size > 0 : sectionFilter !== "all";
    topten.hidden = !!searchQ || facetActive;
    empty.hidden = !((searchQ || facetActive) && matches.length === 0);
    if (!tagsMode) showIntro(sectionFilter);
    updateTagChrome();
    if (!searchQ && !facetActive) {
      statusZh.textContent = idleZh;
      statusEn.textContent = idleEn;
      return;
    }
    if (!searchQ && facetActive) {
      statusZh.textContent = foundZh.replace("{n}", String(matches.length));
      statusEn.textContent = foundEn.replace("{n}", String(matches.length));
      return;
    }
    const nFound = String(matches.length);
    statusZh.textContent = matches.length ? foundZh.replace("{n}", nFound) : noneZh;
    statusEn.textContent = matches.length ? foundEn.replace("{n}", nFound) : noneEn;
    const en = lang() === "en";
    matches.slice(0, 8).forEach((a, i) => {
      const meta = sectionMeta.get(a.dataset.section!) ?? {
        nameZh: "",
        nameEn: "",
        color: a.style.getPropertyValue("--sec"),
      };
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.style.setProperty("--sec", meta.color);
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = pad(a.dataset.rank!);
      const title = document.createElement("span");
      const label = en
        ? a.dataset.en || a.dataset.zh || ""
        : `${a.dataset.zh ?? ""}${a.dataset.en ? `  ${a.dataset.en}` : ""}`;
      title.append(markText(label, raw.trim()));
      const small = document.createElement("small");
      small.textContent = en ? meta.nameEn : meta.nameZh;
      btn.append(n, title, small);
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(i);
      });
      suggest.append(btn);
    });
    if (matches.length) suggest.classList.add("open");
  }

  function choose(i: number) {
    const a = matches[i];
    if (!a) return;
    closeSuggest();
    locate(a);
  }

  function move(delta: number) {
    const buttons = suggest.querySelectorAll<HTMLButtonElement>("button");
    if (!buttons.length) return;
    active = (active + delta + buttons.length) % buttons.length;
    buttons.forEach((b, i) => b.classList.toggle("active", i === active));
    buttons[active].scrollIntoView({ block: "nearest" });
  }

  function resetSearch() {
    if (qEl.value) {
      qEl.value = "";
      apply("");
    } else {
      apply("");
    }
  }

  navButtons.forEach((b) =>
    b.addEventListener("click", () => {
      sectionFilter = b.dataset.section ?? "all";
      setCurrent(sectionFilter === "all" ? "all" : sectionFilter);
      articles.forEach((a) => a.classList.remove("located"));
      resetSearch();
      // Scroll to the filtered list without the locate highlight (that is for search / 原榜 jumps).
      if (sectionFilter !== "all" && intro && !intro.hidden) {
        intro.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }),
  );

  tagButtons.forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.tag!;
      if (selectedTags.has(id)) selectedTags.delete(id);
      else selectedTags.add(id);
      articles.forEach((a) => a.classList.remove("located"));
      apply(qEl.value);
    }),
  );

  clearBtn?.addEventListener("click", () => {
    selectedTags.clear();
    articles.forEach((a) => a.classList.remove("located"));
    apply(qEl.value);
  });

  topten.querySelectorAll<HTMLAnchorElement>("a[data-rank]").forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const rank = Number(link.dataset.rank) || 0;
      let refreshed = false;
      if (!tagsMode && sectionFilter !== "all") {
        sectionFilter = "all";
        setCurrent("all");
        refreshed = true;
      }
      if (ensureCatalogForRank(rank)) refreshed = true;
      if (refreshed) apply(qEl.value);
      const el = document.getElementById(`show-${rank}`);
      if (el) locate(el);
    }),
  );

  catalogButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      setCatalog(btn.dataset.catalog === "all");
      articles.forEach((a) => a.classList.remove("located"));
      apply(qEl.value);
    }),
  );

  // Featured catalogs keep nominees in <template> until opened; deep links mount them.
  const bootHash = location.hash.match(/^#show-(\d+)$/);
  const bootRank = bootHash ? Number(bootHash[1]) : 0;
  if (featuredLimit) {
    setCatalog(bootRank > featuredLimit);
    // CSS/template already scopes the list — avoid thrashing 300 nodes via apply("").
    if (bootRank > featuredLimit) updateTagChrome();
  }

  const more = document.getElementById("topten-more");
  more?.addEventListener("click", () => {
    const open = topten.classList.toggle("open");
    more.setAttribute("aria-expanded", String(open));
  });

  const loadPoster = (img: HTMLImageElement) => {
    if (!img.dataset.src) return;
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  };
  if ("IntersectionObserver" in window) {
    posterIo = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const img = en.target as HTMLImageElement;
          loadPoster(img);
          posterIo?.unobserve(img);
        }
      },
      { rootMargin: "600px 0px" },
    );
  }
  observeNewPosters();

  const dialog = document.getElementById("poster-view") as HTMLDialogElement | null;
  const viewImg = dialog?.querySelector("img");
  const viewCap = dialog?.querySelector(".cap");
  dialog?.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  document.querySelectorAll<HTMLButtonElement>("button.poster").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!dialog || !viewImg || !viewCap) return;
      const img = btn.querySelector("img");
      const src = img?.getAttribute("src") || img?.dataset.src;
      if (!src || !img) return;
      loadPoster(img);
      const article = btn.closest("article");
      const en = lang() === "en";
      viewImg.src = src;
      viewImg.alt = img.alt;
      dialog.dataset.zh = article?.dataset.zh ?? "";
      dialog.dataset.en = article?.dataset.en ?? "";
      dialog.dataset.rank = article?.dataset.rank ?? "";
      viewCap.textContent = en ? dialog.dataset.en || dialog.dataset.zh : dialog.dataset.zh;
      dialog.showModal();
    });
  });

  const backTop = document.getElementById("back-top") as HTMLButtonElement | null;
  const mast = document.querySelector<HTMLElement>("header.mast");
  if (backTop) {
    backTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      qEl.blur();
    });
    if (mast && "IntersectionObserver" in window) {
      const topWatch = new IntersectionObserver(
        ([en]) => {
          backTop.hidden = en.isIntersecting;
        },
        { threshold: 0 },
      );
      topWatch.observe(mast);
    } else {
      const syncTop = () => {
        backTop.hidden = window.scrollY < 240;
      };
      syncTop();
      window.addEventListener("scroll", syncTop, { passive: true });
    }
  }

  qEl.addEventListener("input", () => apply(qEl.value));
  qEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active >= 0 ? active : 0);
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  });
  document.addEventListener("click", (e) => {
    if (!suggest.contains(e.target as Node) && e.target !== qEl) closeSuggest();
  });

  // Clicking another film on the page moves the locate highlight (without re-scrolling).
  document.addEventListener("click", (e) => {
    const t = e.target as Element | null;
    if (!t) return;
    // Poster lightbox / person links handle their own actions.
    if (t.closest("button.poster, a.person-link, a[href*='/people/'], #poster-view")) return;
    const art = t.closest("article.show");
    if (!(art instanceof HTMLElement) || !articles.includes(art)) return;
    if (art.classList.contains("located")) return;
    markLocated(art);
  });

  if (!tagsMode) {
    const spy = new IntersectionObserver(
      (entries) => {
        if (sectionFilter !== "all" || searchQ) return;
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrent((visible.target as HTMLElement).dataset.section!);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.3] },
    );
    articles.forEach((a) => spy.observe(a));
    if (navButtons.some((b) => b.dataset.section === "all")) setCurrent("all");
    else if (articles[0]?.dataset.section) setCurrent(articles[0].dataset.section);
  } else {
    updateTagChrome();
  }

  const labelPosters = () => {
    document.querySelectorAll<HTMLButtonElement>("button.poster").forEach((btn) => {
      const img = btn.querySelector("img");
      if (img?.alt) btn.setAttribute("aria-label", img.alt);
    });
  };
  labelPosters();

  document.addEventListener("playbill-lang", () => {
    labelPosters();
    if (qEl.value.trim() || selectedTags.size) apply(qEl.value);
    if (dialog?.open && viewImg && viewCap) {
      const en = lang() === "en";
      viewCap.textContent = en ? dialog.dataset.en || dialog.dataset.zh || "" : dialog.dataset.zh || "";
      const article = document.getElementById(`show-${dialog.dataset.rank ?? ""}`);
      const img = article?.querySelector(".poster img");
      if (img) viewImg.alt = img.getAttribute("alt") ?? "";
    }
  });

  // Prefetch person pages (and film list targets) on intent — huge Criterion HTML benefits.
  document.addEventListener(
    "pointerdown",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[data-prefetch], a.person-link, a.person-collab-link");
      if (a instanceof HTMLAnchorElement) prefetch(a.href);
    },
    { capture: true },
  );

  // Lazy-load plot/场刊 for Criterion so the list HTML stays lean.
  let extrasPromise: Promise<Record<string, Extras>> | null = null;
  const loadExtras = () => {
    if (!extrasUrl) return Promise.resolve({} as Record<string, Extras>);
    extrasPromise ??= fetch(extrasUrl)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    return extrasPromise;
  };

  const labeledBlock = (className: string, zhLab: string, enLab: string, zh?: string, en?: string) => {
    const p = document.createElement("p");
    p.className = className;
    const lab = document.createElement("span");
    lab.className = "lab";
    const lz = document.createElement("span");
    lz.className = "zh";
    lz.textContent = zhLab;
    const le = document.createElement("span");
    le.className = "en";
    le.textContent = enLab;
    lab.append(lz, le);
    const body = document.createElement("span");
    if (zh) {
      const s = document.createElement("span");
      s.className = "zh";
      s.textContent = zh;
      body.append(s);
    }
    if (en) {
      const s = document.createElement("span");
      s.className = "en";
      s.textContent = en;
      body.append(s);
    }
    p.append(lab, body);
    return p;
  };

  const fillExtras = (host: HTMLElement, row: Extras) => {
    if (host.dataset.extrasDone) return;
    host.dataset.extrasDone = "1";
    const frag = document.createDocumentFragment();
    if (row.plot || row.plotEn) frag.append(labeledBlock("plot", "剧情", "Plot", row.plot, row.plotEn));
    if (row.playbill || row.playbillEn) {
      frag.append(labeledBlock("playbill", "场刊", "Playbill", row.playbill, row.playbillEn));
    }
    const hook = host.querySelector(".hook");
    if (hook) host.insertBefore(frag, hook);
    else host.append(frag);
    const art = host.closest<HTMLElement>("article.show");
    if (art && art === locateTarget) {
      locateHoldUntil = Date.now() + 800;
      requestAnimationFrame(() => resettleLocated(art));
    }
  };

  if (extrasUrl) {
    const hydrate = (el: HTMLElement) => {
      const host = el.matches(".copy[data-extras-for]")
        ? el
        : el.querySelector<HTMLElement>(".copy[data-extras-for]");
      if (!host || host.dataset.extrasDone) return;
      const rank = host.dataset.extrasFor!;
      void loadExtras().then((map) => {
        const row = map[rank];
        if (row) fillExtras(host, row);
        else host.dataset.extrasDone = "1";
      });
    };
    if ("IntersectionObserver" in window) {
      extrasIo = new IntersectionObserver(
        (entries) => {
          for (const en of entries) {
            if (!en.isIntersecting) continue;
            hydrate(en.target as HTMLElement);
            extrasIo?.unobserve(en.target);
          }
        },
        { rootMargin: "800px 0px" },
      );
      observeNewExtras();
    } else {
      void loadExtras().then((map) => {
        document.querySelectorAll<HTMLElement>(".copy[data-extras-for]").forEach((host) => {
          const row = map[host.dataset.extrasFor!];
          if (row) fillExtras(host, row);
          else host.dataset.extrasDone = "1";
        });
      });
    }
  }

  // Deep links: /list/#show-12 (catalog already opened above when rank > featuredLimit)
  if (bootHash) {
    const el = document.getElementById(`show-${bootHash[1]}`);
    if (el && !el.hidden) {
      // Cancel any native hash scroll that already jumped with bad estimates.
      window.scrollTo(0, 0);
      locate(el);
      if (extrasUrl) {
        const host = el.querySelector<HTMLElement>(".copy[data-extras-for]");
        if (host) {
          void loadExtras().then((map) => {
            const row = map[host.dataset.extrasFor!];
            if (row) fillExtras(host, row);
            else host.dataset.extrasDone = "1";
            resettleLocated(el);
          });
        }
      }
    }
  }
}
