"""Add wallpapers to the site.

Usage:
  python scripts/add-wallpapers.py <image> <name> [<image> <name> ...]
  python scripts/add-wallpapers.py --thumbs      # rebuild all thumbnails

Name them "<series>-<what>", e.g. "kirby-autumn" or "pokemon-legends": the part before
the first dash becomes the group in the picker. Images are resized to at most 2400px
(the original is kept if it is already smaller), and a small thumbnail is made for the
picker so the settings page loads fast.
"""
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
FULL = os.path.join(ROOT, 'wallpapers')
THUMBS = os.path.join(ROOT, 'wallpaper-thumbs')


def save_full(src: str, name: str) -> str:
    out = os.path.join(FULL, name + '.jpg')
    im = Image.open(src).convert('RGB')
    im.thumbnail((2400, 2400), Image.LANCZOS)
    im.save(out, 'JPEG', quality=82, progressive=True, optimize=True)
    # Re-encoding can make an already-small JPEG bigger; keep the original then.
    if src.lower().endswith(('.jpg', '.jpeg')) and os.path.getsize(src) < os.path.getsize(out) and max(Image.open(src).size) <= 2400:
        shutil.copyfile(src, out)
    return out


def save_thumb(full: str) -> None:
    name = os.path.splitext(os.path.basename(full))[0]
    im = Image.open(full).convert('RGB')
    im.thumbnail((480, 480), Image.LANCZOS)
    im.save(os.path.join(THUMBS, name + '.jpg'), 'JPEG', quality=72, progressive=True, optimize=True)


def main(args: list[str]) -> None:
    os.makedirs(FULL, exist_ok=True)
    os.makedirs(THUMBS, exist_ok=True)
    if args == ['--thumbs']:
        for f in sorted(os.listdir(FULL)):
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                save_thumb(os.path.join(FULL, f))
                print('thumb', f)
        return
    if len(args) % 2:
        sys.exit(__doc__)
    for src, name in zip(args[::2], args[1::2]):
        full = save_full(src, name)
        save_thumb(full)
        print(f'{name}: {Image.open(full).size}, {os.path.getsize(full) // 1024} KB')


if __name__ == '__main__':
    main(sys.argv[1:])
