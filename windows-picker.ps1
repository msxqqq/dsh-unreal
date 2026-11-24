# Invoked in an STA process by the authenticated Unreal project picker.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

try {
    $inputValue = ConvertFrom-Json -InputObject $env:DSH_UNREAL_REQUEST
    if ($inputValue.mode -notin @('project', 'directory')) { throw 'Invalid picker mode.' }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $initial = [string]$inputValue.directory
    if (-not [IO.Directory]::Exists($initial)) { $initial = '' }
    $selected = $null
    if ($inputValue.mode -eq 'project') {
        $dialog = [System.Windows.Forms.OpenFileDialog]::new()
        try {
            $dialog.Title = 'Unreal - Select a .uproject file'
            $dialog.Filter = 'Unreal project (*.uproject)|*.uproject'
            $dialog.DefaultExt = 'uproject'
            $dialog.InitialDirectory = $initial
            $dialog.CheckFileExists = $true
            $dialog.CheckPathExists = $true
            $dialog.Multiselect = $false
            $dialog.RestoreDirectory = $true
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $selected = $dialog.FileName }
        } finally { $dialog.Dispose() }
    } else {
        $dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
        try {
            $dialog.Description = 'Unreal - Select a folder for the new project'
            $dialog.SelectedPath = $initial
            $dialog.ShowNewFolderButton = $false
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $selected = $dialog.SelectedPath }
        } finally { $dialog.Dispose() }
    }
    $response = @{ ok = $true; path = $selected }
} catch {
    $response = @{ ok = $false; error = $_.Exception.Message }
}
ConvertTo-Json -Compress -InputObject $response
