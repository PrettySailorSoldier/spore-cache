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
