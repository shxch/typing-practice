"""Count how often every word appears in the Wings of Fire books.

Usage:
  python scripts/wof-frequency.py [<folder or file> ...]     # default: corpus/

Put your own copies of the books (.epub, .pdf or .txt) in corpus/ — that folder is ignored by
git, so the text of the books never enters the repository. Only the resulting list of
words and counts is written, to src/content/wof-frequency.tsv (most frequent first).

A word is written in lowercase unless it is (almost) always capitalized in the books,
so "dragon" stays "dragon" even at the start of a sentence, and "Clay" and "NightWing"
keep their capitals.

PDFs need `pip install pypdf` and a text layer: scanned books and graphic novels are only
pictures, so they are skipped (and listed).
"""
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
from html.parser import HTMLParser

ROOT = os.path.join(os.path.dirname(__file__), '..')
CORPUS = os.path.join(ROOT, 'corpus')
OUT = os.path.join(ROOT, 'src', 'content', 'wof-frequency.tsv')

# Letters, with apostrophes inside ("don't", "Clay's"). Hyphenated words count as their parts.
WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*")
# A word seen in lowercase at least this often is a common word, not a name.
LOWERCASE_SHARE = 0.1
# Books with fewer readable words than this have no real text.
MIN_WORDS = 1000


class TextOnly(HTMLParser):
    """The readable text of an XHTML chapter, without scripts and styles."""

    SKIP = {'script', 'style', 'head'}

    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.skipping = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skipping += 1
        self.parts.append(' ')

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skipping -= 1
        self.parts.append(' ')

    def handle_data(self, data):
        if not self.skipping:
            self.parts.append(data)


def read_epub(path: str) -> str:
    out = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.lower().endswith(('.xhtml', '.html', '.htm')):
                parser = TextOnly()
                parser.feed(z.read(name).decode('utf-8', errors='ignore'))
                out.append(''.join(parser.parts))
    return '\n'.join(out)


def read_pdf(path: str) -> str:
    from pypdf import PdfReader

    text = '\n'.join(page.extract_text() or '' for page in PdfReader(path).pages)
    # A word split at the end of a line ("drag-" / "on") is one word.
    return re.sub(r'(?<=[a-z])-\n(?=[a-z])', '', text)


def read_book(path: str) -> str:
    if path.lower().endswith('.epub'):
        return read_epub(path)
    if path.lower().endswith('.pdf'):
        return read_pdf(path)
    with open(path, encoding='utf-8', errors='ignore') as f:
        return f.read()


def books(paths: list[str]) -> list[str]:
    found = []
    for p in paths:
        if os.path.isdir(p):
            for dirpath, _, files in os.walk(p):
                found += [os.path.join(dirpath, f) for f in files]
        else:
            found.append(p)
    return sorted(f for f in found if f.lower().endswith(('.epub', '.pdf', '.txt')))


def count(texts: list[str]) -> list[tuple[str, int]]:
    spellings: dict[str, Counter] = defaultdict(Counter)
    for text in texts:
        # Curly apostrophes are what ebooks actually use.
        for w in WORD.findall(text.replace('’', "'")):
            spellings[w.lower()][w] += 1
    rows = []
    for lower, seen in spellings.items():
        total = sum(seen.values())
        word = lower if seen[lower] >= total * LOWERCASE_SHARE else seen.most_common(1)[0][0]
        rows.append((word, total))
    return sorted(rows, key=lambda r: (-r[1], r[0].lower()))


def main() -> None:
    files = books(sys.argv[1:] or [CORPUS])
    if not files:
        sys.exit(f'No .epub, .pdf or .txt books found. Put them in {os.path.normpath(CORPUS)} and run again.')
    texts = []
    for f in files:
        text = read_book(f)
        words = len(WORD.findall(text))
        # A few stray words on hundreds of pages means the pages are pictures.
        if words < MIN_WORDS:
            print(f'skipped (no text): {os.path.basename(f)}')
            continue
        print(f'{words:>7} words: {os.path.basename(f)}')
        texts.append(text)
    rows = count(texts)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('word\tcount\n')
        f.writelines(f'{w}\t{n}\n' for w, n in rows)
    print(f'{len(texts)} books, {sum(n for _, n in rows)} words, {len(rows)} different -> {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
