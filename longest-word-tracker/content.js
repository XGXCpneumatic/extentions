// Runs on every page. Finds the longest real-looking word and reports it.

const MAX_WORD_LENGTH = 50; // anything longer is almost certainly junk (hashes, tokens)
const WORD_RE = /\p{L}+(?:['’-]\p{L}+)*/gu;

let pageLongest = null; // { word, length }

function looksLikeJunk(word) {
  if (word.length > MAX_WORD_LENGTH) return true;
  if (/(.)\1{3,}/u.test(word)) return true;          // "aaaaaa", "zzzzz"
  if (/\p{Ll}\p{Lu}/u.test(word)) return true;       // camelCase identifiers
  // Latin-script word with no vowels at all is probably an abbreviation/garbage
  if (/^[a-z'’-]+$/i.test(word) && !/[aeiouy]/i.test(word)) return true;
  return false;
}

function letterCount(word) {
  return word.replace(/['’-]/g, "").length;
}

function scan() {
  if (!document.body) return;
  const text = document.body.innerText || "";
  let best = pageLongest;

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    const len = letterCount(word);
    if (best && len <= best.length) continue;
    if (looksLikeJunk(word)) continue;
    best = { word, length: len };
  }

  if (best && (!pageLongest || best.word !== pageLongest.word)) {
    pageLongest = best;
    chrome.runtime.sendMessage({
      type: "word-found",
      word: best.word,
      length: best.length,
      url: location.href,
      title: document.title,
    }).catch(() => {}); // extension may have been reloaded
  }
}

// Re-scan when the page changes (infinite scroll, SPAs), debounced.
let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(scan, 1500);
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "get-page-longest") {
    scan();
    sendResponse(pageLongest);
  }
});

scan();
