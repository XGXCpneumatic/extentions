const enabledEl = document.getElementById("enabled");

chrome.storage.local.get(["enabled", "corner", "size"]).then(({ enabled = true, corner = "right", size = "medium" }) => {
  enabledEl.checked = enabled;
  document.querySelector(`input[name="corner"][value="${corner}"]`).checked = true;
  document.querySelector(`input[name="size"][value="${size}"]`).checked = true;
});

enabledEl.addEventListener("change", () => chrome.storage.local.set({ enabled: enabledEl.checked }));

for (const input of document.querySelectorAll('input[type="radio"]')) {
  input.addEventListener("change", () => chrome.storage.local.set({ [input.name]: input.value }));
}
