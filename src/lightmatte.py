"""Re-matte the white-shirt frames for the light theme.

The sequences were matted on black, so their edges and the pure-black gaps inside the
silhouette (neck opening, armpits) carry black. On the light page that reads as a dark
outline. A white shirt is never darker than ~85 anywhere, so luminance is a clean key:
alpha falls off with it, and edge colour is un-premultiplied from black.

usage: python lightmatte.py DIR [first last]   (in place; frame range inclusive, default all)
"""
import os, sys, glob
import numpy as np, cv2

LO, HI = 15, 85
d = sys.argv[1]
files = sorted(glob.glob(os.path.join(d, '*.webp')))
if len(sys.argv) > 3:
    a, b = int(sys.argv[2]), int(sys.argv[3])
    files = [f for f in files if a <= int(os.path.basename(f)[:4]) <= b]
for f in files:
    im = cv2.imread(f, cv2.IMREAD_UNCHANGED)
    rgb = im[:, :, :3].astype(np.float32)
    lum = rgb.max(axis=2)
    t = np.clip((lum - LO) / (HI - LO), 0, 1)
    t = cv2.GaussianBlur(t, (3, 3), 0)
    alpha = im[:, :, 3].astype(np.float32) / 255 * t
    rgb = np.clip(rgb / np.maximum(t, 0.25)[..., None], 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    cv2.imwrite(f, out, [cv2.IMWRITE_WEBP_QUALITY, 86])
print(d, len(files), 'frames')
