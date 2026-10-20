/** Client-side filters for /great-directors/ director & film grids. */
export function initGdFilters() {
  const grid = document.getElementById("gd-grid");
  const countEl = document.getElementById("gd-count");
  const emptyEl = document.getElementById("gd-empty");
  const search = document.getElementById("gd-search") as HTMLInputElement | null;
  if (!grid || !countEl || !search) return;

  let activeCountry = "";
  let activeStyle = "";
  const activeTags = new Set<string>();

  function syncPlaceholder() {
    const en = document.documentElement.classList.contains("lang-en");
    search.placeholder = en ? search.dataset.placeholderEn ?? "" : search.dataset.placeholderZh ?? "";
  }
  syncPlaceholder();
  document.addEventListener("langchange", syncPlaceholder);

  function tileMatches(el: Element) {
    const q = (search.value ?? "").trim().toLowerCase();
    if (q && !(el.getAttribute("data-search") ?? "").includes(q)) return false;
    if (activeCountry) {
      const cs = el.getAttribute("data-countries") ?? "";
      if (!cs.split("|").filter(Boolean).includes(activeCountry)) return false;
    }
    if (activeStyle) {
      const st = el.getAttribute("data-style") ?? "";
      if (!st.split("|").filter(Boolean).includes(activeStyle)) return false;
    }
    for (const tag of activeTags) {
      const pool = [
        el.getAttribute("data-master") ?? "",
        el.getAttribute("data-chart") ?? "",
      ].join("|");
      if (!pool.split("|").filter(Boolean).includes(tag)) return false;
    }
    return true;
  }

  function apply() {
    let n = 0;
    for (const el of grid.querySelectorAll(".gd-tile")) {
      const ok = tileMatches(el);
      el.classList.toggle("hidden", !ok);
      if (ok) n++;
    }
    const en = document.documentElement.classList.contains("lang-en");
    const unit = en ? countEl.dataset.unitEn ?? "results" : countEl.dataset.unitZh ?? "条";
    countEl.textContent = en ? `${n} ${unit}` : `${n} ${unit}`;
    emptyEl?.classList.toggle("hidden", n > 0);
  }

  search.addEventListener("input", apply);

  document.querySelectorAll(".gd-tags").forEach((ul) => {
    const kind = ul.getAttribute("data-gd-filter");
    ul.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button.gd-tag");
      if (!btn || btn.hasAttribute("disabled")) return;
      const val = btn.getAttribute("data-value") ?? "";

      if (kind === "country") {
        activeCountry = val;
        ul.querySelectorAll(".gd-tag").forEach((b) => b.classList.toggle("active", b === btn));
      } else if (kind === "style") {
        if (val === "" || val === activeStyle) {
          activeStyle = "";
          ul.querySelectorAll(".gd-tag").forEach((b) =>
            b.classList.toggle("active", (b.getAttribute("data-value") ?? "") === ""),
          );
        } else {
          activeStyle = val;
          ul.querySelectorAll(".gd-tag").forEach((b) => b.classList.toggle("active", b === btn));
        }
      } else {
        if (activeTags.has(val)) {
          activeTags.delete(val);
          btn.classList.remove("active");
        } else {
          activeTags.add(val);
          btn.classList.add("active");
        }
      }
      apply();
    });
  });

  apply();

  grid.addEventListener("click", (ev) => {
    const span = (ev.target as HTMLElement).closest(".gd-tile-director");
    if (!span) return;
    const href = span.getAttribute("data-href");
    if (href) {
      ev.preventDefault();
      ev.stopPropagation();
      window.location.href = href;
    }
  });
}

initGdFilters();
