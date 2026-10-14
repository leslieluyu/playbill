const pad = (n: number | string) => String(n).padStart(2, "0");

export function initList() {
  const nav = document.getElementById("nav")!;
  const qEl = document.getElementById("q") as HTMLInputElement;
  const suggest = document.getElementById("suggest")!;
  const status = document.getElementById("status")!;
  const topten = document.getElementById("topten")!;
  const empty = document.getElementById("empty")!;
  const intro = document.getElementById("section-intro");
  const articles = Array.from(document.querySelectorAll<HTMLElement>("article.show"));
  const navButtons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button"));
  const statusZh = status.querySelector<HTMLElement>(".zh")!;
  const statusEn = status.querySelector<HTMLElement>(".en")!;
  const idleZh = statusZh.textContent ?? "";
  const idleEn = statusEn.textContent ?? "";
  const foundZh = status.dataset.foundZh ?? "找到 {n} 部。";
  const foundEn = status.dataset.foundEn ?? "Found {n}.";
  const noneZh = status.dataset.noneZh ?? "没有匹配。";
  const noneEn = status.dataset.noneEn ?? "No matches.";

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

  function setCurrent(id: string) {
    navButtons.forEach((b) =>
      b.dataset.section === id ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"),
    );
  }

  function showIntro(id: string) {
    if (!intro) return;
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

  function locate(el: HTMLElement) {
    articles.forEach((a) => a.classList.remove("located"));
    el.classList.add("located");
    setCurrent(sectionFilter === "all" ? el.dataset.section! : sectionFilter);

    // content-visibility:auto uses estimated heights; reveal rows before measuring scroll.
    const idx = articles.indexOf(el);
    for (let i = 0; i <= Math.max(idx, 0); i++) {
      articles[i].style.contentVisibility = "visible";
    }
    el.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
      img.src = img.dataset.src!;
      img.removeAttribute("data-src");
    });
    void el.offsetTop;

    el.scrollIntoView({ behavior: "smooth", block: "start" });
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
    matches = articles.filter((a) => {
      const rank = a.dataset.rank!;
      const inSection = sectionFilter === "all" || a.dataset.section === sectionFilter;
      const ok =
        inSection &&
        (!searchQ || a.dataset.blob!.includes(searchQ) || rank === searchQ || pad(rank) === searchQ);
      a.hidden = !ok;
      return ok;
    });
    topten.hidden = !!searchQ || sectionFilter !== "all";
    empty.hidden = !(searchQ && matches.length === 0);
    showIntro(sectionFilter);
    if (!searchQ) {
      statusZh.textContent = idleZh;
      statusEn.textContent = idleEn;
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

  topten.querySelectorAll<HTMLAnchorElement>("a[data-rank]").forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (sectionFilter !== "all") {
        sectionFilter = "all";
        setCurrent("all");
        apply(qEl.value);
      }
      const el = document.getElementById(`show-${link.dataset.rank}`);
      if (el) locate(el);
    }),
  );

  const more = document.getElementById("topten-more");
  more?.addEventListener("click", () => {
    const open = topten.classList.toggle("open");
    more.setAttribute("aria-expanded", String(open));
  });

  const posterImgs = Array.from(document.querySelectorAll<HTMLImageElement>(".poster img[data-src]"));
  const loadPoster = (img: HTMLImageElement) => {
    if (!img.dataset.src) return;
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  };
  if (posterImgs.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const img = en.target as HTMLImageElement;
          loadPoster(img);
          io.unobserve(img);
        }
      },
      { rootMargin: "600px 0px" },
    );
    posterImgs.forEach((img) => io.observe(img));
  } else {
    posterImgs.forEach(loadPoster);
  }

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

  const labelPosters = () => {
    document.querySelectorAll<HTMLButtonElement>("button.poster").forEach((btn) => {
      const img = btn.querySelector("img");
      if (img?.alt) btn.setAttribute("aria-label", img.alt);
    });
  };
  labelPosters();

  document.addEventListener("playbill-lang", () => {
    labelPosters();
    if (qEl.value.trim()) apply(qEl.value);
    if (dialog?.open && viewImg && viewCap) {
      const en = lang() === "en";
      viewCap.textContent = en ? dialog.dataset.en || dialog.dataset.zh || "" : dialog.dataset.zh || "";
      const article = document.getElementById(`show-${dialog.dataset.rank ?? ""}`);
      const img = article?.querySelector(".poster img");
      if (img) viewImg.alt = img.getAttribute("alt") ?? "";
    }
  });

  // Deep links: /list/#show-12
  const hash = location.hash.match(/^#show-(\d+)$/);
  if (hash) {
    const el = document.getElementById(`show-${hash[1]}`);
    if (el) locate(el);
  }
}
