$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$launcher = Join-Path $PSScriptRoot 'windows-ue.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$errors)
if ($errors) { throw ($errors -join "`n") }
$null = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'windows-picker.ps1'), [ref]$tokens, [ref]$errors)
if ($errors) { throw ($errors -join "`n") }
$functions = $ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -in @('Field','To-Project') }
. ([scriptblock]::Create(($functions | ForEach-Object { $_.Extent.Text }) -join "`n"))
$editor = [pscustomobject]@{ pid = 42; path = 'C:\Projects\Game.uproject'; preferredPort = 18000 }
function Listener($address, $port, $owner) {
    [pscustomobject]@{ LocalAddress = $address; LocalPort = $port; OwningProcess = $owner }
}
$listeners = @((Listener '127.0.0.1' 8000 42), (Listener '0.0.0.0' 8000 43),
    (Listener '127.0.0.1' 18000 42), (Listener '127.0.0.1' 18001 42), (Listener '::' 18001 43),
    (Listener '127.0.0.1' 18002 42), (Listener '127.0.0.1' 18002 43),
    (Listener '127.0.0.1' 18003 42), (Listener '192.0.2.1' 18003 42))
$result = To-Project $editor $listeners
if (($result.ports -join ',') -ne '18000') { throw 'Only the exclusive loopback port should be accepted.' }
'Windows scripts parse; exclusive loopback port check passed.'
