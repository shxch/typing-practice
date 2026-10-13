"""Shrink the badge pictures in src/assets/badges to the size they are shown at.

A badge is at most 60 px across, so 256 px on the long side is plenty even on a 3x screen.
Animated pictures cost a full picture per frame, so they go smaller still.
Run again after adding a picture; ones already small enough are left alone.

    python scripts/shrink-badges.py
"""
import glob
import os

from PIL import Image, ImageSequence

LONG_SIDE = 256
ANIMATED_LONG_SIDE = 192
FOLDER = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'badges')

for path in sorted(glob.glob(os.path.join(FOLDER, '*.webp'))):
    im = Image.open(path)
    animated = getattr(im, 'n_frames', 1) > 1
    long_side = ANIMATED_LONG_SIDE if animated else LONG_SIDE
    if max(im.size) <= long_side:
        continue
    before = os.path.getsize(path)
    scale = long_side / max(im.size)
    size = (round(im.width * scale), round(im.height * scale))
    if animated:
        frames = [f.convert('RGBA').resize(size, Image.LANCZOS) for f in ImageSequence.Iterator(im)]
        im.seek(1)  # the first frame does not report its duration
        duration = im.info.get('duration') or 100
        frames[0].save(path, save_all=True, append_images=frames[1:], duration=duration, loop=0, quality=60, method=4)
    else:
        im.resize(size, Image.LANCZOS).save(path, quality=82, method=6)
    print(f'{os.path.basename(path)}: {before // 1024} KB -> {os.path.getsize(path) // 1024} KB')
