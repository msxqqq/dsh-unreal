# Windows Unreal discovery and launcher. The host supplies one trusted JSON request.
# No desktop automation, process termination, arbitrary executable, or shell command.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Set-StrictMode -Version 2

function Field($object, [string]$name, $default = $null) {
    $property = $object.PSObject.Properties[$name]
    if ($null -eq $property) { return $default }
    return $property.Value
}

function LocalPath([string]$path) {
    if ($path -notmatch '^[A-Za-z]:[\\/]' -or $path.Substring(2) -match '[\x00-\x1f<>:"|?*]') {
        throw 'Expected an absolute local Windows path.'
    }
    return [IO.Path]::GetFullPath($path)
}

function ProjectPath([string]$path) {
    $full = LocalPath $path
    if ([IO.Path]::GetExtension($full) -ine '.uproject') { throw 'Expected a .uproject path.' }
    return $full
}

function ReadJson([string]$path) {
    return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Get-Engines {
    # Epic launcher metadata and UnrealVersionSelector registrations (including source builds).
    $roots = @{}
    if ($env:ProgramData) {
        foreach ($relative in @('Epic\UnrealEngineLauncher\LauncherInstalled.dat', 'UnrealEngineLauncher\LauncherInstalled.dat')) {
            $file = Join-Path $env:ProgramData $relative
            if (Test-Path -LiteralPath $file -PathType Leaf) {
                try {
                    foreach ($item in @((ReadJson $file).InstallationList)) {
                        if ($item.AppName -match '^UE_(\d+\.\d+(?:\.\d+)?)$') { $roots[$Matches[1]] = $item.InstallLocation }
                    }
                } catch { }
            }
        }
    }
    foreach ($keyPath in @('HKLM:\SOFTWARE\EpicGames\Unreal Engine', 'HKLM:\SOFTWARE\WOW6432Node\EpicGames\Unreal Engine')) {
        foreach ($key in @(Get-ChildItem -LiteralPath $keyPath -ErrorAction SilentlyContinue)) {
            $root = $key.GetValue('InstalledDirectory')
            if ($root) { $roots[$key.PSChildName] = $root }
        }
    }
    $custom = Get-Item -LiteralPath 'HKCU:\Software\Epic Games\Unreal Engine\Builds' -ErrorAction SilentlyContinue
    if ($custom) {
        foreach ($id in $custom.GetValueNames()) {
            $root = $custom.GetValue($id)
            if ($id -and $root -is [string]) { $roots[$id] = $root }
        }
    }
    foreach ($id in $roots.Keys) {
        try {
            $root = LocalPath $roots[$id]
            $exe = Join-Path $root 'Engine\Binaries\Win64\UnrealEditor.exe'
            if (-not (Test-Path -LiteralPath $exe -PathType Leaf) -or -not (Has-Mcp $exe)) { continue }
            $build = ReadJson (Join-Path $root 'Engine\Build\Build.version')
            $version = [version]::new([int]$build.MajorVersion, [int]$build.MinorVersion, [int]$build.PatchVersion)
            if ($version.Major -ne 5 -or $version.Minor -notin @(8,9)) { continue }
            $mcp = ReadJson (Mcp-DescriptorPath $exe)
            $toolset = Join-Path $root 'Engine\Plugins\Experimental\Toolsets\EditorToolset'
            $editorToolset = (Test-Path -LiteralPath (Join-Path $toolset 'EditorToolset.uplugin') -PathType Leaf) -and
                (Test-Path -LiteralPath (Join-Path $toolset 'Binaries\Win64\UnrealEditor-EditorToolset.dll') -PathType Leaf)
            [pscustomobject]@{ id = $id; name = "Unreal Engine $version ($id)"; root = $root; exe = $exe; version = $version;
                mcpDefault = (Field $mcp 'EnabledByDefault' $false) -eq $true; editorToolset = $editorToolset }
        } catch { }
    }
}

function Mcp-DescriptorPath([string]$exe) {
    $bin = [IO.Path]::GetDirectoryName($exe)
    $engine = [IO.Path]::GetDirectoryName([IO.Path]::GetDirectoryName($bin))
    return (Join-Path $engine 'Plugins\Experimental\ModelContextProtocol\ModelContextProtocol.uplugin')
}

function Test-SupportedEngine([string]$exe) {
    if (-not $exe -or -not (Has-Mcp $exe)) { return $false }
    try {
        $engineRoot = [IO.Path]::GetDirectoryName([IO.Path]::GetDirectoryName([IO.Path]::GetDirectoryName($exe)))
        $build = ReadJson (Join-Path $engineRoot 'Build\Build.version')
        return $build.MajorVersion -eq 5 -and $build.MinorVersion -in @(8,9)
    } catch { return $false }
}

function Has-Mcp([string]$exe) {
    $manifest = Mcp-DescriptorPath $exe
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { return $false }
    $plugin = [IO.Path]::GetDirectoryName($manifest)
    foreach ($module in @('ModelContextProtocol','ModelContextProtocolEngine','ModelContextProtocolEditor')) {
        if (-not (Test-Path -LiteralPath (Join-Path $plugin "Binaries\Win64\UnrealEditor-$module.dll") -PathType Leaf)) { return $false }
    }
    return $true
}

function Initialize-Win32 {
    if (-not ('DshUnreal.Win32' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace DshUnreal {
    public static class Win32 {
        [StructLayout(LayoutKind.Sequential)]
        struct STARTUPINFO {
            public int cb;
            public IntPtr reserved, desktop, title;
            public int x, y, xSize, ySize, xCountChars, yCountChars, fillAttribute, flags;
            public short showWindow, reserved2Size;
            public IntPtr reserved2, stdin, stdout, stderr;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct PROCESS_INFORMATION {
            public IntPtr process, thread;
            public int processId, threadId;
        }
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
        static extern bool CreateProcessW(string exe, System.Text.StringBuilder commandLine,
            IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment,
            string directory, ref STARTUPINFO startup, out PROCESS_INFORMATION process);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
        public static int StartEditor(string exe, string arguments, string directory, string[] environment) {
            Array.Sort(environment, StringComparer.OrdinalIgnoreCase);
            IntPtr block = Marshal.StringToHGlobalUni(String.Join("\0", environment) + "\0\0");
            try {
                var startup = new STARTUPINFO();
                startup.cb = Marshal.SizeOf(typeof(STARTUPINFO));
                var command = new System.Text.StringBuilder("\"" + exe + "\" " + arguments);
                PROCESS_INFORMATION process;
                // CREATE_UNICODE_ENVIRONMENT | CREATE_NEW_PROCESS_GROUP, with explicit
                // noninheritance of all handles (including the captured console pipes).
                if (!CreateProcessW(exe, command, IntPtr.Zero, IntPtr.Zero, false, 0x600,
                        block, directory, ref startup, out process)) {
                    throw new System.ComponentModel.Win32Exception();
                }
                CloseHandle(process.thread);
                CloseHandle(process.process);
                return process.processId;
            } finally { Marshal.FreeHGlobal(block); }
        }
    }
}
'@
    }
}

function Split-CommandLine([string]$text) {
    # Windows backslash/quote rules for arguments; CIM supplies the .exe as argv[0].
    $i = 0
    while ($i -lt $text.Length) {
        if ([char]::IsWhiteSpace($text[$i])) { $i++; continue }
        $quoted = $false
        $token = [Text.StringBuilder]::new()
        while ($i -lt $text.Length -and ($quoted -or -not [char]::IsWhiteSpace($text[$i]))) {
            $slashes = 0
            while ($i -lt $text.Length -and $text[$i] -eq '\') { $slashes++; $i++ }
            if ($i -lt $text.Length -and $text[$i] -eq '"') {
                [void]$token.Append([char]'\', [int][math]::Floor($slashes / 2))
                $i++
                if (($slashes % 2) -ne 0) { [void]$token.Append('"') }
                elseif ($quoted -and $i -lt $text.Length -and $text[$i] -eq '"') { [void]$token.Append('"'); $i++ }
                else { $quoted = -not $quoted }
            } else {
                [void]$token.Append([char]'\', $slashes)
                if ($i -lt $text.Length -and ($quoted -or -not [char]::IsWhiteSpace($text[$i]))) {
                    [void]$token.Append($text[$i]); $i++
                }
            }
        }
        if ($quoted) { throw 'Windows returned an unterminated editor command-line argument.' }
        $token.ToString()
    }
}

function Get-EditorEnvironment {
    # Allow-list Windows/graphics/build essentials; do not inherit arbitrary API
    # keys, credentials, tool arguments, or DSH_* variables from the Host process.
    $allowed = @('SystemRoot','windir','SystemDrive','ProgramData','ALLUSERSPROFILE','ProgramFiles','ProgramFiles(x86)',
        'ProgramW6432','CommonProgramFiles','CommonProgramFiles(x86)','CommonProgramW6432','PUBLIC','USERPROFILE',
        'HOMEDRIVE','HOMEPATH','USERNAME','USERDOMAIN','COMPUTERNAME','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH','PATHEXT',
        'ComSpec','PROCESSOR_ARCHITECTURE','PROCESSOR_ARCHITEW6432','NUMBER_OF_PROCESSORS','OS','SESSIONNAME')
    foreach ($name in $allowed) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($null -ne $value) { "$name=$value" }
    }
}

function Get-Editors {
    foreach ($process in @(Get-CimInstance Win32_Process -Filter "Name = 'UnrealEditor.exe'")) {
        $row = [pscustomobject]@{ pid = [int]$process.ProcessId; path = $null; exe = $null; headless = $false; preferredPort = 0 }
        if ($process.CommandLine) {
            $tokens = @()
            try { $tokens = @(Split-CommandLine $process.CommandLine | Select-Object -Skip 1) } catch { }
            foreach ($token in $tokens) {
                if ($token -match '^[-/](run(?:=|$)|unattended(?:=|$)|nullrhi(?:=|$)|server(?:=|$)|game(?:=|$)|commandlet(?:=|$)|ExecutePythonScript(?:=|$))') {
                    $row.headless = $true
                }
                if ($token -match '^[-/]ModelContextProtocolPort=(\d{1,5})$' -and [int]$Matches[1] -le 65535) {
                    $row.preferredPort = [int]$Matches[1]
                }
            }
            # LaunchEngineLoop uses -project= when present, otherwise the first token.
            # Do not mistake some unrelated argument ending in .uproject for a project.
            $explicit = @($tokens | Where-Object { $_ -match '^[-/]project=' })
            $projectArg = $null
            if ($explicit.Count -eq 1) { $projectArg = $explicit[0].Substring(9) }
            elseif ($explicit.Count -eq 0 -and $tokens.Count -gt 0) { $projectArg = $tokens[0] }
            if ($projectArg) {
                try {
                    $candidate = ProjectPath $projectArg
                    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $row.path = $candidate }
                } catch { }
            }
        }
        if ($process.ExecutablePath -match '(?i)[\\/]Engine[\\/]Binaries[\\/]Win64[\\/]UnrealEditor\.exe$') {
            $row.exe = LocalPath $process.ExecutablePath
        }
        $row
    }
}

function Get-Listeners {
    # No TCP connection or UE message: read the Windows TCP table. NetTCPIP reports
    # an empty filtered query as an error, so retrieve then filter the full table.
    return @(Get-NetTCPConnection | Where-Object { $_.State -eq 'Listen' })
}

function To-Project($editor, $listeners) {
    $owned = @($listeners | Where-Object { $_.OwningProcess -eq $editor.pid })
    $external = @($owned | Where-Object { $_.LocalAddress -notin @('127.0.0.1','::1') } | ForEach-Object { [int]$_.LocalPort })
    $competing = @($listeners | Where-Object { $_.OwningProcess -ne $editor.pid -and
        $_.LocalAddress -in @('127.0.0.1','0.0.0.0','::','::ffff:127.0.0.1','::ffff:7f00:1','::ffff:0.0.0.0') } |
        ForEach-Object { [int]$_.LocalPort })
    $local = @($owned | Where-Object { $_.LocalAddress -eq '127.0.0.1' -and
        $external -notcontains [int]$_.LocalPort -and $competing -notcontains [int]$_.LocalPort } |
        ForEach-Object { [int]$_.LocalPort } | Sort-Object -Unique)
    $preferred = [int](Field $editor 'preferredPort' 0)
    $ports = @((@($preferred,8000) + $local) | Where-Object { $local -contains $_ } | Select-Object -Unique)
    return [ordered]@{ path = $editor.path; pid = $editor.pid; name = [IO.Path]::GetFileNameWithoutExtension($editor.path);
        ports = $ports; supportedEngine = (Test-SupportedEngine (Field $editor 'exe' '')) }
}

function Fail([string]$status, [string]$message, $project = $null, $port = $null) {
    $result = [ordered]@{ ok = $false; status = $status; error = $message }
    if ($null -ne $project) { $result.project = $project }
    if ($null -ne $port) { $result.port = $port }
    return $result
}

function Free-Port($listeners) {
    # Skip any listed address for these ports. Release the test bind before the editor starts;
    # this cannot eliminate a race with another process, so verify ownership afterward.
    $used = @($listeners | ForEach-Object { [int]$_.LocalPort })
    foreach ($port in (@(8000) + @(18000..18063))) {
        if ($used -contains $port) { continue }
        $socket = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
        try { $socket.ExclusiveAddressUse = $true; $socket.Start(); return $port }
        catch [Net.Sockets.SocketException] { }
        finally { $socket.Stop() }
    }
    throw 'No free loopback port found for Unreal MCP.'
}

function Assert-NoReparse([string]$path) {
    $directory = [IO.DirectoryInfo]::new($path)
    while ($null -ne $directory) {
        $item = Get-Item -LiteralPath $directory.FullName -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'The workspace project path must not traverse junctions or symbolic links.'
        }
        $directory = $directory.Parent
    }
}

function Assert-NewPath([string]$path, [string]$workspace) {
    $base = (LocalPath $workspace).TrimEnd('\') + '\'
    $dir = [IO.Path]::GetDirectoryName($path)
    $parent = [IO.Path]::GetDirectoryName($dir)
    $name = [IO.Path]::GetFileNameWithoutExtension($path)
    if (-not $dir.StartsWith($base, [StringComparison]::OrdinalIgnoreCase) -or
        $parent.TrimEnd('\') -ine $base.TrimEnd('\') -or
        [IO.Path]::GetFileName($dir) -ine $name -or $name -notmatch '^\p{L}[\p{L}\p{Nd}_]{0,19}$' -or
        $name -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]|Win64|Windows|Linux|Mac|Android|IOS)$') {
        throw 'Use a new Name\\Name.uproject path directly under the selected directory (1-20 letters, digits or underscores; begin with a letter).'
    }
    Assert-NoReparse $parent
    if (Test-Path -LiteralPath $dir) { throw 'The new project directory already exists; nothing was overwritten.' }
}

function Has-ListenerOverrides([string]$root) {
    # Port-specific entries win even over the HTTPServer default passed on the
    # command line. Do not auto-launch when a local ini could override it.
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { return $false }
    foreach ($file in @(Get-ChildItem -LiteralPath $root -File -Filter '*.ini' -Recurse)) {
        if (Select-String -LiteralPath $file.FullName -Pattern '^\s*[+.]?ListenerOverrides\s*=' -Quiet) { return $true }
    }
    return $false
}

function Write-NewProject([string]$path, $engine) {
    # New-Item on an existing directory fails without -Force, including a competing creator.
    $dir = [IO.Path]::GetDirectoryName($path)
    New-Item -Path ([IO.Path]::GetDirectoryName($dir)) -Name ([IO.Path]::GetFileName($dir)) -ItemType Directory | Out-Null
    Assert-NoReparse $dir
    $plugins = @(@{ Name = 'ModelContextProtocol'; Enabled = $true })
    if ($engine.editorToolset) { $plugins += @{ Name = 'EditorToolset'; Enabled = $true } }
    $descriptor = [ordered]@{
        FileVersion = 3; EngineAssociation = $engine.id; Category = ''; Description = ''
        Plugins = $plugins
    }
    $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes(($descriptor | ConvertTo-Json -Depth 4))
        $stream.Write($bytes, 0, $bytes.Length)
    } finally { $stream.Dispose() }
}

function Get-EditorArguments([string]$path, [int]$port, [int]$minor) {
    $module = if ($minor -ge 9) { 'ModelContextProtocol' } else { 'ModelContextProtocolEngine' }
    return '"' + $path + '" -ModelContextProtocolStartServer -ModelContextProtocolPort=' + $port +
        ' -ini:Engine:[HTTPServer.Listeners]:DefaultBindAddress=127.0.0.1,[HTTPServer.Listeners]:DefaultReuseAddressAndPort=False' +
        " -ini:EditorPerProjectUserSettings:[/Script/$module.ModelContextProtocolSettings]:ServerUrlPath=/mcp"
}

function Invoke-Request($request) {
    $action = Field $request 'action'
    if ($action -notin @('discover','prepare','verify')) { return Fail 'invalid_request' 'Unknown Unreal launcher action.' }
    $editors = @(Get-Editors | Where-Object { -not $_.headless })
    $listeners = @(Get-Listeners)
    if ($action -eq 'discover') {
        return [ordered]@{
            ok = $true
            projects = @($editors | Where-Object { $_.path -and $_.exe } | ForEach-Object { To-Project $_ $listeners })
            engines = @(Get-Engines | Sort-Object version -Descending | Select-Object id,name)
        }
    }

    $path = ProjectPath (Field $request 'path' '')
    $pidWanted = 0
    $pidField = Field $request 'pid'
    if ($null -ne $pidField -and (-not [int]::TryParse([string]$pidField, [ref]$pidWanted) -or $pidWanted -le 0)) {
        return Fail 'invalid_request' 'Expected a positive editor PID.'
    }
    $wanted = @($editors | Where-Object { $_.path -ieq $path -and $_.exe -and ($pidWanted -eq 0 -or $_.pid -eq $pidWanted) })
    if ($action -eq 'verify') {
        $port = 0
        if (-not [int]::TryParse([string](Field $request 'port'), [ref]$port) -or $port -lt 1 -or $port -gt 65535 -or $pidWanted -eq 0) {
            return Fail 'invalid_request' 'Verification needs an editor PID and a valid port.'
        }
        if ($wanted.Count -ne 1) { return Fail 'identity_mismatch' 'The selected PID is not a verifiable interactive editor for that project.' }
        $project = To-Project $wanted[0] $listeners
        if ($project.ports -notcontains $port) { return Fail 'not_ready' 'That editor does not own the requested loopback listener.' $project $port }
        return [ordered]@{ ok = $true; status = 'ready'; project = $project; port = $port }
    }

    if ($wanted.Count -gt 1) { return Fail 'ambiguous_project' 'More than one Unreal Editor is open for this project; select a PID.' }
    if ($pidWanted -gt 0 -and $wanted.Count -ne 1) { return Fail 'identity_mismatch' 'The selected editor is no longer verifiable; rediscover before launching.' }
    $create = (Field $request 'create' $false) -eq $true
    if ($create -and (Test-Path -LiteralPath $path)) { return Fail 'already_exists' 'The project already exists; nothing was overwritten.' }
    if ($wanted.Count -eq 1) {
        $project = To-Project $wanted[0] $listeners
        $skip = @(Field $request 'skipPorts' @())
        $candidates = @($project.ports | Where-Object { $skip -notcontains $_ })
        if ($candidates.Count -gt 0) {
            return [ordered]@{ ok = $true; status = 'ready'; project = $project; port = $candidates[0] }
        }
        if (-not (Has-Mcp $wanted[0].exe)) {
            return Fail 'restart_required' 'This editor build has no compiled Unreal MCP plugin. Save and close it yourself, then select a compatible engine. No editor was stopped.' $project
        }
        $port = Free-Port $listeners
        return Fail 'manual_start_required' "In this editor's Output Log command box, run ModelContextProtocol.StartServer $port. If the command is unavailable, enable Unreal MCP and restart after saving. No editor was stopped." $project $port
    }
    # An inaccessible/relative project argument is not a safe basis for starting a duplicate.
    if (@($editors | Where-Object { -not $_.path -or -not $_.exe }).Count -gt 0) {
        return Fail 'identity_unknown' 'Windows did not expose enough information to identify every open interactive Unreal Editor. Close the unidentified editor yourself or open and connect to the desired project manually.'
    }

    if ($create) {
        Assert-NewPath $path (Field $request 'workspace' '')
    } elseif (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return Fail 'project_missing' 'The .uproject does not exist.'
    }
    $engines = @(Get-Engines | Sort-Object version -Descending)
    $id = [string](Field $request 'engineId' '')
    if (-not $create) {
        $descriptor = ReadJson $path
        if (-not $id) { $id = [string](Field $descriptor 'EngineAssociation' '') }
    }
    if (-not $id -and $create -and $engines.Count -gt 0) { $id = $engines[0].id }
    $selected = @($engines | Where-Object { $_.id -ieq $id })
    if ($selected.Count -ne 1) { return Fail 'engine_selection_required' 'Choose a registered Unreal Engine installation with a compiled ModelContextProtocol plugin.' }
    $engine = $selected[0]
    if (-not $create) {
        $plugins = @(Field $descriptor 'Plugins' @())
        $mcp = @($plugins | Where-Object { $null -ne $_ -and (Field $_ 'Name') -eq 'ModelContextProtocol' })
        if (($mcp.Count -eq 0 -and -not $engine.mcpDefault) -or
            ($mcp.Count -gt 0 -and ($mcp.Count -ne 1 -or (Field $mcp[0] 'Enabled') -ne $true))) {
            return Fail 'plugin_required' 'Enable Unreal MCP (ModelContextProtocol) for this project first. No project files were changed.'
        }
    }

    $directory = [IO.Path]::GetDirectoryName($path)
    $configRoots = @((Join-Path $engine.root 'Engine\Config'), (Join-Path $engine.root 'Engine\Platforms\Windows\Config'),
        (Join-Path $directory 'Config'), (Join-Path $directory 'Platforms\Windows\Config'), (Join-Path $directory 'Saved\Config'))
    foreach ($userRoot in @([Environment]::GetFolderPath('LocalApplicationData'), [Environment]::GetFolderPath('MyDocuments'))) {
        if ($userRoot) { $configRoots += Join-Path $userRoot 'Unreal Engine\Engine\Config' }
    }
    if ($env:ProgramData) { $configRoots += Join-Path $env:ProgramData 'Epic\Unreal Engine\Engine\Config' }
    foreach ($config in $configRoots) {
        if (Has-ListenerOverrides $config) {
            return Fail 'manual_launch_required' 'A local HTTP listener override can supersede the loopback launch option. No editor was launched; review the configuration before opening the project.'
        }
    }
    $port = Free-Port $listeners
    Initialize-Win32
    if ($create) { Write-NewProject $path $engine }
    $arguments = Get-EditorArguments $path $port $engine.version.Minor
    try {
        $editorPid = [DshUnreal.Win32]::StartEditor($engine.exe, $arguments, [IO.Path]::GetDirectoryName($engine.exe), [string[]]@(Get-EditorEnvironment))
    } catch {
        if ($create) { return Fail 'created_not_started' "Project created at $path, but Unreal Editor could not start. Use Open existing project. $($_.Exception.Message)" }
        throw
    }
    $project = To-Project ([pscustomobject]@{ path = $path; pid = $editorPid }) @()
    return [ordered]@{ ok = $true; status = 'starting'; project = $project; port = $port }
}

try {
    if (-not $env:DSH_UNREAL_REQUEST) { throw 'Missing DSH_UNREAL_REQUEST.' }
    $request = ConvertFrom-Json -InputObject $env:DSH_UNREAL_REQUEST
    if ($null -eq $request -or $request -isnot [pscustomobject]) { throw 'Expected one Unreal launcher request object.' }
    $result = Invoke-Request $request
} catch {
    $result = Fail 'windows_error' $_.Exception.Message
}
ConvertTo-Json -InputObject $result -Depth 8 -Compress
