"""Read the text of a PDF that is only pictures (a scanned book), on this computer.

Usage:
  python scripts/ocr-pdf.py <book.pdf> [<book.pdf> ...]

Each page is drawn as an image and read by the OCR built into Windows. The text goes to
corpus/ocr/<book>.txt, which wof-frequency.py then counts like any other book. corpus/ is
ignored by git, so the text never enters the repository.

Needs `pip install pymupdf`.
"""
import os
import subprocess
import sys
import tempfile

import pymupdf

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'corpus', 'ocr')
# Long side of a page image in pixels: sharp enough for book print, quick to read.
PAGE_PIXELS = 2400

# Windows OCR is a WinRT API, reached through PowerShell. Sent as a command rather than kept
# as a .ps1 file, because Windows does not run script files by default.
# Reads every image in $env:OCR_DIR and writes the text to $env:OCR_OUT.
OCR_IMAGES = r"""
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

# WinRT calls are asynchronous; PowerShell 5.1 has no await, so wait on the task.
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
function Await($operation, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
  $task.Wait()
  $task.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
if (-not $engine) { throw 'Windows has no English OCR. Add English under Settings > Time & language > Language.' }

$text = New-Object System.Text.StringBuilder
$pages = Get-ChildItem -LiteralPath $env:OCR_DIR | Where-Object { $_.Extension -in '.png', '.jpg' } | Sort-Object Name
foreach ($page in $pages) {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($page.FullName)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  foreach ($line in $result.Lines) { $null = $text.AppendLine($line.Text) }
  $bitmap.Dispose()
  $stream.Dispose()
}
[System.IO.File]::WriteAllText($env:OCR_OUT, $text.ToString(), (New-Object System.Text.UTF8Encoding $false))
"$($pages.Count) pages -> $env:OCR_OUT"
"""


def ocr(pdf: str) -> None:
    out = os.path.abspath(os.path.join(OUT, os.path.splitext(os.path.basename(pdf))[0] + '.txt'))
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as pages:
        for i, page in enumerate(pymupdf.open(pdf), 1):
            zoom = PAGE_PIXELS / max(page.rect.width, page.rect.height)
            page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(os.path.join(pages, f'p{i:04d}.png'))
        subprocess.run(
            ['powershell', '-NoProfile', '-Command', OCR_IMAGES],
            env={**os.environ, 'OCR_DIR': pages, 'OCR_OUT': out},
            check=True,
        )


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for pdf in sys.argv[1:]:
        ocr(pdf)
