// A panda in the corner that eats bamboo and watches your cursor.
// Wrapped in a function so it can be injected again (e.g. after the extension reloads) without errors.
(() => {

// Remove a panda left behind by an older copy of this script.
document.querySelectorAll("[data-bamboo-panda]").forEach((el) => el.remove());

const SIZES = { small: 90, medium: 130, large: 180 };
const SEGMENT = 11;  // height of one bamboo segment (SVG units)
const SEGMENTS = 6;  // bites per stalk
const CHEW_MS = 520; // one chew
const CHEWS_PER_BITE = 4;

const INK = "#1f1f1f";
const FUR = "#fbfbfb";
const LINE = "#3a3a3a";

const bambooSegments = Array.from({ length: SEGMENTS }, (_, i) => {
  const y = 71 + i * SEGMENT;
  return `<rect x="56.5" y="${y}" width="7" height="${SEGMENT - 0.6}" rx="1.5" fill="#7cb342"/>
          <rect x="56" y="${y + SEGMENT - 1.6}" width="8" height="1.6" rx="0.8" fill="#4e7d23"/>
          <rect x="58" y="${y + 1.5}" width="1.4" height="${SEGMENT - 4}" rx="0.7" fill="#a5d66f" opacity="0.8"/>`;
}).join("");
const stalkEnd = 71 + SEGMENTS * SEGMENT;

const PANDA_SVG = `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="mouthline"><rect x="0" y="71" width="120" height="60"/></clipPath>
  </defs>

  <!-- body -->
  <ellipse cx="60" cy="112" rx="40" ry="30" fill="${FUR}" stroke="${LINE}" stroke-width="1.2"/>
  <ellipse cx="33" cy="115" rx="13" ry="9" fill="${INK}"/>
  <ellipse cx="87" cy="115" rx="13" ry="9" fill="${INK}"/>

  <!-- head (rotates toward the cursor) -->
  <g id="head">
    <circle cx="34" cy="26" r="11" fill="${INK}"/>
    <circle cx="86" cy="26" r="11" fill="${INK}"/>
    <ellipse cx="60" cy="52" rx="34" ry="30" fill="${FUR}" stroke="${LINE}" stroke-width="1.2"/>
    <ellipse cx="45" cy="51" rx="8" ry="10.5" fill="${INK}" transform="rotate(30 45 51)"/>
    <ellipse cx="75" cy="51" rx="8" ry="10.5" fill="${INK}" transform="rotate(-30 75 51)"/>
    <g id="eyes">
      <circle cx="46" cy="50" r="3.8" fill="#fff"/>
      <circle cx="74" cy="50" r="3.8" fill="#fff"/>
      <circle id="pupil-l" cx="46" cy="50" r="2.1" fill="#111"/>
      <circle id="pupil-r" cx="74" cy="50" r="2.1" fill="#111"/>
    </g>
    <ellipse cx="38" cy="62" rx="4" ry="2.2" fill="#ffb3c1" opacity="0.7"/>
    <ellipse cx="82" cy="62" rx="4" ry="2.2" fill="#ffb3c1" opacity="0.7"/>
    <ellipse cx="60" cy="62" rx="4.2" ry="3" fill="${INK}"/>
    <path d="M60 65 v2.5" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse id="mouth" cx="60" cy="71" rx="4.5" ry="2.5" fill="#5a2b2b"/>
  </g>

  <!-- bamboo, clipped so it disappears into the mouth -->
  <g clip-path="url(#mouthline)">
    <g transform="rotate(-10 60 71)">
      <g id="bamboo-feed">
        <g id="bamboo-bob">
          ${bambooSegments}
          <path d="M60 ${stalkEnd} q-12 4 -18 14 q12 -2 18 -14z" fill="#8bc34a"/>
          <path d="M60 ${stalkEnd} q12 2 20 10 q-12 0 -20 -10z" fill="#9ccc65"/>
        </g>
      </g>
    </g>
  </g>

  <!-- paws holding the bamboo -->
  <ellipse cx="49" cy="95" rx="8.5" ry="11" fill="${INK}" transform="rotate(25 49 95)"/>
  <ellipse cx="71" cy="95" rx="8.5" ry="11" fill="${INK}" transform="rotate(-25 71 95)"/>

  <g id="crumbs"></g>
</svg>`;

const STYLE = `
  :host { all: initial; }
  .panda {
    position: fixed; bottom: 0; z-index: 2147483646;
    pointer-events: none;             /* never blocks clicks on the page */
    transition: opacity 0.25s;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.18));
  }
  .panda.right { right: 12px; }
  .panda.left { left: 12px; }
  .panda.faded { opacity: 0.2; }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }

  #bamboo-feed { transition: transform 0.25s ease-out; }
  #bamboo-feed.instant { transition: none; }
  #bamboo-bob { animation: bob ${CHEW_MS}ms ease-in-out infinite; }
  #mouth { animation: chew ${CHEW_MS}ms ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes bob { 50% { transform: translateY(-2px); } }
  @keyframes chew { 0%, 100% { transform: scaleY(0.45); } 50% { transform: scaleY(1.15); } }

  #eyes { transform-box: fill-box; transform-origin: center; transition: transform 0.08s; }
  #eyes.blink { transform: scaleY(0.1); }

  .crumb { animation: crumb 0.6s ease-out forwards; }
  @keyframes crumb { to { transform: translate(var(--dx), var(--dy)); opacity: 0; } }
`;

// ---------- build ----------

const host = document.createElement("div");
host.setAttribute("data-bamboo-panda", "");
const root = host.attachShadow({ mode: "closed" });
root.innerHTML = `<style>${STYLE}</style><div class="panda">${PANDA_SVG}</div>`;
const panda = root.querySelector(".panda");
const $ = (id) => root.getElementById(id);
const head = $("head"), eyes = $("eyes"), pupilL = $("pupil-l"), pupilR = $("pupil-r");
const feed = $("bamboo-feed"), crumbs = $("crumbs");

// ---------- watching the cursor ----------

let mouse = null; // null = cursor left the window, so he looks at his bamboo
let frameQueued = false;

function look() {
  frameQueued = false;
  const rect = panda.getBoundingClientRect();
  const scale = rect.width / 120;
  const eyeX = rect.left + 60 * scale;
  const eyeY = rect.top + 50 * scale;

  // Default: looking down at the bamboo.
  let dx = 0, dy = 1, dist = 0;
  if (mouse) {
    dx = mouse.x - eyeX;
    dy = mouse.y - eyeY;
    dist = Math.hypot(dx, dy) || 1;
    dx /= dist;
    dy /= dist;
  }

  const reach = 1.6; // how far pupils can move inside the eye
  for (const [pupil, cx] of [[pupilL, 46], [pupilR, 74]]) {
    pupil.setAttribute("cx", cx + dx * reach);
    pupil.setAttribute("cy", 50 + dy * reach);
  }
  // Tilt the head a little toward the cursor.
  const tilt = mouse ? Math.max(-7, Math.min(7, dx * 7)) : 0;
  const lift = mouse ? Math.max(-2, Math.min(2, dy * 2)) : 1.5;
  head.setAttribute("transform", `rotate(${tilt.toFixed(2)} 60 82) translate(0 ${lift.toFixed(2)})`);

  // Get out of the way when the cursor comes close.
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  panda.classList.toggle("faded", Boolean(mouse) && Math.hypot(mouse.x - cx, mouse.y - cy) < rect.width * 0.75);
}

function queueLook() {
  if (!frameQueued) {
    frameQueued = true;
    requestAnimationFrame(look);
  }
}

document.addEventListener("mousemove", (e) => { mouse = { x: e.clientX, y: e.clientY }; queueLook(); }, { passive: true });
document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) { mouse = null; queueLook(); } });

// ---------- blinking ----------

(function blinkLater() {
  setTimeout(() => {
    eyes.classList.add("blink");
    setTimeout(() => eyes.classList.remove("blink"), 140);
    blinkLater();
  }, 2500 + Math.random() * 4000);
})();

// ---------- eating ----------

let bites = 0;
function setFeed(px, instant = false) {
  feed.classList.toggle("instant", instant);
  feed.style.transform = `translateY(${px}px)`;
}

function spawnCrumbs() {
  for (let i = 0; i < 3; i++) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", 60 + (Math.random() * 6 - 3));
    c.setAttribute("cy", 73);
    c.setAttribute("r", 0.9 + Math.random() * 0.8);
    c.setAttribute("fill", i % 2 ? "#7cb342" : "#a5d66f");
    c.setAttribute("class", "crumb");
    c.style.setProperty("--dx", `${(Math.random() * 2 - 1) * 14}px`);
    c.style.setProperty("--dy", `${4 + Math.random() * 10}px`);
    crumbs.append(c);
    setTimeout(() => c.remove(), 650);
  }
}

function bite() {
  if (document.hidden) return; // don't munch in background tabs
  bites++;
  spawnCrumbs();
  if (bites <= SEGMENTS + 1) {
    setFeed(-bites * SEGMENT); // pull the stalk into his mouth
  } else {
    // Stalk finished: grab a fresh one from below.
    bites = 0;
    setFeed(60, true);
    void feed.getBoundingClientRect(); // apply the jump before animating back
    requestAnimationFrame(() => setFeed(0));
  }
}
setInterval(bite, CHEW_MS * CHEWS_PER_BITE);

// ---------- settings ----------

function applySettings({ enabled = true, corner = "right", size = "medium" }) {
  panda.classList.toggle("right", corner !== "left");
  panda.classList.toggle("left", corner === "left");
  const px = SIZES[size] || SIZES.medium;
  panda.style.width = px + "px";
  panda.style.height = px + "px";

  if (enabled && !host.isConnected) document.documentElement.append(host);
  if (!enabled) host.remove();
  queueLook();
}

let settings = {};
chrome.storage.local.get(["enabled", "corner", "size"]).then((s) => applySettings((settings = s)));
chrome.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
  applySettings(settings);
});

})();
