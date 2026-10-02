# Capture real Microsoft Word window frames for docs/demo.gif.
# Requires Word installed. Outputs word-00.png … into docs/_demo-frames.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinDemo {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outDir = Join-Path $root 'docs\_demo-frames'
$rtfPath = Join-Path $outDir 'demo-paste.rtf'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (-not (Test-Path $rtfPath)) { throw "Missing RTF: $rtfPath — run node scripts/export-demo-rtf.mjs first" }

$WIDTH = 1440
$HEIGHT = 900

function Hide-WordChrome($wordApp) {
  try { $wordApp.ActiveWindow.View.Type = 3 } catch {} # wdPrintView
  try { $wordApp.ActiveWindow.View.ShowAll = $false } catch {}
  try { $wordApp.ActiveWindow.View.ShowTabs = $false } catch {}
  try { $wordApp.ActiveWindow.View.ShowSpaces = $false } catch {}
  try { $wordApp.ActiveWindow.View.ShowParagraphs = $false } catch {}
  try { $wordApp.ActiveWindow.View.ShowObjectAnchors = $false } catch {}
  try { $wordApp.ActiveWindow.View.ShowTextBoundaries = $false } catch {}
  try { $wordApp.ActiveWindow.DocumentMap = $false } catch {}
  try { $wordApp.ActiveWindow.View.Zoom.Percentage = 110 } catch {}
  try {
    for ($i = $wordApp.TaskPanes.Count; $i -ge 1; $i--) {
      try { $wordApp.TaskPanes.Item($i).Visible = $false } catch {}
    }
  } catch {}
  try { $wordApp.CommandBars.Item('Task Pane').Visible = $false } catch {}
  try {
    $ctp = $wordApp.CustomTaskPanes
    for ($i = $ctp.Count; $i -ge 1; $i--) {
      try { $ctp.Item($i).Visible = $false } catch {}
    }
  } catch {}
  # Disconnect noisy add-ins for the capture session (OfficePLUS sidebar, etc.)
  try {
    foreach ($addin in @($wordApp.COMAddIns)) {
      $id = [string]$addin.ProgId
      $desc = [string]$addin.Description
      if ($id -match 'OfficePLUS|WPS|iFly|Youdao|翻译|模板' -or $desc -match 'OfficePLUS|模板') {
        try { [void]($addin.Connect = $false) } catch {}
      }
    }
  } catch {}
  try { $wordApp.ActiveWindow.SetFocus() } catch {}
  try { $wordApp.Selection.HomeKey(6) } catch {} # wdStory
}

function Capture-Window([IntPtr]$hwnd, [string]$path) {
  $rect = New-Object WinDemo+RECT
  [void][WinDemo]::GetWindowRect($hwnd, [ref]$rect)
  $w = [Math]::Max(1, $rect.Right - $rect.Left)
  $h = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))

  # Crop add-in sidebars (OfficePLUS etc.) so the page dominates the GIF frame.
  $cropL = [int]([Math]::Round($w * 0.01))
  $cropR = [int]([Math]::Round($w * 0.20))
  $cropT = 0
  $cropB = [int]([Math]::Round($h * 0.01))
  $cw = [Math]::Max(1, $w - $cropL - $cropR)
  $ch = [Math]::Max(1, $h - $cropT - $cropB)
  $src = New-Object System.Drawing.Rectangle $cropL, $cropT, $cw, $ch
  $cropped = $bmp.Clone($src, $bmp.PixelFormat)

  $canvas = New-Object System.Drawing.Bitmap $WIDTH, $HEIGHT
  $cg = [System.Drawing.Graphics]::FromImage($canvas)
  $cg.Clear([System.Drawing.Color]::FromArgb(255, 243, 243, 243))
  $cg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale = [Math]::Min($WIDTH / [double]$cw, $HEIGHT / [double]$ch)
  $dw = [int]([Math]::Round($cw * $scale))
  $dh = [int]([Math]::Round($ch * $scale))
  $dx = [int](($WIDTH - $dw) / 2)
  $dy = [int](($HEIGHT - $dh) / 2)
  $cg.DrawImage($cropped, $dx, $dy, $dw, $dh)
  $canvas.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $cg.Dispose(); $canvas.Dispose(); $cropped.Dispose(); $g.Dispose(); $bmp.Dispose()
}

$word = New-Object -ComObject Word.Application
$word.Visible = $true
$word.DisplayAlerts = 0
Start-Sleep -Milliseconds 600

try {
  $doc = $word.Documents.Add()
  $doc.PageSetup.PageWidth = 595.3   # A4
  $doc.PageSetup.PageHeight = 841.9
  $doc.PageSetup.LeftMargin = 72
  $doc.PageSetup.RightMargin = 72
  $doc.PageSetup.TopMargin = 72
  $doc.PageSetup.BottomMargin = 72

  Hide-WordChrome $word
  Start-Sleep -Milliseconds 400
  Hide-WordChrome $word

  # Word exposes Hwnd on Application (and ActiveWindow); wait until non-zero.
  $hwnd = [IntPtr]::Zero
  for ($t = 0; $t -lt 40; $t++) {
    try {
      $raw = $word.Hwnd
      if (-not $raw) { $raw = $word.ActiveWindow.Hwnd }
      if ($raw) { $hwnd = [IntPtr]$raw; break }
    } catch {}
    Start-Sleep -Milliseconds 150
  }
  if ($hwnd -eq [IntPtr]::Zero) {
    $p = Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($p -and $p.MainWindowHandle -ne 0) { $hwnd = [IntPtr]$p.MainWindowHandle }
  }
  if ($hwnd -eq [IntPtr]::Zero) { throw 'Could not resolve Word window handle' }

  [void][WinDemo]::ShowWindow($hwnd, 5) # SW_SHOW
  Start-Sleep -Milliseconds 200
  [void][WinDemo]::MoveWindow($hwnd, 40, 40, $WIDTH, $HEIGHT, $true)
  [void][WinDemo]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 900

  Hide-WordChrome $word
  [void][WinDemo]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 250
  # Only toggle ¶ if currently visible (Ctrl+Shift+8).
  try {
    if ($word.ActiveWindow.View.ShowAll) {
      [System.Windows.Forms.SendKeys]::SendWait('^+8')
      Start-Sleep -Milliseconds 150
    }
  } catch {}
  Hide-WordChrome $word
  Start-Sleep -Milliseconds 250
  Capture-Window $hwnd (Join-Path $outDir 'word-00.png')  # empty page

  # Put RTF on clipboard then paste
  $rtf = [System.IO.File]::ReadAllText($rtfPath, [System.Text.Encoding]::UTF8)
  $data = New-Object System.Windows.Forms.DataObject
  $data.SetData([System.Windows.Forms.DataFormats]::Rtf, $false, $rtf)
  [System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
  Start-Sleep -Milliseconds 300

  Hide-WordChrome $word
  [void][WinDemo]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 200
  Capture-Window $hwnd (Join-Path $outDir 'word-01.png')  # still empty, ready to paste

  $doc.Content.Paste()
  Start-Sleep -Milliseconds 900
  Hide-WordChrome $word
  [void][WinDemo]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 200
  try {
    if ($word.ActiveWindow.View.ShowAll) {
      [System.Windows.Forms.SendKeys]::SendWait('^+8')
      Start-Sleep -Milliseconds 150
    }
  } catch {}
  Start-Sleep -Milliseconds 350
  Capture-Window $hwnd (Join-Path $outDir 'word-02.png')  # pasted

  Hide-WordChrome $word
  Start-Sleep -Milliseconds 200
  Capture-Window $hwnd (Join-Path $outDir 'word-03.png')

  Write-Host "WORD_FRAMES_OK → $outDir"
}
finally {
  try { if ($doc) { $doc.Close($false) } } catch {}
  try { $word.Quit([ref]$false) } catch {}
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
