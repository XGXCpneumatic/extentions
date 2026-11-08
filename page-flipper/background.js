// Clicking the toolbar button (or Alt+Shift+F) flips the current page.

// Runs inside the page. Returns true if the page is now upside down.
function toggleFlip() {
  const STYLE_ID = "__page-flipper-style";
  const scroller = document.scrollingElement || document.documentElement;

  // Remember where we are so the same content stays on screen after flipping.
  const maxTop = scroller.scrollHeight - scroller.clientHeight;
  const maxLeft = scroller.scrollWidth - scroller.clientWidth;
  const top = scroller.scrollTop;
  const left = scroller.scrollLeft;

  const existing = document.getElementById(STYLE_ID);
  if (existing) {
    existing.remove();
  } else {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html {
        transform: rotate(180deg) !important;
        transform-origin: 50% 50% !important;
      }`;
    (document.head || document.documentElement).append(style);
  }

  // Rotating 180° mirrors the page, so mirror the scroll position too.
  scroller.scrollTop = maxTop - top;
  scroller.scrollLeft = maxLeft - left;

  return !existing;
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const [{ result: flipped }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleFlip,
    });
    chrome.action.setBadgeText({ tabId: tab.id, text: flipped ? "ON" : "" });
    chrome.action.setTitle({
      tabId: tab.id,
      title: flipped ? "Flip this page back" : "Flip this page upside down",
    });
  } catch {
    // chrome:// pages and the Web Store can't be modified by extensions.
    chrome.action.setBadgeText({ tabId: tab.id, text: "✕" });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 1500);
  }
});

// A new page load starts right-side up, so clear the badge.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setTitle({ tabId, title: "Flip this page upside down" });
  }
});
