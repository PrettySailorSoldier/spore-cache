// ─── PURPOSE ──────────────────────────────────────────────
// Two jobs:
//   1. Auto-clear completed lines older than 24 hours. Parses the stored HTML,
//      removes stale blocks, saves the cleaned document back.
//   2. Restore the badge count when the browser starts up (badges don't persist
//      across browser restarts).
//
// NOTE: DOMParser is NOT available in service workers (Manifest V3).
// We use regex-based parsing instead.

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

// ─── HTML PARSING HELPERS (no DOMParser in service workers) ───
// Extract all data-id values from a given tag pattern
function extractDataIds(html, tagPattern) {
    const ids = [];
    // Match elements with data-id attribute
    const regex = new RegExp(`<${tagPattern}[^>]*data-id="([^"]*)"[^>]*>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}

// Remove an element with a specific data-id from HTML
function removeElementById(html, id) {
    // Try to remove <li> elements (self-closing or with content)
    let modified = html.replace(
        new RegExp(`<li[^>]*data-id="${id}"[^>]*>.*?</li>`, 'gis'),
        ''
    );
    
    // Try to remove <p> elements
    modified = modified.replace(
        new RegExp(`<p[^>]*data-id="${id}"[^>]*>.*?</p>`, 'gis'),
        ''
    );
    
    // Try to remove <div> elements (be careful with nesting)
    modified = modified.replace(
        new RegExp(`<div[^>]*data-id="${id}"[^>]*>.*?</div>`, 'gis'),
        ''
    );
    
    // Clean up empty <ul> elements
    modified = modified.replace(/<ul[^>]*>\s*<\/ul>/gi, '');
    
    return modified;
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

    // Remove elements with those IDs from the HTML using regex
    let html = doc.html;
    let changed = false;

    idsToRemove.forEach(id => {
        const before = html;
        html = removeElementById(html, id);
        if (html !== before) {
            changed = true;
        }
        delete doc.completed[id];
    });

    if (changed) {
        doc.html = html;
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
// Parses the stored HTML to count active top-level items using regex.
// Same counting rules as popup.js: top-level p/div = 1, ul = 1 if any li is active.
function setBadge(doc) {
    if (!doc || !doc.html) {
        chrome.action.setBadgeText({ text: '' });
        return;
    }

    const completed = doc.completed || {};
    const html = doc.html;
    let count = 0;

    // Count top-level <p> and <div> elements with data-id that are not completed
    const pDivIds = extractDataIds(html, 'p|div');
    pDivIds.forEach(id => {
        if (!completed[id]) count++;
    });

    // Check if there are any <ul> elements with active <li> items
    const ulMatches = html.match(/<ul[^>]*>[\s\S]*?<\/ul>/gi) || [];
    ulMatches.forEach(ulHtml => {
        const liIds = extractDataIds(ulHtml, 'li');
        const hasActive = liIds.some(id => !completed[id]);
        if (hasActive) count++;
    });

    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#5eead4' });
}

// ─── EXTERNAL API ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'addTask') {
        addTaskFromExternal(msg.text, msg.tags)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep channel open
    }
});

async function addTaskFromExternal(text, tags) {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    let doc = result[STORAGE_KEY] || { html: '', completed: {} };
    
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    let tagHtml = '';
    
    const TAG_MAP = {
        urgent: '🔴🍄',
        work: '💼🍄',
        personal: '🏠🍄',
        ideas: '💡🍄',
        waiting: '⏳🍄'
    };
    
    if (tags && Array.isArray(tags)) {
        tags.forEach(t => {
            const emoji = TAG_MAP[t];
            if (emoji) {
                tagHtml += `<span class="spore-tag" data-tag="${t}" contenteditable="false">${emoji} </span>`;
            }
        });
    }
    
    // Basic sanitization of text to prevent breaking HTML structure
    const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const newBlock = `<p data-id="${id}">${tagHtml}${safeText}</p>`;
    
    doc.html += newBlock;
    
    await chrome.storage.local.set({ [STORAGE_KEY]: doc });
    setBadge(doc);
}
