// Shared by the content script (detection), background (card generation) and popup (labels).
// Each square has a `test(ctx)` that returns a short piece of evidence if the page has it, or null.
//
// ctx = {
//   text:    visible text of the page
//   words:   every word on the page (letters only)
//   wordSet: lowercase set of those words
//   images:  visible <img> elements
//   url:     URL object for the page
// }

const CARD_SIZE = 5;
const FREE = "free";
const PER_LEVEL = { easy: 7, medium: 11, hard: 6 }; // 24 squares + free center

// ---------- helpers ----------

function looksLikeJunk(word) {
  if (word.length > 50) return true;                  // hashes, tokens
  if (/(.)\1{3,}/u.test(word)) return true;          // "aaaaaa"
  if (/\p{Ll}\p{Lu}/u.test(word)) return true;       // camelCase code
  if (/^[a-z]+$/i.test(word) && !/[aeiouy]/i.test(word)) return true;
  return false;
}

function anyWord(ctx, list) {
  for (const w of list) if (ctx.wordSet.has(w)) return `the word "${w}"`;
  return null;
}

function firstMatch(text, re) {
  const m = text.match(re);
  return m ? `"${m[0].trim().slice(0, 60)}"` : null;
}

function findWord(ctx, predicate) {
  const w = ctx.words.find((w) => predicate(w, w.toLowerCase()) && !looksLikeJunk(w));
  return w ? `"${w}"` : null;
}

function imageLabel(ctx, re) {
  for (const img of ctx.images) {
    const label = `${img.alt || ""} ${img.title || ""}`.trim();
    if (re.test(label)) return `an image labeled "${label.slice(0, 50)}"`;
  }
  return null;
}

function isVisible(el) {
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

function backgroundLuminance(el) {
  const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
  if (!m) return null;
  const [r, g, b, a = 1] = m.map(Number);
  if (a === 0) return null; // transparent, look further up
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// ---------- the squares ----------

const ITEMS = [
  // ----- easy -----
  { id: "copyright", level: "easy", emoji: "©️", label: "A © symbol",
    hint: "The copyright symbol, usually in a page footer.",
    test: (c) => (c.text.includes("©") ? "©" : null) },
  { id: "org", level: "easy", emoji: "🏛️", label: "A .org website",
    hint: "Visit any site whose address ends in .org.",
    test: (c) => (c.url.hostname.endsWith(".org") ? c.url.hostname : null) },
  { id: "weekday", level: "easy", emoji: "📅", label: "A day of the week",
    hint: "Monday, Tuesday, … Sunday, written out.",
    test: (c) => firstMatch(c.text, /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/) },
  { id: "emoji", level: "easy", emoji: "😀", label: "An emoji",
    hint: "Any emoji in the page text.",
    test: (c) => firstMatch(c.text, /\p{Emoji_Presentation}/u) },
  { id: "percent", level: "easy", emoji: "💯", label: "A percentage",
    hint: "A number with a % sign, like 42%.",
    test: (c) => firstMatch(c.text, /\d+(?:\.\d+)?\s?%/) },
  { id: "month", level: "easy", emoji: "🗓️", label: "A month name",
    hint: "January, February, … December (May doesn't count, it's too sneaky).",
    test: (c) => firstMatch(c.text, /\b(January|February|March|April|June|July|August|September|October|November|December)\b/) },
  { id: "wikipedia", level: "easy", emoji: "📚", label: "A Wikipedia page",
    hint: "Any page on wikipedia.org.",
    test: (c) => (c.url.hostname.endsWith("wikipedia.org") ? c.url.hostname : null) },
  { id: "video", level: "easy", emoji: "🎬", label: "A video player",
    hint: "A video on the page, including embedded YouTube or Vimeo.",
    test: () => (document.querySelector('video, iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"], iframe[src*="vimeo.com"]') ? "a video player" : null) },

  // ----- medium -----
  { id: "cat", level: "medium", emoji: "🐱", label: "A cat",
    hint: 'The word "cat" or "kitten", or a picture labeled as a cat.',
    test: (c) => anyWord(c, ["cat", "cats", "kitten", "kittens"]) || imageLabel(c, /\b(cat|kitten)s?\b/i) },
  { id: "dog", level: "medium", emoji: "🐶", label: "A dog",
    hint: 'The word "dog" or "puppy", or a picture labeled as a dog.',
    test: (c) => anyWord(c, ["dog", "dogs", "puppy", "puppies"]) || imageLabel(c, /\b(dogs?|pupp(y|ies))\b/i) },
  { id: "email", level: "medium", emoji: "📧", label: "An email address",
    hint: "Something like name@example.com.",
    test: (c) => firstMatch(c.text, /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/i) },
  { id: "edugov", level: "medium", emoji: "🎓", label: "A .edu or .gc.ca site",
    hint: "A school (.edu) or Government of Canada (.gc.ca or canada.ca) website.",
    test: (c) => (/(\.edu(\.[a-z]{2})?|\.gc\.ca|(^|\.)canada\.ca)$/.test(c.url.hostname) ? c.url.hostname : null) },
  { id: "long15", level: "medium", emoji: "📏", label: "A 15+ letter word",
    hint: "A real word with at least 15 letters.",
    test: (c) => findWord(c, (w) => w.length >= 15) },
  { id: "palindrome", level: "medium", emoji: "🔁", label: "A palindrome",
    hint: "A word of 5+ letters that reads the same backwards, like level or radar.",
    test: (c) => findWord(c, (w, l) => l.length >= 5 && l === [...l].reverse().join("") && new Set(l).size > 1) },
  { id: "allvowels", level: "medium", emoji: "🅰️", label: "A word with every vowel",
    hint: "A word containing a, e, i, o and u, like education.",
    test: (c) => findWord(c, (w, l) => [..."aeiou"].every((v) => l.includes(v))) },
  { id: "xword", level: "medium", emoji: "❌", label: "A word starting with X",
    hint: "A word of 4+ letters starting with X, like xylophone.",
    test: (c) => findWord(c, (w, l) => /^x[a-z]{3,}$/.test(l) && /[aeiouy]/.test(l.slice(1))) },
  { id: "zz", level: "medium", emoji: "🐝", label: 'A word with "zz"',
    hint: "Like pizza, jazz or buzz.",
    test: (c) => findWord(c, (w, l) => l.includes("zz")) },
  { id: "price", level: "medium", emoji: "💰", label: "A price over 1,000",
    hint: "Something like $1,299 or €5000.",
    test: (c) => firstMatch(c.text, /[$€£]\s?(?:\d{1,3}(?:,\d{3})+|\d{4,})(?:\.\d{2})?/) },
  { id: "phone", level: "medium", emoji: "📞", label: "A phone number",
    hint: "Something like (555) 123-4567.",
    test: (c) => firstMatch(c.text, /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/) },
  { id: "hashtag", level: "medium", emoji: "#️⃣", label: "A hashtag",
    hint: "Something like #throwback.",
    test: (c) => firstMatch(c.text, /(?:^|\s)#[A-Za-z]\w{2,}/m) },
  { id: "year1800s", level: "medium", emoji: "🎩", label: "A year from the 1800s",
    hint: "Any year from 1800 to 1899.",
    test: (c) => firstMatch(c.text, /\b18\d\d(?:s)?\b/) },
  { id: "gif", level: "medium", emoji: "🎞️", label: "A GIF",
    hint: "A .gif image on the page (not a tiny tracking pixel).",
    test: (c) => (c.images.find((i) => /\.gif($|[?#])/i.test(i.currentSrc || i.src) && i.naturalWidth >= 50) ? "a GIF image" : null) },
  { id: "table", level: "medium", emoji: "🧮", label: "A table with 10+ rows",
    hint: "A data table with at least 10 rows.",
    test: () => {
      const t = [...document.querySelectorAll("table")].find((t) => t.rows.length >= 10 && isVisible(t));
      return t ? `a table with ${t.rows.length} rows` : null;
    } },
  { id: "dark", level: "medium", emoji: "🌙", label: "A dark-mode page",
    hint: "A page with a dark background.",
    test: () => {
      const lum = backgroundLuminance(document.body) ?? backgroundLuminance(document.documentElement);
      return lum !== null && lum < 0.2 ? "a dark background" : null;
    } },
  { id: "bigpage", level: "medium", emoji: "📜", label: "A page with 5,000+ words",
    hint: "A really long article.",
    test: (c) => (c.words.length >= 5000 ? `${c.words.length.toLocaleString()} words` : null) },
  { id: "longtitle", level: "medium", emoji: "🏷️", label: "A title over 80 characters",
    hint: "The tab title is longer than 80 characters.",
    test: () => (document.title.length > 80 ? `"${document.title.slice(0, 60)}…"` : null) },
  { id: "allcaps", level: "medium", emoji: "📢", label: "A 10+ letter WORD IN CAPS",
    hint: "A word of 10+ letters written in all capitals.",
    test: (c) => findWord(c, (w, l) => w.length >= 10 && w === w.toUpperCase() && w !== l) },
  { id: "banana", level: "medium", emoji: "🍌", label: "A banana",
    hint: 'The word "banana".',
    test: (c) => anyWord(c, ["banana", "bananas"]) || (c.text.includes("🍌") ? "🍌" : null) },
  { id: "millions", level: "medium", emoji: "🔢", label: "A number in the millions",
    hint: "Like 3,000,000 or 7.5 million.",
    test: (c) => firstMatch(c.text, /\b\d{1,3}(?:,\d{3}){2,}\b|\b\d+(?:\.\d+)?\s?(?:million|billion|trillion)\b/i) },
  { id: "bigimage", level: "medium", emoji: "🖼️", label: "A huge image",
    hint: "An image at least 1500 pixels wide.",
    test: (c) => {
      const img = c.images.find((i) => i.naturalWidth >= 1500);
      return img ? `a ${img.naturalWidth}px wide image` : null;
    } },
  { id: "pizza", level: "medium", emoji: "🍕", label: "Pizza",
    hint: 'The word "pizza".',
    test: (c) => anyWord(c, ["pizza", "pizzas"]) || (c.text.includes("🍕") ? "🍕" : null) },

  // ----- hard -----
  { id: "long20", level: "hard", emoji: "🦒", label: "A 20+ letter word",
    hint: "A real word with at least 20 letters.",
    test: (c) => findWord(c, (w) => w.length >= 20) },
  { id: "novowel", level: "hard", emoji: "🎵", label: "A word with no a/e/i/o/u",
    hint: "A word of 5+ letters with only y as a vowel, like rhythm or glyph.",
    test: (c) => findWord(c, (w, l) => l.length >= 5 && /^[a-z]+$/.test(l) && !/[aeiou]/.test(l) && l.includes("y")) },
  { id: "qnou", level: "hard", emoji: "🇶", label: "A Q without a U",
    hint: "A word where q isn't followed by u, like Qatar or Iraq.",
    test: (c) => findWord(c, (w, l) => l.length >= 4 && /q(?!u)/.test(l) && /[aeiou]/.test(l) && l !== "faqs") },
  { id: "frog", level: "hard", emoji: "🐸", label: "A frog",
    hint: 'The word "frog" or "toad", or a picture labeled as a frog.',
    test: (c) => anyWord(c, ["frog", "frogs", "toad", "toads"]) || (c.text.includes("🐸") ? "🐸" : null) || imageLabel(c, /\b(frog|toad)s?\b/i) },
  { id: "temperature", level: "hard", emoji: "🌡️", label: "A temperature",
    hint: "Something like 72°F or 20 °C.",
    test: (c) => firstMatch(c.text, /-?\d+(?:\.\d+)?\s?°\s?[CF]\b/) },
  { id: "japanese", level: "hard", emoji: "🗾", label: "Japanese text",
    hint: "Hiragana or katakana characters.",
    test: (c) => firstMatch(c.text, /[\p{Script=Hiragana}\p{Script=Katakana}]+/u) },
  { id: "cyrillic", level: "hard", emoji: "🪆", label: "Cyrillic text",
    hint: "The alphabet used for Russian, Ukrainian, Bulgarian and more.",
    test: (c) => firstMatch(c.text, /\p{Script=Cyrillic}+/u) },
  { id: "greek", level: "hard", emoji: "🏺", label: "Greek letters",
    hint: "Any Greek letter, like α, β or Ω.",
    test: (c) => firstMatch(c.text, /\p{Script=Greek}+/u) },
  { id: "arabic", level: "hard", emoji: "🕌", label: "Arabic script",
    hint: "Text written in Arabic script.",
    test: (c) => firstMatch(c.text, /\p{Script=Arabic}+/u) },
  { id: "strike", level: "hard", emoji: "✂️", label: "Strikethrough text",
    hint: "Text with a line through it, like an old price.",
    test: () => {
      const el = [...document.querySelectorAll("s, del, strike")].find((e) => e.textContent.trim() && isVisible(e));
      return el ? `"${el.textContent.trim().slice(0, 40)}"` : null;
    } },
  { id: "lorem", level: "hard", emoji: "🧪", label: "Lorem ipsum",
    hint: "Placeholder text someone forgot to replace.",
    test: (c) => firstMatch(c.text, /lorem ipsum/i) },
  { id: "notfound", level: "hard", emoji: "🚫", label: "A 404 page",
    hint: "A \"page not found\" error page.",
    test: (c) => {
      const s = document.title + " " + c.text.slice(0, 3000);
      return /\b404\b/.test(s) && /not found/i.test(s) ? "a 404 page" : null;
    } },
  { id: "audio", level: "hard", emoji: "🎧", label: "An audio player",
    hint: "An <audio> player, like on a podcast page.",
    test: () => (document.querySelector("audio") ? "an audio player" : null) },
  { id: "doubled", level: "hard", emoji: "👯", label: "A word twice in a row",
    hint: 'The same word repeated, like "very very".',
    test: (c) => firstMatch(c.text, /(?<!\p{L})(\p{L}{3,}) \1(?!\p{L})/iu) },
  { id: "dinosaur", level: "hard", emoji: "🦖", label: "A dinosaur",
    hint: 'The word "dinosaur" or a specific dinosaur like triceratops.',
    test: (c) => anyWord(c, ["dinosaur", "dinosaurs", "tyrannosaurus", "velociraptor", "triceratops", "stegosaurus", "brachiosaurus"]) || firstMatch(c.text, /🦖|🦕/u) },
  { id: "bingo", level: "hard", emoji: "🎱", label: 'The word "bingo"',
    hint: "Find bingo in the wild.",
    test: (c) => anyWord(c, ["bingo"]) },
];

const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ---------- cards ----------

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newCard() {
  const picks = Object.entries(PER_LEVEL).flatMap(([level, n]) =>
    shuffle(ITEMS.filter((i) => i.level === level)).slice(0, n).map((i) => i.id)
  );
  const cells = shuffle(picks);
  cells.splice(Math.floor(cells.length / 2), 0, FREE); // free square in the middle
  return { cells, found: {}, createdAt: Date.now(), completedAt: null };
}

const BINGO_LINES = (() => {
  const n = CARD_SIZE, lines = [];
  for (let i = 0; i < n; i++) {
    lines.push([...Array(n)].map((_, j) => i * n + j)); // rows
    lines.push([...Array(n)].map((_, j) => j * n + i)); // columns
  }
  lines.push([...Array(n)].map((_, j) => j * n + j));           // diagonal
  lines.push([...Array(n)].map((_, j) => j * n + (n - 1 - j))); // other diagonal
  return lines;
})();

function isChecked(card, index) {
  const id = card.cells[index];
  return id === FREE || Boolean(card.found[id]);
}

function countBingos(card) {
  return BINGO_LINES.filter((line) => line.every((i) => isChecked(card, i))).length;
}

function foundCount(card) {
  return card.cells.filter((id) => id !== FREE && card.found[id]).length;
}

function squareCount(card) {
  return card.cells.length - 1;
}
