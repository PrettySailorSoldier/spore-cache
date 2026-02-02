// ─── CONFIG ───────────────────────────────────────────────
const STORAGE_KEY = 'sporecache_doc';
const SETTINGS_KEY = 'sporecache_settings';

// ─── DOM REFS ─────────────────────────────────────────────
const editor          = document.getElementById('docEditor');
const checkboxLayer   = document.getElementById('checkboxLayer');
const editorWrapper   = document.getElementById('editorWrapper');
const itemCount       = document.getElementById('itemCount');
const optionsBtn      = document.getElementById('optionsBtn');
const optionsPanel    = document.getElementById('optionsPanel');
const optionsClose    = document.getElementById('optionsClose');
const darkModeToggle  = document.getElementById('darkModeToggle');
const fontSizeSelect  = document.getElementById('fontSizeSelect');
const accentSwatches  = document.getElementById('accentSwatches');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const completedCount  = document.getElementById('completedCount');
const exportBtn       = document.getElementById('exportBtn');

// ─── STATE ────────────────────────────────────────────────
// doc.html      — the editor's innerHTML (blocks with data-id attributes)
// doc.completed — { blockId: completedAtTimestamp, ... }
let doc = { html: '', completed: {} };
let settings = { darkMode: false, fontSize: 13, accent: 'purple' };
let saveTimer = null;

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadDoc();
    await loadSettings();
    applySettings();

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

    // Options panel events
    optionsBtn.addEventListener('click', openOptions);
    optionsClose.addEventListener('click', closeOptions);
    darkModeToggle.addEventListener('change', onDarkModeChange);
    fontSizeSelect.addEventListener('change', onFontSizeChange);
    accentSwatches.addEventListener('click', onAccentClick);
    clearCompletedBtn.addEventListener('click', () => {
        clearCompleted();
        updateCompletedCount();
    });
    exportBtn.addEventListener('click', exportNotes);
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

    // Backspace at start of empty <li> → outdent back to regular line with checkbox
    if (e.key === 'Backspace') {
        const block = getActiveBlock();
        if (block && block.tagName === 'LI') {
            const sel = window.getSelection();
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                // Check if cursor is at the very start of the li
                const atStart = range.collapsed && range.startOffset === 0 && 
                    (range.startContainer === block || range.startContainer === block.firstChild);
                // Or if the li is empty
                const isEmpty = block.textContent.trim() === '';
                if (atStart || isEmpty) {
                    e.preventDefault();
                    outdent();
                    return;
                }
            }
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

        // Skip checkboxes for <li> elements — they have bullet markers instead
        if (block.tagName === 'LI') return;

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

    // Show clear button only when there are completed items (if button exists)
    const hasCompleted = Object.keys(doc.completed).length > 0;
    if (clearBtn) clearBtn.style.display = hasCompleted ? 'inline-block' : 'none';
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

// ─── OPTIONS PANEL ────────────────────────────────────────

function openOptions() {
    optionsPanel.classList.add('open');
    updateCompletedCount();
}

function closeOptions() {
    optionsPanel.classList.remove('open');
}

function updateCompletedCount() {
    const count = Object.keys(doc.completed).length;
    completedCount.textContent = count > 0 ? count : '';
}

// ─── SETTINGS ─────────────────────────────────────────────

async function loadSettings() {
    try {
        const result = await chrome.storage.local.get([SETTINGS_KEY]);
        if (result[SETTINGS_KEY]) {
            settings = { ...settings, ...result[SETTINGS_KEY] };
        }
    } catch (err) {
        console.error('Spore Cache settings load error:', err);
    }
}

function saveSettings() {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch(err => {
        console.error('Spore Cache settings save error:', err);
    });
}

function applySettings() {
    // Dark mode
    document.body.classList.toggle('dark-mode', settings.darkMode);
    darkModeToggle.checked = settings.darkMode;

    // Font size
    editor.style.fontSize = settings.fontSize + 'px';
    fontSizeSelect.value = settings.fontSize;

    // Accent color
    document.body.setAttribute('data-accent', settings.accent);
    document.querySelectorAll('.swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color === settings.accent);
    });
}

function onDarkModeChange(e) {
    settings.darkMode = e.target.checked;
    document.body.classList.toggle('dark-mode', settings.darkMode);
    saveSettings();
}

function onFontSizeChange(e) {
    settings.fontSize = parseInt(e.target.value, 10);
    editor.style.fontSize = settings.fontSize + 'px';
    renderCheckboxes(); // Re-render checkboxes since line heights may have changed
    saveSettings();
}

function onAccentClick(e) {
    const swatch = e.target.closest('.swatch');
    if (!swatch) return;

    settings.accent = swatch.dataset.color;
    document.body.setAttribute('data-accent', settings.accent);

    // Update active state
    document.querySelectorAll('.swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === settings.accent);
    });

    saveSettings();
}

function exportNotes() {
    // Convert editor content to plain text
    const lines = [];
    getAllBlocks().forEach(block => {
        const prefix = block.tagName === 'LI' ? '• ' : '';
        const status = doc.completed[block.dataset.id] ? '[✓] ' : '[ ] ';
        lines.push(status + prefix + block.textContent);
    });

    const text = lines.join('\n');
    
    // Create and download file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spore-cache-notes.txt';
    a.click();
    URL.revokeObjectURL(url);

    // Brief feedback
    exportBtn.textContent = 'Exported!';
    setTimeout(() => {
        exportBtn.textContent = 'Export Notes';
    }, 1500);
}
