// Owns the bingo card. All changes go through here so tabs can't overwrite each other.
importScripts("items.js");

let queue = Promise.resolve();
function serialized(fn) {
  const run = queue.then(fn);
  queue = run.catch(console.error);
  return run;
}

async function getCard() {
  let { card } = await chrome.storage.local.get("card");
  if (!card) {
    card = newCard();
    await chrome.storage.local.set({ card });
  }
  return card;
}

async function markFound({ id, evidence, url, title }) {
  const card = await getCard();
  if (!card.cells.includes(id) || card.found[id]) return { newly: false };

  const bingosBefore = countBingos(card);
  card.found[id] = { at: Date.now(), url, title, evidence };
  const bingosAfter = countBingos(card);
  const blackout = foundCount(card) === squareCount(card);
  if (blackout) card.completedAt = Date.now();

  await chrome.storage.local.set({ card });
  return {
    newly: true,
    newBingo: bingosAfter > bingosBefore,
    blackout,
    found: foundCount(card),
    total: squareCount(card),
  };
}

function updateBadge(card) {
  if (!card) return;
  const done = foundCount(card) === squareCount(card);
  chrome.action.setBadgeText({ text: done ? "★" : String(foundCount(card)) });
  chrome.action.setBadgeBackgroundColor({ color: done ? "#d4a017" : "#3a7d44" });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "found") {
    serialized(() => markFound(msg)).then(sendResponse, () => sendResponse({ newly: false }));
    return true; // we'll respond asynchronously
  }
  if (msg.type === "new-card") {
    serialized(() => chrome.storage.local.set({ card: newCard() })).then(() => sendResponse(true));
    return true;
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.card) updateBadge(changes.card.newValue);
});

chrome.runtime.onInstalled.addListener(() => serialized(getCard).then(updateBadge));
chrome.runtime.onStartup.addListener(() => serialized(getCard).then(updateBadge));
