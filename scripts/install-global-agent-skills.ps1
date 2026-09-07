param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot "..\.agents\skills"),
    [string]$TargetRoot = (Join-Path $HOME ".agents\skills")
)

$ErrorActionPreference = "Stop"

$skillNames = @(
    "interview-me",
    "code-review-and-quality",
    "test-driven-development"
)

function Test-SkillFile {
    param(
        [string]$SkillName,
        [string]$SkillFile
    )

    if (-not (Test-Path -LiteralPath $SkillFile -PathType Leaf)) {
        throw "Missing skill file: $SkillFile"
    }

    $content = Get-Content -LiteralPath $SkillFile -Raw
    $frontMatter = [regex]::Match($content, "(?s)^---\r?\n(?<yaml>.*?)\r?\n---")

    if (-not $frontMatter.Success) {
        throw "Skill file is missing YAML frontmatter: $SkillFile"
    }

    $yaml = $frontMatter.Groups["yaml"].Value

    if ($yaml -notmatch "(?m)^name:\s*$([regex]::Escape($SkillName))\s*$") {
        throw "Skill file frontmatter has an unexpected or missing name: $SkillFile"
    }

    if ($yaml -notmatch "(?m)^description:\s*\S+") {
        throw "Skill file frontmatter is missing a description: $SkillFile"
    }
}

$resolvedSourceRoot = [System.IO.Path]::GetFullPath($SourceRoot)
$resolvedTargetRoot = [System.IO.Path]::GetFullPath($TargetRoot)
$expectedTargetRoot = [System.IO.Path]::GetFullPath((Join-Path $HOME ".agents\skills"))

if ($resolvedTargetRoot -ne $expectedTargetRoot) {
    throw "TargetRoot must resolve to the user's global skills folder: $expectedTargetRoot"
}

foreach ($skillName in $skillNames) {
    $sourceSkillDir = Join-Path $resolvedSourceRoot $skillName
    $sourceSkillFile = Join-Path $sourceSkillDir "SKILL.md"

    if (-not (Test-Path -LiteralPath $sourceSkillFile -PathType Leaf)) {
        throw "Missing source skill file: $sourceSkillFile"
    }

    Test-SkillFile -SkillName $skillName -SkillFile $sourceSkillFile
}

New-Item -ItemType Directory -Path $resolvedTargetRoot -Force | Out-Null

foreach ($skillName in $skillNames) {
    $sourceSkillDir = Join-Path $resolvedSourceRoot $skillName
    $targetSkillDir = Join-Path $resolvedTargetRoot $skillName

    New-Item -ItemType Directory -Path $targetSkillDir -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourceSkillDir "SKILL.md") -Destination (Join-Path $targetSkillDir "SKILL.md") -Force

    $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $sourceSkillDir "SKILL.md")).Hash
    $targetHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $targetSkillDir "SKILL.md")).Hash

    if ($sourceHash -ne $targetHash) {
        throw "Hash mismatch after copying skill: $skillName"
    }

    Test-SkillFile -SkillName $skillName -SkillFile (Join-Path $targetSkillDir "SKILL.md")
}

Write-Host "Installed skills:"
foreach ($skillName in $skillNames) {
    Write-Host "- $skillName -> $(Join-Path $resolvedTargetRoot $skillName)"
}
