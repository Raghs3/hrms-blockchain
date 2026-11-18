# Renders figures/*.html to PNG using headless Edge (no extra packages needed).
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir = Join-Path $PSScriptRoot "figures"
foreach ($h in Get-ChildItem $dir -Filter *.html) {
  $svgPath = $h.FullName.Replace('.html', '.svg')
  $png = $h.FullName.Replace('.html', '.png')
  $svg = Get-Content $svgPath -Raw
  $w = [int]([regex]::Match($svg, 'width="(\d+)"').Groups[1].Value)
  $ht = [int]([regex]::Match($svg, 'height="(\d+)"').Groups[1].Value)
  $url = "file:///" + $h.FullName.Replace([string][char]92, '/')
  & $edge --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 "--window-size=$w,$ht" "--screenshot=$png" $url | Out-Null
  Write-Host "rendered $($h.BaseName) ${w}x${ht}"
}
