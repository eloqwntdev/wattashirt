"""Replace the unlit left shoulder (screen-left, beside the collar) with the Figma render's shading.

Only for frames where the shirt sits in the render's front pose (end of the intro, story 0-5):
the render (assets/ts03.png) is placed at a known scale/offset, its shoulder is blended in under
a feathered ellipse, brightness-matched to the frame. Weight follows how well the frame matches.

usage: python shoulder_render.py intro|story first last
"""
import sys, os
import numpy as np, cv2

kind, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
if kind == 'intro':
    d, S, X, Y = 'assets/seq/intro', 1.31 * 0.75, 456, 38
else:
    d, S, X, Y = 'assets/seq/black/story', 1.31, 608, 50
t = cv2.imread('assets/ts03.png', cv2.IMREAD_UNCHANGED).astype(np.float32)
tr = cv2.resize(t, None, fx=S, fy=S, interpolation=cv2.INTER_AREA)
th, tw = tr.shape[:2]
tc = (tr[:, :, :3] * tr[:, :, 3:] / 255).astype(np.uint8)

# shoulder ellipse in render (1024px) coordinates
CX, CY, RX, RY = 300, 165, 135, 100

for i in range(a, b + 1):
    p = os.path.join(d, f'{i:04d}.webp')
    f = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if f is None:
        continue
    fl = (f[:, :, :3].astype(np.float32) * f[:, :, 3:] / 255).astype(np.uint8)
    pad = 24
    win = fl[max(0, Y - pad):Y + th + pad, max(0, X - pad):X + tw + pad]
    r = cv2.matchTemplate(win, tc, cv2.TM_CCOEFF_NORMED)
    _, mx, _, loc = cv2.minMaxLoc(r)
    wt = float(np.clip((mx - 0.86) / 0.08, 0, 1))
    if wt <= 0:
        print(i, round(mx, 3), 'skip'); continue
    x, y = max(0, X - pad) + loc[0], max(0, Y - pad) + loc[1]
    H, W = f.shape[:2]
    R = np.zeros((H, W, 4), np.float32)
    R[y:y + th, x:x + tw] = tr[:min(th, H - y), :min(tw, W - x)]
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, (int(x + CX * S), int(y + CY * S)), (int(RX * S), int(RY * S)), -25, 0, 360, 1, -1)
    m = cv2.GaussianBlur(m, (0, 0), RX * S * 0.35) * (R[:, :, 3] / 255)
    fr = f[:, :, :3].astype(np.float32)
    # brightness match on the lit fabric inside the mask
    sel = (m > 0.2) & (fr.max(axis=2) > 10)
    k = (fr[sel].mean() / max(R[:, :, :3][sel].mean(), 1)) if sel.sum() > 500 else 0.75
    k = float(np.clip(k, 0.5, 1.1))
    m *= wt
    rgb = fr * (1 - m[..., None]) + R[:, :, :3] * k * m[..., None]
    al = np.maximum(f[:, :, 3].astype(np.float32), R[:, :, 3] * m)
    cv2.imwrite(p, np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 90])
    print(i, round(mx, 3), 'w', round(wt, 2), 'k', round(k, 2))
