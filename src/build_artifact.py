"""Build dist/ for publishing the site as a claude.ai artifact.

An artifact holds at most 511 files and takes 64MB per publish, so the ~1600 frame webps are
packed into JSON chunks of base64 (chunk 0 = every 6th frame, the rest <= ~9MB each); main.js
reads them when window.WS_PACKS is set. The page is written without its doctype/head wrapper,
which the artifact host adds.

usage: python src/build_artifact.py   (from C:/wattashirt)
"""
import base64, json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
SEQ = os.path.join(ROOT, 'assets', 'seq')
CHUNK = 9_000_000  # base64 chars per chunk; text files may be up to 16MB

shutil.rmtree(DIST, ignore_errors=True)
os.makedirs(os.path.join(DIST, 'assets', 'seq', 'pack'))


def copy(rel):
    dst = os.path.join(DIST, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(os.path.join(ROOT, rel), dst)


# plain assets: every svg, the macro/seam photos, avatar stills, day photos, the manifest
for f in os.listdir(os.path.join(ROOT, 'assets')):
    if f.endswith('.svg') or f in ('macro_black.webp', 'macro_white.webp', 'seam_black.webp', 'seam_white.webp'):
        copy(f'assets/{f}')
for d in ('avatar', 'day', 'reviews', 'pages'):
    for f in os.listdir(os.path.join(ROOT, 'assets', d)):
        copy(f'assets/{d}/{f}')
copy('assets/seq/manifest.json')
copy('style.css')
# secondary pages are full documents (the host only wraps the main page)
for f in ('privacy.html', 'terms.html', '404.html', 'pages.css', 'pages.js'):
    copy(f)
copy('main.js')

# frame sequences -> packs
packs = {}
seqs = []
for top in ('black', 'white', 'av'):
    for sub in sorted(os.listdir(os.path.join(SEQ, top))):
        seqs.append(f'{top}/{sub}')
seqs += ['intro', 'intro_w']
for name in seqs:
    d = os.path.join(SEQ, *name.split('/'))
    frames = sorted(int(f[:4]) for f in os.listdir(d) if f.endswith('.webp'))
    keys = [i for i in frames if i % 6 == 0]
    rest = [i for i in frames if i % 6]
    groups, cur, size = [keys], [], 0
    for i in rest:
        n = os.path.getsize(os.path.join(d, f'{i:04d}.webp')) * 4 // 3
        if cur and size + n > CHUNK:
            groups.append(cur); cur, size = [], 0
        cur.append(i); size += n
    if cur:
        groups.append(cur)
    file = name.replace('/', '_')
    for k, g in enumerate(groups):
        data = [base64.b64encode(open(os.path.join(d, f'{i:04d}.webp'), 'rb').read()).decode() for i in g]
        with open(os.path.join(DIST, 'assets', 'seq', 'pack', f'{file}_{k}.json'), 'w') as fh:
            json.dump({'i': g, 'd': data}, fh, separators=(',', ':'))
    packs[name] = len(groups)

# page: drop doctype/html/head/body wrappers, keep title, fonts, libs; flag the packed build
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
head = re.sub(r'\s*<meta charset[^>]*>|\s*<meta name="viewport"[^>]*>', '', head)
head = re.sub(r'<title>.*?</title>', '<title>Wattashirt</title>', head)
# (the body's is-loading class isn't needed: the page sets html.is-loading, which is all the CSS uses)
page = (head.strip() + '\n<script>window.WS_PACKS = ' + json.dumps(packs) + ';</script>\n'
        + body.strip() + '\n')
open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8').write(page)

total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(DIST) for f in fs)
count = sum(len(fs) for _, _, fs in os.walk(DIST))
print(count, 'files', round(total / 1e6, 1), 'MB')
print(json.dumps(packs))
