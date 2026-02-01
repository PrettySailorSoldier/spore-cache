╔══════════════════════════════════════════════════════════════════╗
║  SPORE CACHE — MOTH/BUTTERFLY FIX                               ║
╚══════════════════════════════════════════════════════════════════╝

Three things are broken. This prompt fixes all three.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1 — FIX THE ASSET FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Two uploaded PNGs were both named 13.png so the filesystem only
kept one. You need to manually save them with the correct names.
Open each source image, save as:

  12.png (the GREEN luna moth)
      → save as  assets/moth-top-center.png

  The TEAL/BLUE detailed moth (orange accents, complex wing pattern)
      → save as  assets/moth-bottom.png
        (this file currently exists but contains the WRONG image —
         it's the green luna moth. Overwrite it.)

  The PURPLE/ORANGE butterfly (clubbed antennae, orange body, purple wings)
      → save as  assets/butterfly-bottom.png
        (this file does not exist yet. Create it.)

Do NOT touch mushroom-top-left.png, mushroom-top-right.png,
moth-mushroom-right.png, or moth-top-center.png after the above.

Final assets/ contents:
  mushroom-top-left.png       ← unchanged
  mushroom-top-right.png      ← unchanged
  moth-mushroom-right.png     ← unchanged
  moth-top-center.png         ← green luna moth (12.png)
  moth-bottom.png             ← TEAL moth (overwritten)
  butterfly-bottom.png        ← purple butterfly (NEW)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 2 — FIX popup.html (two changes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHANGE A — Fix the top moth src.

Find this line:
    <img src="assets/moth-bottom.png" class="deco deco-luna-moth-top" alt="">

Replace with:
    <img src="assets/moth-top-center.png" class="deco deco-luna-moth-top" alt="">

That's it. Just the src attribute. The green luna moth file is now
at moth-top-center.png where it belongs.

CHANGE B — Add the purple butterfly.

Find this line inside .bottom-bar:
    <img src="assets/moth-bottom.png" class="bottom-moth" alt="">

Replace with:
    <img src="assets/moth-bottom.png" class="bottom-moth" alt="">
    <img src="assets/butterfly-bottom.png" class="bottom-butterfly" alt="">

Just add the second img tag right after the existing one. Same parent div.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 3 — ADD .bottom-butterfly to popup.css
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the .bottom-moth rule block in popup.css. Add the new rule
directly AFTER it (before the options-btn or clear-btn rule):

```css
/* BOTTOM RIGHT BUTTERFLY */
.bottom-butterfly {
    height: 38px;
    width: auto;
    position: absolute;
    right: 28px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    pointer-events: none;
    filter: drop-shadow(1px 3px 5px rgba(0, 0, 0, 0.4));
}
```

This positions it to the right of the centered teal moth, matching
the mockup. If it needs nudging after you see it, adjust `right`
and the height.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WHAT WAS WRONG AND WHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The top deco (.deco-luna-moth-top) had src="assets/moth-bottom.png"
instead of src="assets/moth-top-center.png". So it was pulling the
same file as the bottom moth — both showed green luna moths.

Additionally, moth-bottom.png itself was the green luna moth file
when it should have been the teal moth. And the purple butterfly
had no file or img tag at all.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TESTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After applying:
  □ Top center shows the GREEN luna moth (small, simple wings)
  □ Bottom center shows the TEAL moth (larger, detailed, orange accents)
  □ Bottom right shows the PURPLE butterfly (clubbed antennae, orange body)
  □ No creature touches the teal screen area
  □ Editor and checkboxes still work