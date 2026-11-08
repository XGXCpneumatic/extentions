// Hides Pip somewhere on the page. Clicking him adds a point and he hides again.

const SIZE = 28; // px. Smaller = harder to find.

// Pip: a little orange critter with an antenna. Swap this SVG for your own art if you like.
const PIP_SVG = `
<svg viewBox="0 0 40 40" width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="9" x2="24" y2="2" stroke="#5a3a1a" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24.5" cy="2.5" r="2.5" fill="#ffd23f"/>
  <ellipse cx="20" cy="25" rx="15" ry="14" fill="#ff8a3d" stroke="#5a3a1a" stroke-width="2"/>
  <ellipse cx="20" cy="30" rx="8" ry="6" fill="#ffc499"/>
  <circle cx="14" cy="21" r="4.5" fill="#fff" stroke="#5a3a1a" stroke-width="1.5"/>
  <circle cx="26" cy="21" r="4.5" fill="#fff" stroke="#5a3a1a" stroke-width="1.5"/>
  <circle cx="15" cy="22" r="2" fill="#222"/>
  <circle cx="27" cy="22" r="2" fill="#222"/>
  <path d="M16 30 Q20 33 24 30" fill="none" stroke="#5a3a1a" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

// Shadow DOM keeps the page's CSS from messing with Pip (and Pip's CSS out of the page).
const host = document.createElement("div");
host.style.cssText = `position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;`;
const root = host.attachShadow({ mode: "closed" });
root.innerHTML = `
  <style>
    .pip {
      position: absolute; width: ${SIZE}px; height: ${SIZE}px;
      cursor: pointer; transition: transform 0.15s;
    }
    .pip:hover { transform: scale(1.25) rotate(-8deg); }
    .pip.hint { animation: hint 0.6s ease-in-out 4; }
    @keyframes hint {
      0%, 100% { transform: scale(1); filter: none; }
      50% { transform: scale(2); filter: drop-shadow(0 0 8px #ffd23f); }
    }
    .pop {
      position: absolute; pointer-events: none; white-space: nowrap;
      font: bold 14px system-ui, sans-serif; color: #fff;
      background: #ff8a3d; border: 2px solid #5a3a1a; border-radius: 12px;
      padding: 3px 10px; transform: translate(-50%, -100%);
      animation: pop 1.4s ease-out forwards;
    }
    @keyframes pop {
      0% { opacity: 0; margin-top: 0; }
      15% { opacity: 1; }
      100% { opacity: 0; margin-top: -40px; }
    }
  </style>
  <div class="pip" title="You found Pip!">${PIP_SVG}</div>`;
const pip = root.querySelector(".pip");

function hide() {
  const scroller = document.scrollingElement || document.documentElement;
  const width = Math.max(scroller.clientWidth, 200);
  const height = Math.max(scroller.scrollHeight, window.innerHeight);
  pip.style.left = Math.random() * (width - SIZE) + "px";
  pip.style.top = Math.random() * (height - SIZE) + "px";
}

function showPop(x, y, text) {
  const pop = document.createElement("div");
  pop.className = "pop";
  pop.textContent = text;
  pop.style.left = x + "px";
  pop.style.top = y + "px";
  root.append(pop);
  setTimeout(() => pop.remove(), 1500);
}

pip.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation(); // don't let the page react to the click
  const { found = 0 } = await chrome.storage.local.get("found");
  const total = found + 1;
  await chrome.storage.local.set({ found: total });
  showPop(e.pageX, e.pageY, `Found Pip! (${total})`);
  pip.classList.remove("hint");
  hide();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "hint") return;
  if (!host.isConnected) return sendResponse(false);
  pip.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  pip.classList.remove("hint");
  void pip.offsetWidth; // restart the animation
  pip.classList.add("hint");
  sendResponse(true);
});

function setEnabled(enabled) {
  if (enabled && !host.isConnected) {
    document.documentElement.append(host);
    hide();
  } else if (!enabled) {
    host.remove();
  }
}

chrome.storage.local.get("enabled").then(({ enabled = true }) => setEnabled(enabled));
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) setEnabled(changes.enabled.newValue);
});
