"""Build dist404/: the 404 page as its own claude.ai artifact, so it has a link of its own.

Links that pointed at the landing (index.html, index.html#section) point at the main artifact;
Privacy and Terms ship alongside, so the footer still works. The page itself is written without
its doctype/head wrapper (the host adds it); the secondary pages stay full documents.

usage: python src/build_404_artifact.py
"""
import os, re, shutil

MAIN = 'https://claude.ai/artifact/Q6vBBLUnRMxXNvWze7nzAa'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist404')
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, 'assets', 'pages'))


def to_main(html):
    html = re.sub(r'href="index\.html(#[\w-]+)?"', lambda m: f'href="{MAIN}{m.group(1) or ""}"', html)
    return html


for f in ('pages.css', 'pages.js', 'assets/ic-shirt-white.svg'):
    shutil.copyfile(os.path.join(ROOT, f), os.path.join(OUT, f))
for f in os.listdir(os.path.join(ROOT, 'assets', 'pages')):
    shutil.copyfile(os.path.join(ROOT, 'assets', 'pages', f), os.path.join(OUT, 'assets', 'pages', f))
for f in ('privacy.html', 'terms.html'):
    html = open(os.path.join(ROOT, f), encoding='utf-8').read()
    open(os.path.join(OUT, f), 'w', encoding='utf-8').write(to_main(html))

html = open(os.path.join(ROOT, '404.html'), encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
head = re.sub(r'\s*<meta charset[^>]*>|\s*<meta name="viewport"[^>]*>', '', head)
head = re.sub(r'<title>.*?</title>', '<title>Wattashirt 404</title>', head)
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(to_main(head.strip() + '\n' + body.strip() + '\n'))
for r, _, fs in os.walk(OUT):
    for f in fs:
        print(os.path.relpath(os.path.join(r, f), OUT).replace(os.sep, '/'))
