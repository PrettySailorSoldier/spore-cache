╔══════════════════════════════════════════════════════════════════╗
║  SPORE CACHE — RESIZE & ASSET SWAP FOR ANTIGRAVITY              ║
╚══════════════════════════════════════════════════════════════════╝

You are updating the Spore Cache Chrome extension popup to match a
provided mockup. The current build is too large and the decorative
assets are oversized and overlapping the screen. This prompt covers
three things: (1) rename/add asset files, (2) one HTML change,
(3) the full CSS rewrite for body, casing, decos, and screen sizing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1 — ASSET FILE RENAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy the uploaded PNGs into assets/ with these exact names:

  9.png   →  assets/mushroom-top-left.png
  10.png  →  assets/mushroom-top-right.png
  11.png  →  assets/moth-mushroom-right.png
  12.png  →  assets/moth-top-center.png       ← NEW file, not in old build
  13.png  →  assets/moth-bottom.png

The old asset files are fully replaced. Delete the old PNGs after copying.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 2 — popup.html CHANGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

There are currently 3 deco <img> tags inside .casing. You need to
ADD a fourth one — the moth-top-center — and also move moth-bottom
OUT of the bottom-bar div and INTO the deco group so it can be
absolutely positioned like the others.

Replace the entire deco + bottom section of popup.html (from the
first deco <img> through the closing </div> of .bottom-bar) with:

```html
        <!-- Decorative illustrations. All sit on the casing shell.
             Mushrooms grow outward off corners. Moths sit on bezel strips.
             None touch the screen. -->
        <img src="assets/mushroom-top-left.png"    class="deco deco-mushroom-tl"      alt="">
        <img src="assets/mushroom-top-right.png"   class="deco deco-mushroom-tr"      alt="">
        <img src="assets/moth-top-center.png"      class="deco deco-moth-top"         alt="">
        <img src="assets/moth-mushroom-right.png"  class="deco deco-moth-mushroom-r"  alt="">
        <img src="assets/moth-bottom.png"          class="deco deco-moth-bottom"      alt="">

        <!-- The screen — teal panel where all interaction happens -->
        <div class="screen">
            <!-- (screen contents stay exactly as they are — header, editor-wrapper, etc.) -->
        </div>

        <!-- Bottom bar. Clear button only — moth is now positioned as a .deco above. -->
        <div class="bottom-bar">
            <button class="clear-btn" id="clearCompleted" aria-label="Clear all completed lines">clear</button>
        </div>
```

Do NOT change anything inside .screen or .editor-wrapper. Leave popup.js alone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 3 — popup.css VALUES TO CHANGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only the sections listed below change. Leave checkbox-layer,
line-checkbox, editor, editor-wrapper, clear-btn exactly as they are.

─── 3a. body ────────────────────────────────────────────────────

```css
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    width: 340px;
    padding: 32px 18px 18px;   /* top is tallest — mushrooms grow upward */
    overflow: visible;
    -webkit-font-smoothing: antialiased;
    background: #1e1e2e;
    perspective: 1200px;
}
```

Why: The 340px body is wider than the 304px casing inside it. The
padding on each side is the air mushrooms grow into. Chrome popup
auto-sizes to body content, so nothing clips. overflow: visible is
required — hidden would eat the mushrooms.

─── 3b. .casing ─────────────────────────────────────────────────

```css
.casing {
    position: relative;
    width: 100%;                /* fills body minus padding = 304px */
    height: 380px;              /* FIXED height, not min/max */
    background:
        linear-gradient(
            160deg,
            rgba(255,255,255,0.22) 0%,
            rgba(255,255,255,0.06) 30%,
            transparent 55%
        ),
        linear-gradient(
            155deg,
            #d4734a 0%,
            #cca050 18%,
            #8aba7e 38%,
            #6aaa80 55%,
            #88b070 72%,
            #d08850 88%,
            #e8934a 100%
        );
    border-radius: 18px;
    padding: 18px 16px 0 16px;  /* top=18 is the bezel strip above screen */
    display: flex;
    flex-direction: column;
    overflow: visible;          /* MUST be visible */
    box-shadow:
        0 18px 45px rgba(0,0,0,0.45),
        0 5px 10px rgba(0,0,0,0.3),
        inset 0 2px 0 rgba(255,255,255,0.25),
        inset 0 -2px 3px rgba(0,0,0,0.2);
    transform: rotateX(1.5deg) rotateY(-1deg);
    transform-style: preserve-3d;
}
```

Internal layout map (measured from casing top = 0):
  0px        — casing top edge
  0–18px     — top bezel strip (casing padding-top). Mushrooms + top moth here.
  18px       — screen top edge
  18–228px   — screen (210px tall)
  228px      — screen bottom edge
  228–380px  — bottom bar area (152px). Bottom moth + clear button here.
  380px      — casing bottom edge

─── 3c. .deco (base class) ─────────────────────────────────────

```css
.deco {
    position: absolute;
    z-index: 0;               /* behind screen (z-index 3) */
    pointer-events: none;
    filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.4));
}
```

─── 3d. Each deco, individually ─────────────────────────────────

```css
/* TOP-LEFT MUSHROOM
   Grows up and left off the corner. Base sits at the corner of the
   top bezel. Parts extend above and left into body padding. */
.deco-mushroom-tl {
    top: -22px;
    left: -12px;
    width: 70px;
    transform: rotate(-2deg);
}

/* TOP-RIGHT MUSHROOM
   Mirror of TL. This asset (10.png) is a wider/flatter cluster so
   it's slightly wider. */
.deco-mushroom-tr {
    top: -18px;
    right: -10px;
    width: 76px;
    transform: rotate(2deg);
}

/* TOP-CENTER MOTH
   Sits on the top bezel strip, centered between the two mushrooms.
   Fully within the 0–18px bezel zone. Does not touch the screen. */
.deco-moth-top {
    top: 1px;
    left: 50%;
    transform: translateX(-50%);
    width: 48px;
}

/* RIGHT MOTH-MUSHROOM COMBO
   Sits at the right edge of the casing at roughly screen-midheight,
   growing rightward into body padding. The combo image has the moth
   above the mushroom stack, so anchor point is about 55% down the
   screen. Screen starts at 18px, 55% of 210px = 115px, so top ≈ 133px.
   Extends right beyond casing edge. */
.deco-moth-mushroom-r {
    top: 128px;
    right: -18px;
    width: 88px;
    transform: rotate(1deg);
}

/* BOTTOM MOTH
   Centered in the bottom bar area (228–380px = 152px of space).
   Vertical center of that zone = 228 + 76 = 304px.
   Moth image is roughly 50px tall, so top = 304 - 25 = 279px. */
.deco-moth-bottom {
    top: 275px;
    left: 50%;
    transform: translateX(-50%);
    width: 56px;
}
```

─── 3e. .screen ─────────────────────────────────────────────────

```css
.screen {
    position: relative;
    z-index: 3;                 /* above all decos */
    background: var(--screen-bg);
    border-radius: 12px;
    padding: 12px 14px 10px;
    box-shadow:
        inset 0 3px 10px var(--screen-shadow),
        inset 0 1px 3px rgba(0,0,0,0.15),
        0 2px 4px rgba(0,0,0,0.25);
    height: 210px;              /* FIXED height matching layout map */
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Glass glare — keep as-is */
.screen::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        135deg,
        rgba(255,255,255,0.18) 0%,
        rgba(255,255,255,0.06) 35%,
        transparent 55%
    );
    border-radius: 12px;
    pointer-events: none;
    z-index: 100;
}
```

─── 3f. .bottom-bar ────────────────────────────────────────────

```css
.bottom-bar {
    position: relative;
    z-index: 3;
    flex: 1;                    /* fills remaining casing space below screen */
    display: flex;
    align-items: center;
    justify-content: center;
}
```

Remove .bottom-moth entirely from CSS — it no longer exists as a
child of .bottom-bar. It is now .deco-moth-bottom, positioned above.

─── 3g. .grain — no change needed ──────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUMMARY OF WHAT CHANGED AND WHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Element              | Old value        | New value     | Why                        |
|----------------------|------------------|---------------|----------------------------|
| body width           | 320px (no pad)   | 340px + 18px  | Air for mushroom overhang  |
| casing height        | min 460px        | 380px fixed   | Mockup is compact          |
| screen height        | min 280px flex   | 210px fixed   | Matches mockup proportions |
| mushroom-tl width    | 168px            | 70px          | Was 2.4x too large         |
| mushroom-tr width    | 148px            | 76px          | Was 2x too large           |
| moth-mushroom-r width| 138px            | 88px          | Was 1.6x too large         |
| moth-top             | didn't exist     | 48px, top:1px | New asset, on bezel        |
| moth-bottom          | child of bar     | deco, top:275 | Needs abs positioning      |
| all deco z-index     | 2                | 0             | Must be behind screen (3)  |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TESTING CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After applying:
  □ No mushroom or moth pixel touches the teal screen area
  □ Mushrooms are visible growing outward off corners (not clipped)
  □ Top moth is centered on the bezel strip above the screen
  □ Right combo is at mid-screen height on the right edge
  □ Bottom moth is centered in the bottom bar zone
  □ Typing in the editor still works, checkboxes still align
  □ The clear button still appears/disappears correctly