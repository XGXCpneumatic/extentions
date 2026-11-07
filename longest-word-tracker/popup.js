const pageEl = document.getElementById("page");
const boardEl = document.getElementById("board");
const emptyEl = document.getElementById("empty");
let clearArmed = false;

async function showPageWord() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "get-page-longest" });
    if (result) {
      pageEl.textContent = result.word + " ";
      const small = document.createElement("small");
      small.textContent = `(${result.length} letters)`;
      pageEl.append(small);
    } else {
      pageEl.textContent = "No words found";
    }
  } catch {
    // chrome:// pages, the Web Store, or tabs opened before the extension was installed
    pageEl.textContent = "Can't read this page (try reloading it)";
  }
}

function renderBoard(leaderboard = []) {
  boardEl.replaceChildren();
  emptyEl.hidden = leaderboard.length > 0;

  leaderboard.forEach((entry, i) => {
    const li = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = i + 1;

    const word = document.createElement("span");
    word.className = "word";
    word.textContent = entry.word;
    word.title = `Seen ${entry.timesSeen}× · first on ${new Date(entry.firstSeen).toLocaleDateString()}`;

    const len = document.createElement("span");
    len.className = "len";
    len.textContent = entry.length;

    const link = document.createElement("a");
    link.href = entry.url;
    link.target = "_blank";
    link.textContent = entry.title || entry.url;
    link.title = entry.url;

    li.append(rank, word, len, link);
    boardEl.append(li);
  });
}

document.getElementById("clear").addEventListener("click", (e) => {
  if (!clearArmed) {
    clearArmed = true;
    e.target.textContent = "Sure?";
    setTimeout(() => { clearArmed = false; e.target.textContent = "Clear"; }, 3000);
    return;
  }
  chrome.runtime.sendMessage({ type: "clear" });
  clearArmed = false;
  e.target.textContent = "Clear";
});

chrome.storage.local.get("leaderboard").then(({ leaderboard }) => renderBoard(leaderboard));
chrome.storage.onChanged.addListener((changes) => {
  if (changes.leaderboard) renderBoard(changes.leaderboard.newValue);
});

showPageWord();
