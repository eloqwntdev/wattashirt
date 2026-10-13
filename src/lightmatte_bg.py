"""Light-theme matte for frames with dark content (the avatar's trousers and beanie).

A luminance key would eat the black trousers, so here only the black that is connected
to the frame border counts as background; the edge gets a short luminance ramp.

usage: python lightmatte_bg.py DIR first last
"""
import os, sys, glob
import numpy as np, cv2

T = 14
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = [f for f in sorted(glob.glob(os.path.join(d, '*.webp'))) if a <= int(os.path.basename(f)[:4]) <= b]
for f in files:
    im = cv2.imread(f, cv2.IMREAD_UNCHANGED)
    rgb = im[:, :, :3].astype(np.float32)
    lum = rgb.max(axis=2)
    dark = (lum < T).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    h, w = dark.shape
    n, lab = cv2.connectedComponents(dark, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border)).astype(np.float32)
    bg = cv2.GaussianBlur(bg, (5, 5), 0)
    ramp = np.clip((lum - 4) / 40, 0, 1)
    keep = np.maximum(1 - bg, ramp)
    alpha = im[:, :, 3].astype(np.float32) / 255 * keep
    t = np.maximum(keep, 0.25)
    rgb = np.where((bg > 0.01)[..., None], np.clip(rgb / t[..., None], 0, 255), rgb)
    cv2.imwrite(f, np.dstack([rgb, alpha * 255]).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 86])
print(d, len(files), 'frames')
