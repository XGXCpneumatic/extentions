// Checks each page for the squares on your card that you haven't found yet.
// (items.js is loaded first and provides ITEM_BY_ID, FREE, etc.)

let card = null;
const reported = new Set(); // squares this tab already reported, so we don't spam the background

function buildContext() {
  const text = (document.body.innerText || "").slice(0, 2_000_000);
  const words = text.match(/\p{L}+/gu) || [];
  return {
    text,
    words,
    wordSet: new Set(words.map((w) => w.toLowerCase())),
    images: [...document.images].filter((img) => img.complete && img.getClientRects().length > 0),
    url: new URL(location.href),
  };
}

function scan() {
  if (!card || !document.body) return;
  const pending = card.cells.filter((id) => id !== FREE && !card.found[id] && !reported.has(id));
  if (pending.length === 0) return;

  const ctx = buildContext();
  for (const id of pending) {
    let evidence = null;
    try {
      evidence = ITEM_BY_ID[id]?.test(ctx);
    } catch {
      // a broken detector shouldn't stop the others
    }
    if (!evidence) continue;

    reported.add(id);
    chrome.runtime
      .sendMessage({ type: "found", id, evidence: String(evidence).slice(0, 80), url: location.href, title: document.title })
      .then((res) => res?.newly && toast(ITEM_BY_ID[id], res))
      .catch(() => {}); // extension was reloaded
  }
}

// ---------- toast notifications ----------

let toastRoot = null;
function getToastRoot() {
  if (toastRoot) return toastRoot;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
  document.documentElement.append(host); // outside <body>, so our own text isn't scanned
  toastRoot = host.attachShadow({ mode: "closed" });
  toastRoot.innerHTML = `
    <style>
      .stack { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
      .toast {
        font: 14px/1.35 system-ui, sans-serif; color: #1f2d22;
        background: #f4fbf5; border: 2px solid #3a7d44; border-radius: 12px;
        padding: 10px 14px; box-shadow: 0 6px 20px rgba(0,0,0,.18);
        max-width: 300px; animation: in .3s ease-out, out .4s ease-in 4.6s forwards;
      }
      .toast b { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #3a7d44; }
      .big { font-weight: 800; font-size: 18px; color: #c0392b; margin-top: 4px; }
      .gold { color: #b8860b; }
      @keyframes in { from { opacity: 0; transform: translateY(12px); } }
      @keyframes out { to { opacity: 0; transform: translateY(12px); } }
    </style>
    <div class="stack"></div>`;
  return toastRoot;
}

function toast(item, res) {
  const stack = getToastRoot().querySelector(".stack");
  const el = document.createElement("div");
  el.className = "toast";

  const head = document.createElement("b");
  head.textContent = `Bingo square ${res.found}/${res.total}`;
  const body = document.createElement("div");
  body.textContent = `${item.emoji} ${item.label}`;
  el.append(head, body);

  if (res.blackout || res.newBingo) {
    const big = document.createElement("div");
    big.className = res.blackout ? "big gold" : "big";
    big.textContent = res.blackout ? "🏆 BLACKOUT! You found everything!" : "🎉 BINGO!";
    el.append(big);
  }

  stack.append(el);
  setTimeout(() => el.remove(), 5200);
}

// ---------- wiring ----------

chrome.storage.local.get("card").then(({ card: c }) => {
  card = c || null;
  scan();
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.card) return;
  const isNewCard = changes.card.newValue?.createdAt !== card?.createdAt;
  card = changes.card.newValue || null;
  if (isNewCard) {
    reported.clear();
    scan();
  }
});

// Re-check when the page changes (infinite scroll, single-page apps) or finishes loading images.
let timer = null;
const rescanSoon = () => {
  clearTimeout(timer);
  timer = setTimeout(scan, 2000);
};
new MutationObserver(rescanSoon).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("load", rescanSoon);
