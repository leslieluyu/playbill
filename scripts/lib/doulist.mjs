export function parseComment(comment) {
  let missing = /暂缺/.test(comment);
  const m = comment.match(/第(\d+)回[（(](\d{4})年度[）)]\s*(.+?)\s*(\d+)/);
  if (!m) return { raw: comment, edition: null, kjYear: null, chartLabel: null, position: null, missing, chart: "other" };
  const chartLabel = m[3].trim();
  let chart = "other";
  if (/艺术性/.test(chartLabel)) chart = "art";
  else if (/娱乐性/.test(chartLabel)) chart = "ent";
  else if (/日本/.test(chartLabel)) chart = "jp";
  else if (/外国/.test(chartLabel)) chart = "foreign";
  return {
    raw: comment,
    edition: Number(m[1]),
    kjYear: Number(m[2]),
    chartLabel,
    chart,
    position: Number(m[4]),
    missing,
  };
}

export function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseDoulistItems(html) {
  const items = [];
  const blocks = html.split(/class="doulist-item"/).slice(1);
  for (const block of blocks) {
    const doubanM = block.match(/subject\/(\d+)/);
    if (!doubanM) continue;
    const doubanId = doubanM[1];
    const titleM = block.match(/class="title"\s*>\s*<a[^>]*>([\s\S]*?)<\/a>/);
    const title = titleM ? decodeHtml(titleM[1].replace(/<[^>]+>/g, "").trim()) : "";
    const commentM = block.match(/class="comment"\s*>\s*([\s\S]*?)<\/div>/);
    let comment = commentM ? decodeHtml(commentM[1].replace(/<[^>]+>/g, "").trim()) : "";
    comment = comment.replace(/^>\s*/, "").replace(/^评语：/, "").trim();
    const yearM = block.match(/年份:\s*(\d{4})/);
    const filmYear = yearM ? Number(yearM[1]) : null;
    items.push({ doubanId, title, filmYear, comment });
  }
  return items;
}
