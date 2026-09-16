$ErrorActionPreference = 'Stop'
$src = 'D:\workspace\maxlabel\app\docs\labelshop-help-zh'
$dst = 'D:\workspace\maxlabel\parity\_work\extract'
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
$enc = [System.Text.Encoding]::GetEncoding(936)

function Convert-Html([string]$h) {
  # isolate content div
  $start = $h.IndexOf('<div id="winchm_template_content"')
  if ($start -ge 0) {
    $end = $h.IndexOf('id="winchm_template_footer"', $start)
    if ($end -lt 0) { $end = $h.Length }
    $h = $h.Substring($start, $end - $start)
  }
  # drop html comments
  $h = [regex]::Replace($h, '(?s)<!--.*?-->', ' ')
  # drop script/style blocks
  $h = [regex]::Replace($h, '(?is)<script.*?</script>', ' ')
  $h = [regex]::Replace($h, '(?is)<style.*?</style>', ' ')
  $h = [regex]::Replace($h, '(?is)<head.*?</head>', ' ')
  # drop images entirely
  $h = [regex]::Replace($h, '(?is)<img[^>]*>', ' ')
  # drop any leftover partial tag fragments from comment removal
  $h = [regex]::Replace($h, '(?s)</?[a-zA-Z][^<>]*$', ' ')
  # block-level tags -> newline markers
  $h = [regex]::Replace($h, '(?is)<br\s*/?>', "`n")
  $h = [regex]::Replace($h, '(?is)</(p|div|tr|li|h1|h2|h3|h4|table|ul|ol|blockquote)>', "`n")
  $h = [regex]::Replace($h, '(?is)<(p|div|tr|li|h1|h2|h3|h4|table|ul|ol|blockquote)[^>]*>', "`n")
  $h = [regex]::Replace($h, '(?is)</?(td|th)[^>]*>', ' | ')
  # strip any remaining tags
  $h = [regex]::Replace($h, '(?s)<[^>]+>', ' ')
  # entities
  $h = $h -replace '(?i)&nbsp;', ' '
  $h = $h -replace '(?i)&lt;', '<'
  $h = $h -replace '(?i)&gt;', '>'
  $h = $h -replace '(?i)&quot;', '"'
  $h = $h -replace '(?i)&amp;', '&'
  $h = $h -replace '(?i)&copy;', '(c)'
  $h = $h -replace '&#(\d+);', ' '
  # textarea remnants etc
  $lines = $h -split "`n"
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($l in $lines) {
    $t = $l.Trim()
    $t = [regex]::Replace($t, '\s{2,}', ' ')
    $t = [regex]::Replace($t, '(\s*\|\s*)+', ' | ')
    $t = $t.Trim()
    if ($t -ne '' -and $t -ne '|') { $out.Add($t) }
  }
  return ($out -join "`n")
}

$files = Get-ChildItem -Path $src -Filter *.html | Sort-Object Name
foreach ($f in $files) {
  $text = $enc.GetString([System.IO.File]::ReadAllBytes($f.FullName))
  $body = Convert-Html $text
  $title = ''
  $m = [regex]::Match($text, '(?is)<title>(.*?)</title>')
  if ($m.Success) { $title = $m.Groups[1].Value.Trim() }
  $o = "=== $($f.Name) === TITLE: $title`n$body`n"
  [System.IO.File]::WriteAllText((Join-Path $dst ($f.BaseName + '.txt')), $o, (New-Object System.Text.UTF8Encoding($false)))
}
Write-Output ("extracted " + $files.Count + " files")
