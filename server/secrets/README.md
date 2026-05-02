# Secrets directory

This directory holds raw secret files mounted into containers via
Docker Compose `secrets`. **Do not commit the real files to git.**

## Required files

- `db_root.txt` — MariaDB root password (one line, no trailing newline).
- `db_user.txt` — Password for the `addeploy` DB user used by the API.

## Generating them (Linux / WSL / Git Bash)

```bash
umask 077
openssl rand -base64 32 | tr -d '\n' > db_root.txt
openssl rand -base64 32 | tr -d '\n' > db_user.txt
```

## Generating them (PowerShell)

```powershell
Add-Type -AssemblyName System.Web
[System.Web.Security.Membership]::GeneratePassword(32, 4) | Out-File -NoNewline -Encoding ascii db_root.txt
[System.Web.Security.Membership]::GeneratePassword(32, 4) | Out-File -NoNewline -Encoding ascii db_user.txt
```

After creating them, `chmod 600 *.txt` on Linux or restrict ACLs on Windows.
