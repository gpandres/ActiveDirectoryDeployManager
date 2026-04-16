// ═══════════════════════════════════════════════════════
// ps-snippets.js — shared PowerShell code fragments used
// by both script-service.js and bundle-service.js.
// ═══════════════════════════════════════════════════════

function getToastSnippet(toastTitle, toastMessage) {
  const safeTitle = (toastTitle || 'Notification').replace(/[;'"`$]/g, '');
  const safeMessage = (toastMessage || '').replace(/[;'"`$]/g, '');
  const snippet = [
    '# ── Notificacion al usuario (Session 0 workaround) ──',
    'function Send-UserToast {',
    '    param([string]$ToastTitle, [string]$ToastMessage, [string]$IconType)',
    '    try {',
    '        $LoggedUser = (Get-CimInstance Win32_ComputerSystem).UserName',
    '        if (-not $LoggedUser) { return }',
    '        $rnd = Get-Random -Minimum 1000 -Maximum 99999',
    '        $safeTitle = $ToastTitle',
    '        $safeMsg = $ToastMessage',
    '        $toastCode = "Add-Type -AssemblyName System.Windows.Forms; ' +
    '$b = New-Object System.Windows.Forms.NotifyIcon; ' +
    '$b.Icon = [System.Drawing.SystemIcons]::$IconType; ' +
    '$b.BalloonTipTitle = $safeTitle; ' +
    '$b.BalloonTipText = $safeMsg; ' +
    '$b.Visible = $true; ' +
    '$b.ShowBalloonTip(10000); ' +
    'Start-Sleep -Seconds 12; ' +
    '$b.Dispose()"',
    '        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -WindowStyle Hidden -EP Bypass -Command " + $toastCode)',
    '        $principal = New-ScheduledTaskPrincipal -UserId $LoggedUser -LogonType Interactive',
    '        $taskName = "DeployNotify_" + $rnd',
    '        Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Force | Out-Null',
    '        Start-ScheduledTask -TaskName $taskName',
    '        Start-Sleep -Seconds 15',
    '        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue',
    '    } catch {',
    '        Write-Host "[WARN] Toast notification failed: $_"',
    '    }',
    '}',
  ].join('\n');
  return snippet;
}

module.exports = { getToastSnippet };
