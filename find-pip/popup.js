const countEl = document.getElementById("count");
const enabledEl = document.getElementById("enabled");
const hintBtn = document.getElementById("hint");
const hintMsg = document.getElementById("hint-msg");
const resetBtn = document.getElementById("reset");
let resetArmed = false;

chrome.storage.local.get(["found", "enabled"]).then(({ found = 0, enabled = true }) => {
  countEl.textContent = found;
  enabledEl.checked = enabled;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.found) countEl.textContent = changes.found.newValue ?? 0;
});

enabledEl.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabledEl.checked });
});

hintBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let shown = false;
  try {
    shown = await chrome.tabs.sendMessage(tab.id, { type: "hint" });
  } catch {
    // chrome:// pages, the Web Store, or tabs opened before the extension was installed
  }
  if (shown) {
    window.close(); // get out of the way so you can see him
    return;
  }
  hintMsg.hidden = false;
  hintMsg.textContent = enabledEl.checked
    ? "Pip can't hide on this page. Try reloading it."
    : "Pip is turned off.";
});

resetBtn.addEventListener("click", () => {
  if (!resetArmed) {
    resetArmed = true;
    resetBtn.textContent = "Sure?";
    setTimeout(() => { resetArmed = false; resetBtn.textContent = "Reset score"; }, 3000);
    return;
  }
  chrome.storage.local.set({ found: 0 });
  resetArmed = false;
  resetBtn.textContent = "Reset score";
});
