# Delegates to cross-platform sync (single source of truth).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
node "$PSScriptRoot/sync-integrations.js" @args
