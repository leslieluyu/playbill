/** Filter tag groups for /great-directors/ (ids are stable for seed + UI).
 *  Movements are curated — edit this file + src/lib/great-directors.ts together.
 *  Director `styleTags` in great-directors-directors.json can also be set manually. */

export const GD_MASTER_TAGS = [
  { id: "ss2002", zh: "《视与听》2002 大师", en: "Sight & Sound 2002 directors" },
  { id: "ss2002-critic", zh: "视与听 · 影评人十佳", en: "S&S 2002 · critics' poll" },
  { id: "ss2002-director", zh: "视与听 · 导演十佳", en: "S&S 2002 · directors' poll" },
];

export const GD_STYLE_TAGS = [
  { id: "german-expressionism", zh: "德国表现主义", en: "German Expressionism" },
  { id: "soviet-montage", zh: "苏联蒙太奇学派", en: "Soviet montage" },
  { id: "french-impressionism", zh: "法国印象主义", en: "French Impressionism" },
  { id: "surrealism", zh: "超现实主义", en: "Surrealism" },
  { id: "film-noir", zh: "黑色电影", en: "Film noir" },
  { id: "neue-sachlichkeit", zh: "新客观派", en: "Neue Sachlichkeit" },
  { id: "new-german", zh: "新德国电影", en: "New German Cinema" },
  { id: "cinema-novo", zh: "巴西新电影", en: "Cinema Novo" },
  { id: "japanese-new-wave", zh: "日本新浪潮", en: "Japanese New Wave" },
  { id: "nouvelle-vague", zh: "法国新浪潮", en: "French New Wave" },
  { id: "czech-new-wave", zh: "捷克新浪潮", en: "Czech New Wave" },
  { id: "italian-neorealism", zh: "意大利新现实主义", en: "Italian neorealism" },
  { id: "swedish-classical", zh: "瑞典古典电影学派", en: "Swedish classical cinema" },
  { id: "dogme95", zh: "道格玛 95", en: "Dogme 95" },
  { id: "finnish-minimal", zh: "芬兰沉默 / 极简派", en: "Finnish minimalism" },
  { id: "chinese-new", zh: "华语新电影", en: "Chinese New Wave" },
];

export const GD_AWARD_TAGS = [
  { id: "oscar", zh: "奥斯卡", en: "Oscar" },
  { id: "cannes", zh: "戛纳", en: "Cannes" },
  { id: "berlin", zh: "柏林", en: "Berlin" },
  { id: "venice", zh: "威尼斯", en: "Venice" },
  { id: "golden-globe", zh: "金球奖", en: "Golden Globe" },
  { id: "bafta", zh: "BAFTA", en: "BAFTA" },
  { id: "cesar", zh: "凯撒奖", en: "César" },
];

export const GD_ALL_FILTER_TAGS = [...GD_MASTER_TAGS, ...GD_STYLE_TAGS, ...GD_AWARD_TAGS];

export function awardTagsFromText(text) {
  const s = String(text ?? "");
  const tags = [];
  if (/奥斯卡/.test(s)) tags.push("oscar");
  if (/戛纳/.test(s)) tags.push("cannes");
  if (/柏林/.test(s)) tags.push("berlin");
  if (/威尼斯/.test(s)) tags.push("venice");
  if (/金球/.test(s)) tags.push("golden-globe");
  if (/BAFTA|英国电影学院/.test(s)) tags.push("bafta");
  if (/凯撒/.test(s)) tags.push("cesar");
  return tags;
}

export function styleTagsFromBio(bio) {
  const s = String(bio ?? "");
  const tags = [];
  if (/德国表现主义|表现主义大师/.test(s)) tags.push("german-expressionism");
  if (/苏联蒙太奇|蒙太奇理论/.test(s)) tags.push("soviet-montage");
  if (/法国印象主义/.test(s)) tags.push("french-impressionism");
  if (/超现实/.test(s)) tags.push("surrealism");
  if (/黑色电影|noir/i.test(s)) tags.push("film-noir");
  if (/新客观/.test(s)) tags.push("neue-sachlichkeit");
  if (/新德国/.test(s)) tags.push("new-german");
  if (/巴西新电影|Cinema Novo/i.test(s)) tags.push("cinema-novo");
  if (/日本新浪潮/.test(s)) tags.push("japanese-new-wave");
  if (/法国新浪潮|新浪潮最激进|被新浪潮/.test(s)) tags.push("nouvelle-vague");
  if (/新现实主义/.test(s)) tags.push("italian-neorealism");
  if (/瑞典/.test(s) && /古典|伯格曼/.test(s)) tags.push("swedish-classical");
  if (/道格玛/.test(s)) tags.push("dogme95");
  if (/芬兰|极简|沉默/.test(s) && /卡勒/i.test(s)) tags.push("finnish-minimal");
  if (/华语新电影|两岸/.test(s)) tags.push("chinese-new");
  return [...new Set(tags)];
}
