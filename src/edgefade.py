"""Feather the frame edges so content that reaches them (flying cotton) fades out instead of
ending on a hard vertical line where the frame stops short of a wide viewport.

Alpha is multiplied by a smooth ramp over the outer EX of the width (EY of the height, off).
The shirt never reaches those bands, so every frame gets the same ramp (no flicker).

usage: python src/edgefade.py DIR [DIR ...]
"""
import os, sys
import numpy as np, cv2

EX, EY = 0.14, 0.0  # sides only: the avatar frames run nearly top to bottom


def ramp(n, e):
    x = np.arange(n, dtype=np.float32) / (n - 1)
    if e <= 0:
        return np.ones(n, np.float32)
    t = np.clip(np.minimum(x, 1 - x) / e, 0, 1)
    return t * t * (3 - 2 * t)


for d in sys.argv[1:]:
    cache = {}
    for f in sorted(os.listdir(d)):
        if not f.endswith('.webp'):
            continue
        p = os.path.join(d, f)
        im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        h, w = im.shape[:2]
        if (h, w) not in cache:
            cache[(h, w)] = np.outer(ramp(h, EY), ramp(w, EX))
        a = im[:, :, 3].astype(np.float32) * cache[(h, w)]
        im[:, :, 3] = np.round(a).astype(np.uint8)
        cv2.imwrite(p, im, [cv2.IMWRITE_WEBP_QUALITY, 90])
    print(d, 'done')
