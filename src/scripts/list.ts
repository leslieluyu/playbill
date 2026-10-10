const pad = (n: number | string) => String(n).padStart(2, "0");

export function initList() {
  const nav = document.getElementById("nav")!;
  const qEl = document.getElementById("q") as HTMLInputElement;
  const suggest = document.getElementById("suggest")!;
  const status = document.getElementById("status")!;
  const topten = document.getElementById("topten")!;
  const empty = document.getElementById("empty")!;
  const articles = Array.from(document.querySelectorAll<HTMLElement>("article.show"));
  const sections = Array.from(document.querySelectorAll<HTMLElement>("section.list-section"));
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
    sections.map((s) => [
      s.dataset.section!,
      {
        nameZh: s.dataset.nameZh ?? "",
        nameEn: s.dataset.nameEn ?? "",
        color: s.style.getPropertyValue("--sec"),
      },
    ]),
  );

  const lang = () => (document.documentElement.classList.contains("lang-en") ? "en" : "zh");

  let active = -1;
  let matches: HTMLElement[] = [];

  function setCurrent(id: string) {
    navButtons.forEach((b) =>
      b.dataset.section === id ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"),
    );
  }

  function locate(el: HTMLElement) {
    articles.forEach((a) => a.classList.remove("located"));
    el.classList.add("located");
    setCurrent(el.dataset.section!);
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
    const q = raw.trim().toLowerCase();
    closeSuggest();
    suggest.textContent = "";
    active = -1;
    matches = articles.filter((a) => {
      const rank = a.dataset.rank!;
      const ok = !q || a.dataset.blob!.includes(q) || rank === q || pad(rank) === q;
      a.hidden = !ok;
      return ok;
    });
    sections.forEach((s) => {
      s.hidden = !s.querySelector("article.show:not([hidden])");
    });
    topten.hidden = !!q;
    empty.hidden = !(q && matches.length === 0);
    if (!q) {
      statusZh.textContent = idleZh;
      statusEn.textContent = idleEn;
      return;
    }
    const nFound = String(matches.length);
    statusZh.textContent = matches.length ? foundZh.replace("{n}", nFound) : noneZh;
    statusEn.textContent = matches.length ? foundEn.replace("{n}", nFound) : noneEn;
    const en = lang() === "en";
    matches.slice(0, 8).forEach((a, i) => {
      const meta = sectionMeta.get(a.dataset.section!)!;
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

  function reset() {
    if (qEl.value) {
      qEl.value = "";
      apply("");
    }
  }

  navButtons.forEach((b) =>
    b.addEventListener("click", () => {
      reset();
      document.getElementById(`section-${b.dataset.section}`)!.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrent(b.dataset.section!);
    }),
  );

  topten.querySelectorAll<HTMLAnchorElement>("a[data-rank]").forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const el = document.getElementById(`show-${link.dataset.rank}`);
      if (el) locate(el);
    }),
  );

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
      const visible = entries
        .filter((en) => en.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setCurrent((visible.target as HTMLElement).dataset.section!);
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.3] },
  );
  sections.forEach((s) => spy.observe(s));
  if (sections[0]) setCurrent(sections[0].dataset.section!);

  document.addEventListener("playbill-lang", () => {
    if (qEl.value.trim()) apply(qEl.value);
  });
}
