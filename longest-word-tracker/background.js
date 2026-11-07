// Keeps the all-time leaderboard. All writes go through here so tabs don't race.

const LEADERBOARD_SIZE = 50;

let queue = Promise.resolve();

async function recordWord({ word, length, url, title }) {
  const { leaderboard = [] } = await chrome.storage.local.get("leaderboard");
  const key = word.toLowerCase();

  const existing = leaderboard.find((e) => e.key === key);
  if (existing) {
    existing.timesSeen += 1;
    existing.lastSeen = Date.now();
  } else {
    const smallest = leaderboard[leaderboard.length - 1];
    if (leaderboard.length >= LEADERBOARD_SIZE && length <= smallest.length) return;
    leaderboard.push({ key, word, length, url, title, firstSeen: Date.now(), lastSeen: Date.now(), timesSeen: 1 });
  }

  leaderboard.sort((a, b) => b.length - a.length || a.firstSeen - b.firstSeen);
  leaderboard.length = Math.min(leaderboard.length, LEADERBOARD_SIZE);
  await chrome.storage.local.set({ leaderboard });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "word-found") {
    queue = queue.then(() => recordWord(msg)).catch(console.error);
  } else if (msg.type === "clear") {
    queue = queue.then(() => chrome.storage.local.set({ leaderboard: [] }));
  }
});
