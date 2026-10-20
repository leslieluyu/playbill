/** Lightweight EN→ZH translation for plot blurbs (no API key by default). */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function translateMyMemory(text) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 450)) +
    "&langpair=en|zh-CN";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || /MYMEMORY WARNING|INVALID SOURCE/i.test(out)) {
    throw new Error(out || "empty translation");
  }
  if (text.length > 450) return out + "…";
  return out;
}

export async function translateOllama(text, model = "qwen2.5:3b", host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434") {
  const prompt =
    "将下面这段电影介绍从英文翻译成简体中文。只输出译文，不要引号、不要解释、不要英文原文。\n\n" + text;
  const res = await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_predict: 512 },
    }),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  const data = await res.json();
  const out = (data?.response || "").trim();
  if (!out) throw new Error("empty ollama response");
  return out.replace(/^["「『]|["」』]$/g, "").trim();
}

export async function translateGoogle(text) {
  const url =
    "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-CN&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  let out = null;
  if (typeof data?.[0] === "string") out = data[0];
  else if (Array.isArray(data?.[0])) out = data.map((x) => x[0]).join("");
  else if (typeof data === "string") out = data;
  if (!out || !String(out).trim()) throw new Error("empty google response");
  return String(out).trim();
}

export function createTranslator(engine = "google", opts = {}) {
  const fn =
    engine === "mymemory"
      ? translateMyMemory
      : engine === "ollama"
        ? (t) => translateOllama(t, opts.model)
        : translateGoogle;
  const delayMs = engine === "mymemory" ? 350 : engine === "ollama" ? 0 : 220;
  return async (text) => {
    const out = await fn(text);
    if (delayMs) await sleep(delayMs);
    return out;
  };
}
