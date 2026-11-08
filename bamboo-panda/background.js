// Chrome only runs content scripts on pages loaded after the extension is installed.
// So on install/reload, add the panda to the tabs that are already open too.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
      .catch(() => {}); // some pages (like the Web Store) can't be scripted
  }
});
