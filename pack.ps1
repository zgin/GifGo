# Builds the Chrome Web Store zip from an explicit file list, so nothing that
# is not part of the extension can wander into the package.
#
#   powershell -ExecutionPolicy Bypass -File pack.ps1
#
# Output lands in dist/gifgo-<version>.zip.

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# Everything the extension needs, and nothing else. Add to this list when you
# add a file the popup actually loads; the reference check below will fail the
# build if you forget.
$Files = @(
    'manifest.json',
    'popup.html',
    'css/popup.css',
    'js/popup.js',
    'js/api.js',
    'js/storage.js',
    'js/clipboard.js',
    'js/background.js',
    'js/remoteConfig.js',
    'images/gifgo_logo_128.png',
    'images/giphy_attribution.gif',
    'images/starfield.gif'
)

# ---------- checks ----------

$missing = $Files | Where-Object { -not (Test-Path $_) }
if ($missing) {
    Write-Host "Missing files:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  $_" }
    exit 1
}

# Walk what the shipped files actually reference (script/link/img sources, css
# url(), js imports) and make sure each one is in the list. This is what keeps
# the explicit list honest as the popup grows.
function Get-References($path) {
    $text = Get-Content $path -Raw
    $refs = @()
    $patterns = @(
        '(?:src|href)\s*=\s*"([^"]+)"',
        "url\(\s*'([^']+)'\s*\)",
        'url\(\s*"([^"]+)"\s*\)',
        "from\s+'([^']+)'"
    )
    foreach ($pattern in $patterns) {
        foreach ($m in [regex]::Matches($text, $pattern)) {
            $refs += $m.Groups[1].Value
        }
    }
    return $refs
}

$packed = $Files | ForEach-Object { $_.Replace('\', '/') }
$problems = @()

foreach ($file in $Files) {
    if ($file -notmatch '\.(html|css|js)$') { continue }
    $dir = Split-Path $file -Parent
    foreach ($ref in (Get-References $file)) {
        # Only local references matter; remote urls are not packaged, and
        # anything built at runtime (the img tag clipboard.js writes) has no
        # file behind it.
        if ($ref -match '^(https?:|data:|mailto:|#)') { continue }
        if ($ref -match '\$\{') { continue }
        $resolved = if ($dir) { "$dir/$ref" } else { $ref }
        # Normalise ../ and ./ segments into a clean repo-relative path.
        $parts = New-Object System.Collections.ArrayList
        foreach ($seg in ($resolved -split '[\\/]')) {
            if ($seg -eq '.' -or $seg -eq '') { continue }
            if ($seg -eq '..') {
                if ($parts.Count -gt 0) { $parts.RemoveAt($parts.Count - 1) }
                continue
            }
            [void]$parts.Add($seg)
        }
        $clean = ($parts -join '/')
        if ($packed -notcontains $clean) {
            $problems += "$file references $ref ($clean), which is not in the file list"
        }
    }
}

if ($problems) {
    Write-Host "Reference check failed:" -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "  $_" }
    exit 1
}

# ---------- pack ----------

$manifest = Get-Content 'manifest.json' -Raw | ConvertFrom-Json
$version = $manifest.version
$dist = Join-Path $PSScriptRoot 'dist'
$zip = Join-Path $dist "gifgo-$version.zip"

New-Item -ItemType Directory -Force -Path $dist | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Force }

# Write the entries by hand rather than using Compress-Archive: it names
# entries with backslashes, and the zip format wants forward slashes, which
# some unpackers read as one flat filename instead of a folder.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
    foreach ($file in $Files) {
        $entry = $file.Replace('\', '/')
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, (Resolve-Path $file).Path, $entry)
    }
} finally {
    $archive.Dispose()
}

$size = [math]::Round((Get-Item $zip).Length / 1KB, 1)
Write-Host "Packed $($Files.Count) files into dist/gifgo-$version.zip ($size KB)" -ForegroundColor Green
$check = [System.IO.Compression.ZipFile]::OpenRead($zip)
$check.Entries | ForEach-Object { Write-Host "  $($_.FullName)" }
$check.Dispose()
