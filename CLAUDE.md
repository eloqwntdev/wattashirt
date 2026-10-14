# Wattashirt — scroll landing (concept build)

Static site, no build step: `index.html` + `style.css` + `main.js` (landing), `404.html` / `privacy.html` / `terms.html` + `pages.css` + `pages.js` (secondary pages).
Libraries come from CDNs: GSAP 3.12.5 + ScrollTrigger (cdnjs), Lenis 1.1.13 (unpkg). Fonts: Inter Tight (Google Fonts).

The "photoreal" shirt is NOT real-time 3D. It is AI-generated video (Kling 3.0 pro, start/end-frame clips keyed on Figma renders) cut into webp frame sequences with alpha, drawn on a canvas and scrubbed by scroll.
An earlier three.js + GLB version was rejected by the client as "stock". Do not go back to 3D.

## Run

```bash
python -m http.server 5178
```

Open http://localhost:5178/. `.claude/launch.json` has the same command as config "wattashirt".
Must be served over http: frames load with `fetch`, so `file://` won't work.

QA harness: `src/m.html?w=375&h=740` (or `&page=404.html`, `&s=0.5` to scale). It loads a page in a fixed-size iframe with a rAF shim, so it keeps running in a hidden tab. JS errors go to `window.__errs` inside the iframe.
Lenis doesn't sync in the harness and `location.hash` can't be faked there. Canvas poses in the harness are unreliable, so check layout with `getBoundingClientRect`, not screenshots.

## PLACEHOLDER CONTENT — replace before any public launch

This is a concept. Several things look real but are invented:

- **Reviews** (`#reviews`, 8 cards): names, countries, texts, customer photos and avatars (`assets/reviews/*`, AI-generated) are all fictional.
- **The rating line** "4.9 · 312 reviews" in `#buy`.
- The published concept link labels these "Sample reviews" / "· sample". This handoff copy has the labels removed so the developer can drop in real data. Never ship the fictional reviews unlabelled.
- **Legal texts** in `privacy.html` and `terms.html` are drafts, not lawyer-reviewed.
- **Emails** `privacy@wattashirt.com` and `hello@wattashirt.com` are invented.
- **Social icons** in the footer (FB / IG / LinkedIn) link to the platform home pages (facebook.com, instagram.com, linkedin.com) until the real account URLs exist.
- **Commerce:** the price, the "Get Black / Get White" CTA, the `EN` language button and the configurator's "Get it" have no backend. They are UI only.

## Architecture (landing, main.js)

- **Sections** carry `data-scene="…"`. Scenes in order: hero, about, tech, features, breeze, avatarIn, avatarOut, back, day, reviews, statement, buy. Section ids for anchors: `#about #tech #features #breeze #configurator #back #day #reviews #buy`.
- **The shirt's pose per scene:**
  - `SCENE_POSES` sets x and y as a fraction of the viewport and s as scale. `MOBILE_SCENE_POSES` overrides them on mobile.
  - `SCENE_FRAMES` sets the frame in the story sequence for each scene.
  - The story sequence runs: front 0 → side 60 → 3/4 120 → cotton → back 179 → cotton cocoon 239 → avatar 299.
  - Scrolling past the avatar plays the cocoon clips in reverse back to the shirt.
  - `day` and `reviews` move the shirt out of frame (y −0.7). It comes back down for `statement`/`buy`. The finale is one pinned block where only the shirt moves.
- **Sequences** (`assets/seq/manifest.json`):
  - `black/story` and `white/story` (300 frames, 16:9 1440p webp + alpha).
  - `black/turn` and `white/turn` (240 frames, the configurator turntable).
  - `intro` and `intro_w` (120 frames, unboxing preloader, opaque).
  - `av/{b|w}_{over|reg}_{turn|mood}` (61 frames each, 1600×900, configurator avatar).
- **`ASSET_V`** (main.js, currently 17) is appended as `?v=` to every frame URL. Bump it after you re-cut any frames.
- **Cache-busting** on css/js is manual via `?v=` in the HTML: style.css?v=45, main.js?v=52, pages.css?v=29, pages.js?v=9, bag.css?v=3, bag.js?v=3. Bump the number when you edit the file.
- **Preloader:** a counter runs while the intro frames load, then the box opens on the stage canvas. Arriving with a hash (`index.html#reviews`) skips the intro and jumps to that section (`arrivalHash` / `anchorTarget()`).
- **Loupe** (magnifier) only in About. Hotspot labels are laid out in columns outside the shirt (`HS_HALF`/`HS_GAP`). Video cards are linked to the shirt by leader lines (`CARD_LINKS`).
- **Configurator:** colour / fit / view / mood drive the avatar sequences. Mood shows full height and never zooms.
- **Page grid:** every section is anchored on the same two side columns:
  - left column: `--col-l` (= gutter);
  - right column: `--col-r` (= 100% − gutter − side-w);
  - vertical anchors: `--content-top` / `--content-bottom`.
  - Side content enters vertically along its column. All text is left-aligned.

## Theme system

- Dark is the default. "I Wanna White" switches the whole site to light: `html.is-white`, with `--bg #eaeaea`, which is also the light avatar backdrop.
- The switch must be **instant**:
  - a 150 ms veil in the new bg colour flips the theme underneath;
  - it is done with setTimeout + CSS, not GSAP, so it fires in hidden tabs;
  - other code listens for the `themechange` event.
- In white mode **never fall back to black frames**. White sequences were generated natively on #EAEAEA, not recoloured.
- **Glass:** light glass has the same build as dark glass: a thin see-through pane, a rim and a bevel. It is not milky "liquid glass". In white mode **all** buttons are white glass with dark text, with no dark pieces on the light page.
- **Hover language:**
  - buttons: lift −2px, a brighter glass rim, and the icon goes `rotate(-12deg) scale(1.08)`;
  - social icons: lift + rim only, no rotation.
- **Secondary pages:**
  - The landing writes `localStorage['ws-theme']` (on load and on toggle). Secondary pages read it in `<head>`, so they open in the theme that was on screen.
  - They reuse the landing header one-to-one: logo, theme pill, EN, and the burger with a full menu linking to `index.html#section`.

## Buy page (/buy) and brand guidelines (brand.wattashirt.com)

- `buy/` is the product page every buy button on the landing opens (`data-buy` links; an inline script after main.js adds `?color=` from the theme and, for the configurator's "Get it", `&fit=`).
  - Colour = theme, like the landing: picking White flips the page. Options sync to the URL (`?color=&fit=&size=`).
  - Two sections: product and "before you buy". The stage plays the bare tee 360° (`seq/*/turn`, one cut per colour) or the muse in the chosen colour + fit (`seq/av/*_turn`, dragged front → back → front); picking a fit switches to the muse, since only his clips differ by fit. Section 2: tagline, four facts, FAQ beside a live "Your pick" card with the one buy button. The sticky bar shows only while neither the main button nor that card is on screen.
  - Layout (desktop): the buy card is sticky on the right, its top on the tee's collar (`--card-top`, set in buy.js: the frame fills the view's height and the collar sits 10% down). The tee is sticky on the left (`.scene__stick`), keeps turning on its own (resumes 3.5 s after a drag), and steps back while the four fact cards (the landing's glass cards) come in around it in `#why`. Back sits under the header so the logo stays where it is on every page. Questions, then the landing footer.
  - Buy needs a size, then adds the pick to the bag (`window.WSBag.add`) and opens it. "Get both" next to the colour swatches adds one black and one white at once.
  - Uses `brand/brand.css` for tokens, glass, header and menu, plus `buy/buy.css`.
- **Bag (`bag/bag.js` + `bag/bag.css`) is shared by every page**: landing, /buy, 404, privacy, terms. Each page loads both files; bag.js inserts the bag button into `.header .header__right` (before `#menuBtn`, or before the back button on /buy) and appends the sheet to `<body>`.
  - Items live in `localStorage['ws-bag']` (`[{color, fit, size, qty}]`), so the bag follows the visitor across pages and tabs (`storage` event). API: `window.WSBag.add(item)`, `.open()`, `.close()`, `.items()`; a `ws-bag` event fires on every change.
  - The rail at the top of the sheet: every line of the bag hangs on a bar (`assets/bag/tee_{b|w}.webp`, clean cut-outs; the brand shirt_front_w carries the light studio floor). New items drop on and swing; a tee can be dragged along the bar to reorder the bag (it leans with the drag, the others swing aside). An empty bag is one bare swinging hanger.
  - The sheet: items (qty, remove), the other colour in the same fit and size as a one-tap add, total, checkout. Empty bag: "Shop the tee" to /buy instead of checkout. The page under the sheet is locked (`html.wsb-lock`), and the sheet has `data-lenis-prevent` for the landing.
  - bag.css carries its own `--wsb-*` tokens (the three stylesheets don't share one variable set); the button takes its glass from the page's `.circle`.
  - **`CHECKOUT_URL` in `bag/bag.js` is empty**: until payments are connected the bag says checkout opens soon. Set it to the checkout link; `{items}` is filled in as `color-fit-size-qty`, comma separated.
  - Phones: header circles are 36 px and the theme pill never wraps; under 380 px the pill drops its icon so logo, pill, bag and menu fit one row.
- `brand/` is the interactive brand guide. `vercel.json` serves it at `brand.wattashirt.com` (a `routes` rule, since rewrites can't shadow the root `index.html`) and redirects `wattashirt.com/brand` there.

## 404 page ("Lost in the wash")

- The washer door is built in CSS, with glass.
- The drum plays `assets/pages/tee_float_{black|white}.mp4`. These are seamless loops: a Kling clip whose start and end frame are the same image. The white clip is the black clip with the tee swapped (Higgsfield Genjutsu `hf_mult_replace_object`), composited by `src/compose_white.py`, so the motion matches exactly.
- The still image is shown only with reduced motion.
- **pages.js physics:**
  - each tap adds a kick, capped at a maximum spin speed (KICK 1080°/s, MAX 4200, DRAG 1.2);
  - blur and shake at speed;
  - water spring tilt, with the level dropping and a wall film at high speed;
  - foam bubbles spawned by speed.
- **Idle wash programme** after 4 s untouched: `STEPS [[+270,2.2],[0,.8],[-270,2.2],[0,.6]]`, sine-eased.
- **Desktop:** the pointer becomes a glass "Spin" disc, the same as the "Drag" disc on the reviews.

## Gotchas

- `main { pointer-events: none }`. Any new interactive block inside a section needs `pointer-events: auto`. The reviews drag was broken until this was added.
- Elements centred with CSS `translate(-50%)` that GSAP also animates need `gsap.set(el, { x: 0, xPercent: -50 })`. Otherwise GSAP bakes px at first render and the element sits off-centre on some loads.
- GSAP bakes the CSS `scale` property too. Put scale on an inner element.
- `ScrollTrigger.refresh()` runs on `document.fonts.ready` and on `load`. Keep that if you add late-loading content.
- rAF stalls in hidden tabs. Anything that must fire regardless (the theme veil) uses setTimeout.

## Frame pipeline (src/)

Python 3 + `numpy opencv-python imageio-ffmpeg`. Run the scripts from the project root.
On Windows with Smart App Control, the ffmpeg bundled with imageio-ffmpeg can be blocked. If that happens, point `IMAGEIO_FFMPEG_EXE` at a system ffmpeg.

| Script | What it does |
|---|---|
| `matte.py` | Cuts dark-studio clips into webp + alpha. Black-on-black needs a row-span fill. `--wide` keeps 16:9. |
| `lightcut.py` | Cuts light-studio clips (shot on #EAEAEA). Keys by difference from the grey and fills the silhouette. |
| `avcut.py` | Cuts the configurator avatar clips (`{b\|w}_{over\|reg}_{turn\|mood}.mp4`) into `assets/seq/av`. |
| `edgefade.py` | Bakes a 14% side fade into story frames, so flying cotton doesn't end on a hard line. Re-run after any story re-cut. |
| `shoulder_render.py` | Blends the Figma render's shoulder (`assets/ts03.png`) into intro 110–119 and story 0–5, where the left shoulder was unlit. |
| `lightmatte.py`, `lightmatte_bg.py` | Legacy light-theme re-matte of black-shot frames. Superseded by lightcut. |
| `compose_white.py` | Builds the white 404 clip from the Genjutsu tee-swap clip. |
| `build_artifact.py`, `build_404_artifact.py` | Pack the site as a claude.ai artifact (see below). |

**Source clips → sequences:**

| Sequence | Source clips |
|---|---|
| black story | `clips4k/b1, b2` + `cotton/b3c2, t1c, t2c` |
| black turn | `clips2/b1–b6` |
| intro | `clips4k/intro` |
| intro_w | `cotton/pack_w` |
| white story + turn | `lightclips/*` |
| configurator | `avclips/*` |
| 404 | `float/*_raw.mp4` |

**Other material in src/:**

- Key frames are in `src/keys`, `src/lightkeys`, `src/cotton/*.png` and `src/float/*.png`.
- `src/edgefade_bak` holds the story frames before the side fade.
- Clips are 5 s. Consecutive clips share their boundary pose, so each clip except the last drops its final frame.

## Publishing as a claude.ai artifact (optional)

1. Run `python src/build_artifact.py`. It writes `dist/`.
   - An artifact allows at most 511 files and 64 MB per publish, so the ~1600 frames are packed into base64 JSON chunks.
   - `main.js` reads the chunks when `window.WS_PACKS` is set.
2. Publish `dist/index.html` plus the files map in 2 batches.
3. `python src/build_404_artifact.py` writes `dist404/`: the standalone 404 with links pointing to the main artifact (`MAIN` url in the script).

Neither is needed for a normal web deploy: just serve the root folder.

## Decisions already made (don't revisit without the client)

- **Rejected:**
  - lifting the shirt blacks (`lift.py`): grey bands showed, so keep the deep blacks;
  - splicing a regenerated clip into the intro: it left a visible seam;
  - inpainting the dark shoulder: it looked blotchy;
  - pure-code white recolour of the 404 clip: ragged edges;
  - the milky light glass;
  - icon rotation on social icons.
- **Accepted:**
  - cotton bolls (not petals) in the story;
  - natively regenerated white sequences;
  - the shoulder render blend;
  - the instant theme switch;
  - white-glass buttons in light mode.
- **Spending:** AI generation costs credits (a Kling 3.0 pro 5 s clip is 7.5 Higgsfield credits). Ask before generating.

## Design source

Figma file key `PiXZ2Go3I4VjXzPSuKfoIc` (Home frame 22:17). Motion reference: primo-thermodry-pro.silverskin.it.
