"""Cut the configurator avatar clips into webp frame sequences for the stage canvas.

Each clip is levelled so its backdrop matches the page exactly: black clips get their
backdrop pushed to 0, white (light-studio) clips get theirs scaled to BG_LIGHT, which is
the light theme's --bg. The edges are then feathered on the canvas, so no seam shows.

usage: python avcut.py OUT_ROOT clip.mp4 ...   (name pattern {b|w}_{over|reg}_{turn|mood}.mp4)
"""
import os, sys, subprocess
import numpy as np, cv2, imageio_ffmpeg

BG_LIGHT = 234          # #eaeaea
W, H = 1600, 900
EVERY = 2               # 121 source frames -> 61
ff = imageio_ffmpeg.get_ffmpeg_exe()


def frames(clip):
    raw = subprocess.run([ff, '-loglevel', 'error', '-i', clip, '-vf', f'scale={W}:{H}:flags=lanczos',
                          '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def backdrop(f):
    # left and right thirds' outer strips never contain the figure
    strips = np.concatenate([f[:, :W // 8].reshape(-1, 3), f[:, -W // 8:].reshape(-1, 3)])
    return float(np.median(strips))


out_root = sys.argv[1]
for clip in sys.argv[2:]:
    name = os.path.splitext(os.path.basename(clip))[0]
    light = name.startswith('w_')
    fr = frames(clip)
    out = os.path.join(out_root, name)
    os.makedirs(out, exist_ok=True)
    n = 0
    for i in range(0, len(fr), EVERY):
        f = fr[i].astype(np.float32)
        bg = backdrop(f)
        if light:
            f = f * (BG_LIGHT / max(bg, 1))
        else:
            k = bg + 4
            f = (f - k) * (255 / (255 - k))
        f = np.clip(f, 0, 255).astype(np.uint8)
        cv2.imwrite(os.path.join(out, f'{n:04d}.webp'), f, [cv2.IMWRITE_WEBP_QUALITY, 80])
        n += 1
    print(name, n, 'frames')
