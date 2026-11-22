/** Show compact collection title when the page mast scrolls out of view. */
export function initCatalogWayfind() {
  const mast = document.querySelector("header.mast");
  const bar = document.getElementById("catalog-wayfind");
  if (!mast || !bar) return;

  const sync = (visible: boolean) => {
    bar.hidden = !visible;
    document.body.classList.toggle("catalog-wayfind-active", visible);
    if (visible) {
      document.documentElement.style.setProperty("--catalog-wayfind-h", `${bar.offsetHeight}px`);
    }
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      sync(!entry.isIntersecting);
    },
    { root: null, threshold: 0, rootMargin: "-1px 0px 0px 0px" },
  );
  io.observe(mast);
  window.addEventListener("resize", () => {
    if (!bar.hidden) sync(true);
  });
}
