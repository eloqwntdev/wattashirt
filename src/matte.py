"""Cut clips into a continuous frame sequence with an alpha matte per frame.

Lit pixels are closed, then every row is filled between its outermost lit pixels, so
pure-black folds inside the silhouette stay opaque. Edges get a soft luminance ramp.

usage:
  python matte.py OUT_DIR --per 60 --size 1440 --wide clip1.mp4 clip2.mp4 ...   (16:9 frames, height 1440)
  python matte.py OUT_DIR --per 40 --size 1080 clip1.mp4 ...                    (centre square crop)
  python matte.py OUT_DIR --per 120 --size 1080 --wide --nomatte intro.mp4      (16:9, opaque)
Sources may be 1080p or 4K; they are scaled to the output height first.
Consecutive clips share their boundary pose, so every clip but the last drops its final frame.
"""
import argparse, os, subprocess
import numpy as np, cv2, imageio_ffmpeg

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('clips', nargs='+')
ap.add_argument('--per', type=int, default=60, help='frames taken from each clip')
ap.add_argument('--size', type=int, default=1080, help='output height in px')
ap.add_argument('--wide', action='store_true', help='keep the full 16:9 frame instead of a centre square')
ap.add_argument('--nomatte', action='store_true')
ap.add_argument('--q', type=int, default=86)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

ff = imageio_ffmpeg.get_ffmpeg_exe()
H = a.size
W = round(H * 16 / 9) // 2 * 2
T = 9                      # "background" threshold on the max channel
KS = int(H * 0.045) | 1    # closing kernel, bridges dark folds between rim-lit edges


def frames_of(clip):
    cmd = [ff, '-loglevel', 'error', '-i', clip, '-vf', f'scale={W}:{H}:flags=lanczos',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def matte(f):
    lum = f.max(axis=2).astype(np.float32)
    fg = (lum > T).astype(np.uint8) * 255
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    closed = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (KS, KS)))
    # each row is filled between its outermost lit pixels: a shirt silhouette has no
    # horizontal holes, and pure-black shadows inside it can't leak out to the background
    cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    keep = np.zeros_like(closed)
    cv2.drawContours(keep, [c for c in cnts if cv2.contourArea(c) > 0.0005 * closed.size], -1, 255, -1)
    on = keep > 0
    any_ = on.any(axis=1)
    l = np.where(any_, on.argmax(axis=1), 0)
    r = np.where(any_, on.shape[1] - 1 - on[:, ::-1].argmax(axis=1), -1)
    cols = np.arange(on.shape[1])
    sil = ((cols[None, :] >= l[:, None]) & (cols[None, :] <= r[:, None])).astype(np.float32)
    sil = cv2.GaussianBlur(sil, (7, 7), 0)
    soft = np.clip((lum - 2) / (T + 6), 0, 1)
    alpha = np.maximum(sil, soft)
    alpha[alpha < 0.02] = 0
    return (alpha * 255).astype(np.uint8)


n = 0
for ci, clip in enumerate(a.clips):
    fr = frames_of(clip)
    last = ci == len(a.clips) - 1
    multi = len(a.clips) > 1
    idx = np.linspace(0, len(fr) - 1, a.per + (0 if last or not multi else 1)).round().astype(int)
    if multi and not last:
        idx = idx[:-1]
    for i in idx:
        f = fr[i] if a.wide else fr[i][:, (W - H) // 2:(W - H) // 2 + H]
        if a.nomatte:
            out = cv2.cvtColor(np.ascontiguousarray(f), cv2.COLOR_RGB2BGR)
        else:
            out = cv2.cvtColor(np.dstack([f, matte(f)]), cv2.COLOR_RGBA2BGRA)
        cv2.imwrite(os.path.join(a.out, f'{n:04d}.webp'), out, [cv2.IMWRITE_WEBP_QUALITY, a.q])
        n += 1
print(a.out, n, 'frames')
