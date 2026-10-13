"""Light-theme 404 clip: take the clip where the white tee replaced the black one (same motion,
still on the dark backdrop), key the bright tee off the dark glow, and lay it on the light
backdrop. Edge colour is un-premultiplied from the dark backdrop, so there is no dark fringe.

usage: python src/compose_white.py IN.mp4 OUT.mp4
"""
import sys, subprocess
import numpy as np, cv2, imageio_ffmpeg

src, dst = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 24
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
H, W = frames[0].shape[:2]
S = 720
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
r = np.sqrt((xx - S / 2) ** 2 + (yy - S * 0.47) ** 2) / (S / 2)
dark = (np.clip(34 * (1 - r ** 1.6), 0, 34) + 4)[..., None]       # the dark glow the tee sits on (measured on the swap clip)
light = (233 - np.clip(r, 0, 1.2) ** 1.5 * 22)[..., None]         # the light theme's backdrop
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))

ff = imageio_ffmpeg.get_ffmpeg_exe()
enc = subprocess.Popen([ff, '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{S}x{S}', '-r', str(fps),
                        '-i', '-', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
                        '-an', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
for f in frames:
    if (H, W) != (S, S):  # centre-crop to square, then size
        s = min(H, W); y0, x0 = (H - s) // 2, (W - s) // 2
        f = cv2.resize(f[y0:y0 + s, x0:x0 + s], (S, S), interpolation=cv2.INTER_AREA)
    fl = f.astype(np.float32)
    lum = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
    soft = np.clip((lum - dark[..., 0] - 18) / 70, 0, 1)            # bright fabric over the glow
    solid = (soft > 0.5).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, k)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n > 1:
        solid = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    fill = solid.copy() * 255
    cv2.floodFill(fill, np.zeros((S + 2, S + 2), np.uint8), (0, 0), 255)
    solid = np.maximum(solid, (255 - fill) // 255)                  # shaded folds inside stay opaque
    # alpha: the solid silhouette pulled in 1px, feathered (no un-premultiply: it overshoots into a bright rim)
    a = cv2.GaussianBlur(cv2.erode(solid, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1.1)[..., None]
    # the tee was lit in a dark studio, so it reads grey on the light page: lift it toward paper white,
    # keeping its shading (compress the distance to white)
    c = 255 - (255 - fl) * 0.5
    out = light * (1 - a) + c * a
    enc.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
enc.stdin.close()
enc.wait()
print(dst, len(frames), 'frames', (W, H))
