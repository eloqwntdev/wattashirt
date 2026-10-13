# Wattashirt — developer handoff

This is a concept landing for Wattashirt: a scroll-driven page with a photoreal T-shirt, built from AI video frame sequences on canvas. It also includes Privacy, Terms and an interactive 404 page. Dark and light themes are included.

## Quick start

```bash
python -m http.server 5178
```

Then open http://localhost:5178/. Any static server works. There is no build step and no npm.

**Working with Claude Code:** open this folder in Claude Code. `CLAUDE.md` holds the full project context: architecture, the frame pipeline, the theme system, known gotchas and decisions already made. Claude reads it automatically, so you can continue from there.

## ⚠ Placeholder content — replace before going live

- All 8 reviews (names, texts, photos, avatars), the "4.9 · 312 reviews" rating, the legal texts, and the emails `privacy@` / `hello@wattashirt.com` are placeholders. Replace them with real data, or remove them.
- Social icons point to the 404 page.
- Prices, CTAs and the configurator's "Get it" have no shop backend.

## Folder

| Path | Contents |
|---|---|
| `index.html`, `style.css`, `main.js` | The landing |
| `404.html`, `privacy.html`, `terms.html`, `pages.css`, `pages.js` | The secondary pages |
| `assets/` | Icons, images and the frame sequences (`assets/seq`, about 1,600 webp frames) |
| `src/` | Python scripts that cut source videos into frames, the source clips (mp4) and key frames, and the QA harness `m.html` |
| `.claude/launch.json` | Dev server config for Claude Code |

Each frame is a webp with alpha.

The site needs only the root files and `assets/`. `src/` is for re-cutting frames, for example after upscaling the clips. To re-cut, install the Python dependencies first:

```bash
pip install numpy opencv-python imageio-ffmpeg
```
