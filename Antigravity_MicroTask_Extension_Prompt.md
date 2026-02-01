# Antigravity Prompt — Spore Cache


## What You're Building

A Chrome/Chromium browser extension (Manifest V3) that acts as a quick-capture notes pad. Open it, type, it saves. The popup is a single continuous document — not a list of discrete task cards. You can bold, italicize, and indent lines into bullets with Tab. Each line has a faint checkbox in the left margin that appears on hover; checking it dims the line. A "clear" button on the bottom bar sweeps away all checked lines.

The extension looks and feels like a small plastic handheld device — a Tamagotchi aesthetic. The outer casing is a warm orange-to-green gradient with a grain texture simulating molded plastic. Inside sits a teal "screen" panel where the document lives. Mushroom and moth illustrations are layered across the corners. The bottom of the casing has a bar with a moth as its centerpiece and a retro clear button that appears to its left only when there are completed lines to sweep away.

---

## Architecture Decisions

- **Vanilla HTML/CSS/JS, no build tool.** Small enough that a bundler adds complexity with zero benefit.
- **Single contenteditable div.** The entire screen is one editable document. No task input field, no discrete cards. The browser handles Enter (new block). We intercept Tab (indent → bullet), Shift+Tab (outdent → plain line), and Ctrl+B / Ctrl+I (bold / italic). Those two use `document.execCommand` — this API is technically deprecated but remains the only lightweight option for formatting inside contenteditable without pulling in a full editor library. It works in all current browsers.
- **Checkboxes live outside the contenteditable.** They are absolutely positioned in a transparent layer behind the editor's left padding, aligned to each block's vertical position by JS after every input event. This avoids the cursor bugs and selection weirdness that come from putting interactive elements inside contenteditable.
- **`chrome.storage.local` only.** Storage holds two things: the document HTML and a completion map (block ID → timestamp when completed). No backend, no account.
- **Badge counts top-level active lines only.** A plain line = 1 item. A bullet list = 1 item (as long as at least one bullet inside it is unchecked). Sub-bullets don't inflate the count.
- **Service worker (`background.js`)** auto-clears completed lines older than 24 hours by parsing the stored HTML with DOMParser, removing old blocks, and saving back. It also restores the badge on browser startup.
- **Paste is forced to plain text.** The paste handler strips all HTML from clipboard content before inserting. This prevents injection of scripts or malicious elements from external sources.

---

## File Structure

```
spore-cache/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
├── assets/
│   ├── mushroom-top-left.png
│   ├── mushroom-top-right.png
│   ├── moth-mushroom-right.png
│   └── moth-bottom.png
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

The four PNGs in `assets/` are illustration exports with transparent backgrounds. Icons: use any placeholder PNGs (16x16, 48x48, 128x128) for dev mode testing.

---

## Storage Schema

Single key in `chrome.storage.local`:

**Key: `sporecache_doc`**

```json
{
  "html": "<p data-id=\"kx3a2b\">pick up groceries</p><ul><li data-id=\"m7c9d1\">get oat milk</li><li data-id=\"p2e4f8\">bread</li></ul><p data-id=\"q5r6s9\">call the dentist</p>",
  "completed": {
    "m7c9d1": 1706000005000,
    "q5r6s9": 1706000010000
  }
}
```

**`html`** — the raw innerHTML of the editor. Every block element (`<p>`, `<div>`, or `<li>`) has a `data-id` attribute. The HTML does NOT contain any checkbox elements — those are created and positioned by JS at runtime and are never persisted.

**`completed`** — a map of block ID to epoch ms timestamp. If a block's ID is present here, it is completed and the value is when it was completed (used by auto-clear to know when 24 hours have passed). If absent, the block is active.

Why this split: the background service worker can check completion timestamps and remove old blocks without needing to understand the full DOM. It just reads the map, finds stale IDs, removes those elements from the HTML string, and saves back.

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| `--casing-orange` | `#e8934a` | Casing gradient endpoint |
| `--casing-green` | `#6aaa80` | Casing gradient endpoint |
| `--screen-bg` | `#a3d9c8` | Teal screen background |
| `--screen-shadow` | `rgba(0, 60, 50, 0.25)` | Inner shadow on screen (depth) |
| `--text` | `#1e3d38` | Primary text on screen |
| `--text-dim` | `rgba(30, 61, 56, 0.55)` | Placeholders, counts |
| `--check-color` | `#3d8a6e` | Checkbox border (unchecked) |
| `--check-fill` | `#5cb88a` | Checkbox fill (checked) |
| `--danger` | `#d45a5a` | Clear button |
| `--title-color` | `#6b3fa0` | Extension name in header |

---

## Files — Create Exactly As Written

---

### `manifest.json`

```json
{
  "name": "Spore Cache",
  "version": "1.0.0",
  "description": "Capture quick tasks before your brain drops them.",
  "manifest_version": 3,
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "permissions": [
    "storage",
    "alarms"
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "commands": {
    "_execute_action": {
      "suggested": "Ctrl+Shift+M",
      "description": "Open Spore Cache"
    }
  }
}
```

**Permission notes:**
- `storage` — read/write document data locally.
- `alarms` — lets the service worker run a periodic job to auto-clear old completed lines.
- No `activeTab`, no `tabs`, no `host_permissions`. Minimal footprint.

**`_execute_action`** is a Chrome-reserved command that opens the popup. `Ctrl+Shift+M` is a suggestion — Chrome lets users remap it at `chrome://extensions/shortcuts`. `M` was chosen because S and C collide with Chrome defaults.

---

### `popup.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spore Cache</title>
    <link rel="stylesheet" href="popup.css">
</head>
<body>

    <!-- SVG noise filter for grain/plastic texture on casing. Invisible — defines the filter ID only. -->
    <svg width="0" height="0" style="position:absolute">
        <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
        </filter>
    </svg>

    <div class="casing">

        <!-- Grain overlay — uses the SVG filter above to simulate plastic texture -->
        <div class="grain"></div>

        <!-- Decorative illustrations. Positioned absolutely over casing edges.
             alt="" because they are purely decorative. -->
        <img src="assets/mushroom-top-left.png"   class="deco deco-mushroom-tl"     alt="">
        <img src="assets/mushroom-top-right.png"  class="deco deco-mushroom-tr"     alt="">
        <img src="assets/moth-mushroom-right.png" class="deco deco-moth-mushroom-r" alt="">

        <!-- The screen — teal panel where all interaction happens -->
        <div class="screen">

            <div class="screen-header">
                <h1 class="title">Spore Cache</h1>
                <span class="item-count" id="itemCount">all clear</span>
            </div>

            <!--
                Editor wrapper. Contains two things that must scroll together:
                  1. checkbox-layer — absolutely positioned checkboxes that float
                     in the left margin. Created and positioned by popup.js.
                     NOT inside the contenteditable.
                  2. docEditor — the contenteditable document. Has left padding
                     to leave room for the checkboxes.
                The wrapper is the scroll container so both layers move as one unit.
            -->
            <div class="editor-wrapper" id="editorWrapper">
                <div class="checkbox-layer" id="checkboxLayer"></div>
                <div
                    class="editor"
                    id="docEditor"
                    contenteditable="true"
                    spellcheck="false"
                    aria-label="Your notes"
                ></div>
            </div>

        </div>

        <!-- Bottom bar. Moth is always visible as the device's face.
             Clear button appears to its left only when completed lines exist. -->
        <div class="bottom-bar">
            <button class="clear-btn" id="clearCompleted" aria-label="Clear all completed lines">clear</button>
            <img src="assets/moth-bottom.png" class="bottom-moth" alt="">
        </div>

    </div>

    <script src="popup.js"></script>
</body>
</html>
```

---

### `popup.css`

```css
/* ─── RESET & ROOT ─────────────────────────────────────── */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --casing-orange: #e8934a;
    --casing-green: #6aaa80;
    --screen-bg: #a3d9c8;
    --screen-shadow: rgba(0, 60, 50, 0.25);
    --text: #1e3d38;
    --text-dim: rgba(30, 61, 56, 0.55);
    --check-color: #3d8a6e;
    --check-fill: #5cb88a;
    --danger: #d45a5a;
    --title-color: #6b3fa0;
    --radius-casing: 22px;
    --radius-screen: 14px;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    width: 320px;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
}

/* ─── CASING (the plastic device body) ─────────────────── */

.casing {
    position: relative;
    width: 100%;
    min-height: 460px;
    max-height: 540px;
    background: linear-gradient(
        155deg,
        #d4734a 0%,
        #cca050 18%,
        #8aba7e 38%,
        #6aaa80 55%,
        #88b070 72%,
        #d08850 88%,
        #e8934a 100%
    );
    border-radius: var(--radius-casing);
    padding: 14px 14px 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* ─── GRAIN TEXTURE ────────────────────────────────────── */
/* Renders SVG fractal noise over the casing to simulate molded plastic.
   pointer-events: none so it never blocks clicks on anything underneath. */

.grain {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-casing);
    filter: url(#noise);
    opacity: 0.13;
    pointer-events: none;
    z-index: 999;
}

/* ─── DECORATIVE ILLUSTRATIONS ─────────────────────────── */
/* Positioned absolutely. They intentionally overlap the screen edges.
   pointer-events: none so they never block input or clicks. */

.deco {
    position: absolute;
    z-index: 2;
    pointer-events: none;
}

.deco-mushroom-tl {
    top: -10px;
    left: -14px;
    width: 168px;
}

.deco-mushroom-tr {
    top: -8px;
    right: -12px;
    width: 148px;
}

.deco-moth-mushroom-r {
    top: 155px;
    right: -16px;
    width: 138px;
}

/* ─── SCREEN (the teal panel) ──────────────────────────── */

.screen {
    position: relative;
    z-index: 1;
    background: var(--screen-bg);
    border-radius: var(--radius-screen);
    padding: 14px 16px 12px;
    box-shadow:
        inset 0 2px 8px var(--screen-shadow),
        0 3px 5px rgba(0, 0, 0, 0.18);
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 280px;
    overflow: hidden;
}

/* ─── SCREEN HEADER ────────────────────────────────────── */

.screen-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
    flex-shrink: 0;
}

.title {
    font-size: 12px;
    font-weight: 700;
    color: var(--title-color);
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.item-count {
    font-size: 9.5px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
}

/* ─── EDITOR WRAPPER ───────────────────────────────────── */
/* Scrollable container that holds both the checkbox layer and the editor.
   They scroll as one unit so checkboxes stay aligned with their lines. */

.editor-wrapper {
    position: relative;
    flex: 1;
    overflow-y: auto;
    min-height: 0; /* lets flex child shrink and scroll */
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 60, 50, 0.2) transparent;
}

.editor-wrapper::-webkit-scrollbar {
    width: 3px;
}

.editor-wrapper::-webkit-scrollbar-thumb {
    background: rgba(0, 60, 50, 0.22);
    border-radius: 2px;
}

/* ─── CHECKBOX LAYER ───────────────────────────────────── */
/* Absolutely positioned layer covering the left margin of the editor.
   Individual checkboxes are created here by JS with top: Xpx positioning.
   The layer itself does not capture clicks — only the individual checkboxes do. */

.checkbox-layer {
    position: absolute;
    left: 0;
    top: 0;
    width: 26px;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}

/* Each checkbox — created by popup.js, positioned with inline top style */
.line-checkbox {
    position: absolute;
    left: 2px;
    width: 18px;
    height: 18px;
    border: 2px solid var(--check-color);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
    pointer-events: auto; /* individual checkboxes capture clicks */
    opacity: 0.2;
    transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.line-checkbox:hover {
    opacity: 0.7;
}

.line-checkbox.checked {
    background: var(--check-fill);
    border-color: var(--check-fill);
    opacity: 1;
}

/* Checkmark inside a checked checkbox */
.line-checkbox.checked::after {
    content: '✓';
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    line-height: 1;
}

/* ─── EDITOR (the contenteditable document) ────────────── */

.editor {
    position: relative;
    padding-left: 26px; /* room for checkboxes in the margin */
    padding-right: 2px;
    min-height: 100%;
    outline: none;
    color: var(--text);
    font-size: 13px;
    line-height: 1.6;
}

/* Placeholder text when editor is empty. Toggled via .is-empty class by JS. */
.editor.is-empty::before {
    content: 'nothing on your plate ✨';
    color: var(--text-dim);
    font-size: 13px;
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 26px;
}

/* Block elements — p and div (Chrome sometimes uses div on Enter) */
.editor p,
.editor div[data-id] {
    margin: 2px 0;
    min-height: 1.6em; /* empty lines still have height so their checkbox can align */
}

/* Bullet lists */
.editor ul {
    list-style: disc;
    padding-left: 20px;
    margin: 1px 0;
}

.editor li {
    margin: 2px 0;
    min-height: 1.6em;
}

/* Completed lines — .completed class is toggled by JS via renderCheckboxes() */
.editor p.completed,
.editor div.completed,
.editor li.completed {
    opacity: 0.35;
}

/* Bold and italic — created by execCommand('bold') / execCommand('italic') */
.editor b,
.editor strong {
    font-weight: 700;
}

.editor i,
.editor em {
    font-style: italic;
    color: rgba(30, 61, 56, 0.8);
}

/* ─── BOTTOM BAR ───────────────────────────────────────── */

.bottom-bar {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 78px;
    margin-top: 2px;
    flex-shrink: 0;
}

.bottom-moth {
    height: 68px;
    width: auto;
    position: relative;
    z-index: 1;
    pointer-events: none;
}

/* ─── CLEAR BUTTON (retro pill style) ──────────────────── */
/* Hidden by default. popup.js sets display: inline-block when completed lines exist. */

.clear-btn {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: #d45a5a;
    border: 2px solid #a03030;
    color: #fff;
    font-size: 9px;
    font-family: 'Courier New', monospace;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    padding: 5px 11px;
    border-radius: 4px;
    cursor: pointer;
    display: none;
    box-shadow: 0 2px 0 #7a2020;
    transition: background 0.1s ease, transform 0.1s ease, box-shadow 0.1s ease;
}

.clear-btn:hover {
    background: #e06565;
}

.clear-btn:active {
    transform: translateY(calc(-50% + 2px));
    box-shadow: 0 0px 0 #7a2020;
}
```

---

### `popup.js`

```javascript
// ─── CONFIG ───────────────────────────────────────────────
const STORAGE_KEY = 'sporecache_doc';

// ─── DOM REFS ─────────────────────────────────────────────
const editor        = document.getElementById('docEditor');
const checkboxLayer = document.getElementById('checkboxLayer');
const editorWrapper = document.getElementById('editorWrapper');
const itemCount     = document.getElementById('itemCount');
const clearBtn      = document.getElementById('clearCompleted');

// ─── STATE ────────────────────────────────────────────────
// doc.html      — the editor's innerHTML (blocks with data-id attributes)
// doc.completed — { blockId: completedAtTimestamp, ... }
let doc = { html: '', completed: {} };
let saveTimer = null;

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadDoc();

    editor.innerHTML = doc.html;
    syncBlocks();
    renderCheckboxes();
    updateHeader();
    updateBadge();
    toggleEmptyState();
    focusEnd();

    editor.addEventListener('input',  onInput);
    editor.addEventListener('keydown', onKeyDown);
    editor.addEventListener('paste',   onPaste);
    clearBtn.addEventListener('click', clearCompleted);
});

// ─── INPUT HANDLER ────────────────────────────────────────
// Runs after every keystroke or content change in the editor.
function onInput() {
    syncBlocks();
    renderCheckboxes();
    updateHeader();
    updateBadge();
    toggleEmptyState();
    debounceSave();
}

// ─── PASTE HANDLER ────────────────────────────────────────
// Forces all paste to plain text. This strips any HTML, scripts, or
// event handlers from clipboard content before it enters the editor.
function onPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
}

// ─── KEYDOWN HANDLER ──────────────────────────────────────
function onKeyDown(e) {
    // Bold — Ctrl/Cmd + B
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
        return;
    }

    // Italic — Ctrl/Cmd + I
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
        return;
    }

    // Tab → indent current line into a bullet
    if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        indent();
        return;
    }

    // Shift+Tab → outdent bullet back to plain line
    if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        outdent();
        return;
    }

    // Enter on an empty <li> → outdent automatically (matches Apple Notes behavior)
    if (e.key === 'Enter') {
        const block = getActiveBlock();
        if (block && block.tagName === 'LI' && block.textContent.trim() === '') {
            e.preventDefault();
            outdent();
            return;
        }
    }
}

// ─── INDENT: convert current p/div into a ul > li ─────────
// If the previous sibling is already a <ul>, the new bullet is appended
// to that list instead of creating a new one. This keeps consecutive
// bullets in the same <ul>.
function indent() {
    const block = getActiveBlock();
    if (!block) return;
    if (block.tagName === 'LI') return;          // already a bullet — only one indent level at MVP
    if (block.parentElement !== editor) return;   // safety: must be a top-level block

    const id = block.dataset.id || generateId();

    const li = document.createElement('li');
    li.dataset.id = id;
    li.innerHTML = block.innerHTML;
    if (doc.completed[id]) li.classList.add('completed');

    // Check if previous sibling is a <ul> — append to it to keep the list contiguous
    const prev = block.previousElementSibling;
    if (prev && prev.tagName === 'UL') {
        prev.appendChild(li);
        block.remove();
    } else {
        const ul = document.createElement('ul');
        ul.appendChild(li);
        block.replaceWith(ul);
    }

    setCursorEnd(li);
    onInput();
}

// ─── OUTDENT: convert current li back to a plain p ────────
// Handles list splitting correctly: if the outdented bullet was in the
// middle of a list, the list is split into two <ul> elements with the
// new <p> between them. Order is preserved.
function outdent() {
    const block = getActiveBlock();
    if (!block || block.tagName !== 'LI') return;

    const ul = block.parentElement;
    const id = block.dataset.id || generateId();

    const p = document.createElement('p');
    p.dataset.id = id;
    p.innerHTML = block.innerHTML;
    if (doc.completed[id]) p.classList.add('completed');

    if (ul.children.length === 1) {
        // Only item in the list — replace the entire <ul> with the <p>
        ul.replaceWith(p);
    } else {
        // Split the list at this bullet's position to preserve order
        const items  = Array.from(ul.children);
        const idx    = items.indexOf(block);
        const before = items.slice(0, idx);
        const after  = items.slice(idx + 1);

        const fragment = document.createDocumentFragment();

        if (before.length > 0) {
            const ulBefore = document.createElement('ul');
            before.forEach(li => ulBefore.appendChild(li));
            fragment.appendChild(ulBefore);
        }

        fragment.appendChild(p);

        if (after.length > 0) {
            const ulAfter = document.createElement('ul');
            after.forEach(li => ulAfter.appendChild(li));
            fragment.appendChild(ulAfter);
        }

        ul.replaceWith(fragment);
    }

    setCursorEnd(p);
    onInput();
}

// ─── SYNC BLOCKS ──────────────────────────────────────────
// Ensures every block in the editor has a data-id attribute.
// Runs after every input event to catch new blocks Chrome creates on Enter,
// new <li> elements created inside a <ul>, or bare text nodes.
function syncBlocks() {
    Array.from(editor.childNodes).forEach(node => {
        // Bare text node — Chrome sometimes creates these. Wrap in <p>.
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.trim() === '') return; // skip whitespace-only
            const p = document.createElement('p');
            p.dataset.id = generateId();
            p.textContent = node.textContent;
            node.replaceWith(p);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Top-level p or div — give it an ID if it doesn't have one
        if (node.tagName === 'P' || node.tagName === 'DIV') {
            if (!node.dataset.id) node.dataset.id = generateId();
        }

        // ul — give each li an ID
        if (node.tagName === 'UL') {
            node.querySelectorAll('li').forEach(li => {
                if (!li.dataset.id) li.dataset.id = generateId();
            });
        }
    });
}

// ─── RENDER CHECKBOXES ────────────────────────────────────
// Clears and rebuilds all checkboxes after every input.
// Also applies/removes the .completed class on each block for visual dimming.
//
// Position math:
//   blockRect.top - wrapperRect.top  → block's position relative to wrapper's visible top
//   + editorWrapper.scrollTop        → converts to position relative to wrapper's content top
//                                      (accounts for how far the wrapper has scrolled)
//   + blockRect.height / 2           → centers vertically on the block
//   - 9                              → half of checkbox height (18px) to center the checkbox
//
// Since the checkbox-layer is absolutely positioned inside the wrapper and scrolls
// with it, the calculated top value stays correct regardless of scroll position.
function renderCheckboxes() {
    checkboxLayer.innerHTML = '';

    const wrapperRect = editorWrapper.getBoundingClientRect();

    getAllBlocks().forEach(block => {
        const id = block.dataset.id;
        if (!id) return;

        // Apply or remove completed styling on the block
        block.classList.toggle('completed', !!doc.completed[id]);

        // Calculate vertical position
        const blockRect = block.getBoundingClientRect();
        const top = (blockRect.top - wrapperRect.top) + editorWrapper.scrollTop + (blockRect.height / 2) - 9;

        // Create and position the checkbox
        const cb = document.createElement('div');
        cb.className = 'line-checkbox' + (doc.completed[id] ? ' checked' : '');
        cb.style.top = top + 'px';
        cb.dataset.id = id;
        cb.addEventListener('click', () => toggleCompletion(id));

        checkboxLayer.appendChild(cb);
    });
}

// ─── TOGGLE COMPLETION ────────────────────────────────────
function toggleCompletion(id) {
    if (doc.completed[id]) {
        delete doc.completed[id];   // uncomplete
    } else {
        doc.completed[id] = Date.now();  // complete — store timestamp
    }
    renderCheckboxes();
    updateHeader();
    updateBadge();
    saveDoc();  // immediate save on completion toggle, no debounce
}

// ─── CLEAR COMPLETED ──────────────────────────────────────
// Removes all completed blocks from the editor and cleans up the completed map.
function clearCompleted() {
    getAllBlocks().forEach(block => {
        const id = block.dataset.id;
        if (!doc.completed[id]) return;  // skip active blocks

        if (block.tagName === 'LI') {
            const ul = block.parentElement;
            block.remove();
            if (ul && ul.children.length === 0) ul.remove(); // remove empty <ul>
        } else {
            block.remove();
        }
        delete doc.completed[id];
    });

    renderCheckboxes();
    updateHeader();
    updateBadge();
    toggleEmptyState();
    saveDoc();
}

// ─── UPDATE HEADER ────────────────────────────────────────
// Counts active items for the header text and shows/hides the clear button.
// Counting rules:
//   - Each top-level p or div = 1 item (if not completed)
//   - Each ul = 1 item (if it contains at least one non-completed li)
//   - Individual li elements do not count separately
function updateHeader() {
    let activeCount = 0;

    Array.from(editor.children).forEach(el => {
        if ((el.tagName === 'P' || el.tagName === 'DIV') && el.dataset.id) {
            if (!doc.completed[el.dataset.id]) activeCount++;
        }
        if (el.tagName === 'UL') {
            const hasActiveLi = Array.from(el.querySelectorAll('li')).some(
                li => li.dataset.id && !doc.completed[li.dataset.id]
            );
            if (hasActiveLi) activeCount++;
        }
    });

    itemCount.textContent = activeCount > 0
        ? `${activeCount} item${activeCount !== 1 ? 's' : ''}`
        : 'all clear';

    // Show clear button only when there are completed items
    const hasCompleted = Object.keys(doc.completed).length > 0;
    clearBtn.style.display = hasCompleted ? 'inline-block' : 'none';
}

// ─── BADGE ────────────────────────────────────────────────
// Same counting logic as updateHeader. Writes to the extension icon badge.
function updateBadge() {
    let activeCount = 0;

    Array.from(editor.children).forEach(el => {
        if ((el.tagName === 'P' || el.tagName === 'DIV') && el.dataset.id) {
            if (!doc.completed[el.dataset.id]) activeCount++;
        }
        if (el.tagName === 'UL') {
            const hasActiveLi = Array.from(el.querySelectorAll('li')).some(
                li => li.dataset.id && !doc.completed[li.dataset.id]
            );
            if (hasActiveLi) activeCount++;
        }
    });

    chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#5eead4' });
}

// ─── EMPTY STATE ──────────────────────────────────────────
// Toggles a CSS class that renders placeholder text via ::before pseudo-element.
function toggleEmptyState() {
    editor.classList.toggle('is-empty', editor.innerText.trim() === '');
}

// ─── PERSISTENCE ──────────────────────────────────────────

async function loadDoc() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        doc = result[STORAGE_KEY] || { html: '', completed: {} };
        if (!doc.completed) doc.completed = {};
    } catch (err) {
        console.error('Spore Cache load error:', err);
        doc = { html: '', completed: {} };
    }
}

// Immediate save. Used after completion toggles and clear.
function saveDoc() {
    doc.html = editor.innerHTML;
    chrome.storage.local.set({ [STORAGE_KEY]: doc }).catch(err => {
        console.error('Spore Cache save error:', err);
    });
}

// Debounced save. Used on input events to avoid writing storage on every keystroke.
function debounceSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDoc(), 400);
}

// ─── UTILS ────────────────────────────────────────────────

// Returns the block element (p, div, or li) the cursor is currently inside.
function getActiveBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE &&
            (node.tagName === 'P' || node.tagName === 'DIV' || node.tagName === 'LI')) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

// Returns all block elements in document order (p, div, and li).
function getAllBlocks() {
    const blocks = [];
    Array.from(editor.children).forEach(el => {
        if (el.tagName === 'P' || el.tagName === 'DIV') blocks.push(el);
        if (el.tagName === 'UL') {
            el.querySelectorAll('li').forEach(li => blocks.push(li));
        }
    });
    return blocks;
}

// Generates a unique ID for a block.
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Moves the cursor to the end of a specific element.
function setCursorEnd(el) {
    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

// Moves the cursor to the very end of the editor (last position in the document).
// Called on popup open so the user can keep adding without clicking.
function focusEnd() {
    editor.focus();
    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}
```

---

### `background.js`

```javascript
// ─── PURPOSE ──────────────────────────────────────────────
// Two jobs:
//   1. Auto-clear completed lines older than 24 hours. Parses the stored HTML,
//      removes stale blocks, saves the cleaned document back.
//   2. Restore the badge count when the browser starts up (badges don't persist
//      across browser restarts).

const STORAGE_KEY = 'sporecache_doc';
const ALARM_NAME  = 'autoClear';
const CLEAR_AFTER = 24 * 60 * 60 * 1000; // 24 hours in ms

// ─── ALARM SETUP ──────────────────────────────────────────
// Alarm is created on install and re-ensured on every service worker activation.
// Chrome aggressively terminates and restarts service workers, so this covers
// the case where the alarm was lost during termination.

chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); });
ensureAlarm();

function ensureAlarm() {
    chrome.alarms.get(ALARM_NAME, (existing) => {
        if (!existing) {
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
        }
    });
}

// ─── AUTO-CLEAR ───────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const doc = result[STORAGE_KEY];
    if (!doc || !doc.html || !doc.completed) return;

    const now = Date.now();

    // Find completed IDs that are older than 24 hours
    const idsToRemove = Object.entries(doc.completed)
        .filter(([id, completedAt]) => completedAt && (now - completedAt) > CLEAR_AFTER)
        .map(([id]) => id);

    if (idsToRemove.length === 0) return;

    // Parse the HTML to remove those blocks from the document
    const parser  = new DOMParser();
    const tempDoc = parser.parseFromString(`<div id="root">${doc.html}</div>`, 'text/html');
    const root    = tempDoc.getElementById('root');
    let changed   = false;

    idsToRemove.forEach(id => {
        const block = root.querySelector(`[data-id="${id}"]`);
        if (block) {
            if (block.tagName === 'LI') {
                const ul = block.parentElement;
                block.remove();
                if (ul && ul.children.length === 0) ul.remove(); // clean up empty <ul>
            } else {
                block.remove();
            }
        }
        delete doc.completed[id];
        changed = true;
    });

    if (changed) {
        doc.html = root.innerHTML;
        await chrome.storage.local.set({ [STORAGE_KEY]: doc });
        setBadge(doc);
    }
});

// ─── BADGE ON STARTUP ─────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    setBadge(result[STORAGE_KEY]);
});

// ─── BADGE HELPER ─────────────────────────────────────────
// Parses the stored HTML to count active top-level items.
// Same counting rules as popup.js: top-level p/div = 1, ul = 1 if any li is active.
function setBadge(doc) {
    if (!doc || !doc.html) {
        chrome.action.setBadgeText({ text: '' });
        return;
    }

    const parser    = new DOMParser();
    const tempDoc   = parser.parseFromString(`<div id="root">${doc.html}</div>`, 'text/html');
    const root      = tempDoc.getElementById('root');
    const completed = doc.completed || {};
    let count       = 0;

    Array.from(root.children).forEach(el => {
        if ((el.tagName === 'P' || el.tagName === 'DIV') && el.dataset.id) {
            if (!completed[el.dataset.id]) count++;
        }
        if (el.tagName === 'UL') {
            const hasActive = Array.from(el.querySelectorAll('li')).some(
                li => li.dataset.id && !completed[li.dataset.id]
            );
            if (hasActive) count++;
        }
    });

    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#5eead4' });
}
```

---

## Testing Checklist

Run through every one of these after building. Check them off.

- [ ] **Focus on open** — Open popup. Cursor is at the end of the document. You did not click anything.
- [ ] **Type and save** — Type a line. Close popup. Reopen. The line is still there.
- [ ] **New line on Enter** — Press Enter. A new line is created. Cursor moves to it.
- [ ] **Bold** — Select some text, press Ctrl+B. It goes bold. Press Ctrl+B again on the same selection. Bold is removed.
- [ ] **Italic** — Same as bold but Ctrl+I.
- [ ] **Indent to bullet** — Place cursor in a plain line. Press Tab. It becomes a bulleted list item with a visible bullet point.
- [ ] **Consecutive bullets merge** — Indent a second line that is directly below an existing bullet. It should join the same `<ul>`, not create a separate list.
- [ ] **Outdent bullet** — Place cursor in a bullet. Press Shift+Tab. It becomes a plain line again.
- [ ] **Outdent preserves order** — In a list of 3 bullets, outdent the middle one. The order should be: bullet 1, plain line (was bullet 2), bullet 3. Nothing jumps.
- [ ] **Enter on empty bullet outdents** — In a bullet, press Enter to create a new bullet. Leave it empty. Press Enter again. It converts back to a plain line.
- [ ] **Checkboxes appear on hover** — Hover over a line. A faint checkbox appears in the left margin. Move mouse away. It fades.
- [ ] **Checked checkboxes stay visible** — Check a line. Its checkbox stays fully visible (green with ✓) even when not hovering.
- [ ] **Completing a line dims it** — Click a checkbox. The line fades to low opacity.
- [ ] **Uncompleting a line** — Click a checked checkbox again. The line returns to full opacity.
- [ ] **Badge updates on completion** — Add two lines. Badge shows 2. Check one. Badge shows 1. Check both. Badge disappears.
- [ ] **Bullet list counts as one item** — Add a plain line, indent it to a bullet. Badge shows 1. Add a second bullet under it. Badge still shows 1. Complete one bullet. Badge still shows 1 (one active bullet remains). Complete both. Badge disappears.
- [ ] **Header count matches badge** — The "X items" text always matches the badge number.
- [ ] **Clear button appears** — Check any line. The red "CLEAR" button appears to the left of the bottom moth.
- [ ] **Clear button works** — Click clear. All checked lines are removed. Button disappears.
- [ ] **Clear removes empty lists** — Check all bullets in a list and click clear. The entire `<ul>` should be removed — no orphan bullet marker left behind.
- [ ] **Empty state** — Clear everything until the document is empty. The placeholder "nothing on your plate ✨" appears. Start typing. It disappears.
- [ ] **Paste is plain text only** — Copy some HTML from a webpage (e.g. a bold heading). Paste into the editor. It should appear as plain unstyled text, not formatted HTML.
- [ ] **Multi-line paste** — Copy multiple lines to clipboard. Paste. Each line becomes its own block in the document.
- [ ] **Illustrations don't block interaction** — The mushroom/moth illustrations overlap the screen edges. Clicking or typing in those overlap zones should work normally.
- [ ] **Grain texture visible** — The casing background has visible noise/grain simulating plastic.
- [ ] **Screen has depth** — The teal screen panel has a visible inner shadow along the top, making it look recessed.
- [ ] **Bottom moth always visible** — The moth is there regardless of document state. Never disappears.
- [ ] **Keyboard shortcut** — Press Ctrl+Shift+M. Popup opens.
- [ ] **Auto-clear (manual test)** — In `background.js`, temporarily change `CLEAR_AFTER` to `1000` (1 second). Check a line, close popup, wait 2 seconds, reopen. The checked line should be gone. Change the value back to `24 * 60 * 60 * 1000` when done.

---

## What Comes Next (Phase 3 — not in this build)

Do not implement these yet. They are noted so nothing falls off the radar.

- **Categories / color tags** — Emoji prefix system to visually group lines (e.g. 🛒 for errands, 📞 for calls). Could live as a toolbar or slash-command.
- **Toolbar for formatting** — A small floating or fixed toolbar with B / I / bullet buttons for users who don't use keyboard shortcuts.
- **Pro tier groundwork** — The single change when ready to monetize: add `chrome.storage.sync` as an opt-in behind a toggle. That's the paywall line. Everything else stays free and local forever.
