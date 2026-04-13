// ═══════════════════════════════════════════════════════
// ps-snippets.js — shared PowerShell code fragments used
// by both script-service.js and bundle-service.js.
// ═══════════════════════════════════════════════════════

/**
 * Returns the PowerShell `Send-UserToast` function definition.
 * Works in Session 0 (SYSTEM context under GPO startup scripts)
 * by creating a scheduled task that runs under the logged-on user.
 *
 * Parameters exposed to the caller's PS script:
 *   -ToastTitle  string
 *   -ToastMessage string
 *   -IconType    string  (e.g. "Warning", "Information")
 */
function getToastSnippet() {
  return `
# ── Notificación al usuario (Session 0 workaround) ──
function Send-UserToast {
    param([string]$ToastTitle, [string]$ToastMessage, [string]$IconType)
    try {
        $LoggedUser = (Get-CimInstance Win32_ComputerSystem).UserName
        if (-not $LoggedUser) { return }
        $rnd = Get-Random -Minimum 1000 -Maximum 99999
        $toastCode = "Add-Type -AssemblyName System.Windows.Forms; " +
            "\`$b = New-Object System.Windows.Forms.NotifyIcon; " +
            "\`$b.Icon = [System.Drawing.SystemIcons]::$IconType; " +
            "\`$b.BalloonTipTitle = '$ToastTitle'; " +
            "\`$b.BalloonTipText = '$ToastMessage'; " +
            "\`$b.Visible = \`$true; " +
            "\`$b.ShowBalloonTip(10000); " +
            "Start-Sleep -Seconds 12; " +
            "\`$b.Dispose()"
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -EP Bypass -Command $toastCode"
        $principal = New-ScheduledTaskPrincipal -UserId $LoggedUser -LogonType Interactive
        $taskName = "DeployNotify_$rnd"
        Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Force | Out-Null
        Start-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 15
        Unregister-ScheduledTask -TaskName $taskName -Confirm:\`$false -ErrorAction SilentlyContinue
    } catch {}
}
`;
}

module.exports = { getToastSnippet };
