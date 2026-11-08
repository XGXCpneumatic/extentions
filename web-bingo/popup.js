const grid = document.getElementById("grid");
const info = document.getElementById("info");
const progress = document.getElementById("progress");
const banner = document.getElementById("banner");
const newCardBtn = document.getElementById("new-card");
const DEFAULT_INFO = "Hover a square to see how to find it.";
let newCardArmed = false;

function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}

function setInfo(title, lines) {
  info.replaceChildren();
  const t = document.createElement("span");
  t.className = "title";
  t.textContent = title;
  info.append(t, ...lines.flatMap((line, i) => (i ? [document.createElement("br"), line] : [line])));
}

function render(card) {
  if (!card) return;
  const found = foundCount(card);
  const total = squareCount(card);
  const bingos = countBingos(card);

  progress.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = `${found}/${total}`;
  progress.append(strong, ` found · ${bingos} bingo${bingos === 1 ? "" : "s"}`);

  banner.hidden = !card.completedAt;
  if (card.completedAt) {
    banner.textContent = `🏆 Blackout! You found everything in ${formatDuration(card.completedAt - card.createdAt)}.`;
  }

  const inBingo = new Set(
    BINGO_LINES.filter((line) => line.every((i) => isChecked(card, i))).flat()
  );

  grid.replaceChildren();
  card.cells.forEach((id, index) => {
    const cell = document.createElement("button");
    cell.className = "cell";

    if (id === FREE) {
      cell.classList.add("free");
      cell.textContent = "FREE";
      cell.addEventListener("mouseenter", () => setInfo("Free square", ["You get this one for free."]));
    } else {
      const item = ITEM_BY_ID[id];
      const hit = card.found[id];
      cell.classList.add(item.level);
      if (hit) cell.classList.add("found");

      const emoji = document.createElement("span");
      emoji.className = "emoji";
      emoji.textContent = item.emoji;
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.label;
      cell.append(emoji, label);

      const showInfo = () =>
        hit
          ? setInfo(`✓ ${item.label}`, [
              `Found ${hit.evidence}`,
              `on "${hit.title || hit.url}"`,
              `${new Date(hit.at).toLocaleString()} (click to open)`,
            ])
          : setInfo(item.label, [item.hint]);
      cell.addEventListener("mouseenter", showInfo);
      cell.addEventListener("focus", showInfo);
      if (hit) cell.addEventListener("click", () => chrome.tabs.create({ url: hit.url }));
    }

    if (inBingo.has(index)) cell.classList.add("in-bingo");
    grid.append(cell);
  });
}

grid.addEventListener("mouseleave", () => (info.textContent = DEFAULT_INFO));

newCardBtn.addEventListener("click", () => {
  if (!newCardArmed) {
    newCardArmed = true;
    newCardBtn.textContent = "Lose this card?";
    setTimeout(() => {
      newCardArmed = false;
      newCardBtn.textContent = "New card";
    }, 3000);
    return;
  }
  newCardArmed = false;
  newCardBtn.textContent = "New card";
  chrome.runtime.sendMessage({ type: "new-card" });
});

chrome.storage.local.get("card").then(({ card }) => {
  if (card) render(card);
  else chrome.runtime.sendMessage({ type: "new-card" }); // first run fallback
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.card) render(changes.card.newValue);
});
