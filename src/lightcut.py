"""Cut light-studio clips (shot on the page's own grey) into keyed webp frames.

Each frame's backdrop is levelled to BG (the light theme's --bg), then alpha comes from how
far a pixel is from that backdrop: the white shirt (brighter) and its shading and floor shadow
(darker) stay, the flat backdrop goes. The silhouette interior is filled so mid-tones that
happen to match the backdrop don't turn into holes. Colour is un-premultiplied from the grey,
so edges carry no dark fringe.

usage: python lightcut.py OUT_DIR --per 60 [--size 1440] clip1.mp4 clip2.mp4 ...
"""
import argparse, os, subprocess
import numpy as np, cv2, imageio_ffmpeg

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('clips', nargs='+')
ap.add_argument('--per', type=int, default=60)
ap.add_argument('--size', type=int, default=1440)
ap.add_argument('--q', type=int, default=86)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
ff = imageio_ffmpeg.get_ffmpeg_exe()
H = a.size; W = round(H * 16 / 9) // 2 * 2
BG = 234.0
LO, HI = 7.0, 16.0
DBG = os.environ.get("DBG")


def frames_of(clip):
    raw = subprocess.run([ff, '-loglevel', 'error', '-i', clip, '-vf', f'scale={W}:{H}:flags=lanczos',
                          '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def key(f):
    f = f.astype(np.float32)
    strips = np.concatenate([f[:, :W // 10].reshape(-1, 3), f[:, -W // 10:].reshape(-1, 3), f[:H // 12].reshape(-1, 3)])
    f = np.clip(f * (BG / max(float(np.median(strips)), 1)), 0, 255)
    d = np.abs(f - BG).max(axis=2)
    d = cv2.GaussianBlur(d, (3, 3), 0)
    soft = np.clip((d - LO) / (HI - LO), 0, 1)
    # solid interior: close the strong-difference mask and fill its holes
    k = max(9, int(H * 0.02)) | 1
    ell = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    m = (d > 9).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, ell)
    # holes = whatever the outside can't reach (padded, so a piece in the corner can't block the seed)
    ff_ = cv2.copyMakeBorder(m * 255, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    cv2.floodFill(ff_, np.zeros((H + 4, W + 4), np.uint8), (0, 0), 255)
    holes = cv2.bitwise_not(ff_[1:-1, 1:-1]) // 255
    m = np.maximum(m, holes)
    # the shirt itself: a low bar (backdrop noise sits under 3) finds its whole silhouette,
    # then everything enclosed both across and down is solid, so shirt tones that match the
    # backdrop never turn see-through. Only for a lone body away from the edges,
    # so flying cotton bolls keep their own outlines.
    lo = (cv2.GaussianBlur(d, (0, 0), 2.5) > 4.5).astype(np.uint8)
    lo = cv2.morphologyEx(lo, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    lo = cv2.morphologyEx(lo, cv2.MORPH_CLOSE, ell)
    n_, lab, st, _ = cv2.connectedComponentsWithStats(lo, 8)
    if n_ > 1:
        i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        x, y, w, h, area = st[i]
        body = (lab == i).astype(np.uint8)
        loose = int((st[1:, cv2.CC_STAT_AREA] > H * W * 0.0004).sum()) - 1  # flying bolls
        if DBG: print(x, y, w, h, round(area / (H * W), 3), loose)
        if x > 2 and x + w < W - 2 and y > 2 and area > H * W * 0.03 and loose <= 2:
            def span(mm, ax):
                return (np.cumsum(mm, axis=ax) > 0) & (np.flip(np.cumsum(np.flip(mm, ax), axis=ax), ax) > 0)
            m = np.maximum(m, (span(body, 1) & span(body, 0)).astype(np.uint8))
    solid = cv2.erode(m, np.ones((5, 5), np.uint8)).astype(np.float32)
    solid = cv2.GaussianBlur(solid, (5, 5), 0)
    al = np.maximum(soft, solid)
    al[al < 0.02] = 0
    # un-premultiply against the grey so edges keep the shirt's own colour
    rgb = BG + (f - BG) / np.maximum(al, 0.15)[..., None]
    rgb = np.where((al > 0.98)[..., None], f, np.clip(rgb, 0, 255))
    return np.dstack([rgb, al * 255]).astype(np.uint8)


n = 0
for ci, clip in enumerate(a.clips):
    fr = frames_of(clip)
    last = ci == len(a.clips) - 1
    multi = len(a.clips) > 1
    idx = np.linspace(0, len(fr) - 1, a.per + (0 if last or not multi else 1)).round().astype(int)
    if multi and not last:
        idx = idx[:-1]
    for i in idx:
        cv2.imwrite(os.path.join(a.out, f'{n:04d}.webp'), key(fr[i]), [cv2.IMWRITE_WEBP_QUALITY, a.q])
        n += 1
print(a.out, n, 'frames')
