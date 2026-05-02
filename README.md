# Active Directory Deploy Manager

<div align="center">
  <img src="img/screenshot.png" alt="AppDeploy Manager Screenshot" width="800"/>
</div>

**Active Directory Deploy Manager** is a Windows desktop application for SysAdmins and IT teams. It automates unattended software deployment through Active Directory Group Policy Objects (GPOs) — select an installer, pick your target OUs, and the application generates the PowerShell script, copies files to the share, creates the GPO, and links it, all from a single unified interface.

---

## 🚀 Key Features

### Active Directory Integration
- **OU Browser** — visual tree of your domain's Organizational Units, showing which apps are deployed to each OU via GPO.
- **GPO management** — create, link, unlink, and delete GPOs directly from the UI; no manual ADUC/GPMC work needed.
- **Conflict detection** — see all GPOs linked to a given OU before adding a new one.
- **Bulk assignment** — link the same GPO (or a new one) to multiple OUs in one operation.
- **Dependency ordering** — configure app A to wait for app B with a configurable timeout.

### Deployment Templates (22+)

Parametric templates auto-generate deployment scripts for the most common enterprise software. Just fill in your environment-specific values and click Deploy.

**Security & Endpoint Protection**
| Template | Parameters |
|----------|-----------|
| Wazuh | Manager IP, group, enrollment password — service auto-starts after install (no reboot required) |
| SentinelOne | Site token |
| Cortex XDR | Install directory (optional) |
| Bitdefender BEST | Default MSI deployment |
| CrowdStrike Falcon | CID |

**Network & Connectivity**
| Template | Parameters |
|----------|-----------|
| Zscaler ZCC | Cloud name, user domain, strict enforcement |
| GlobalProtect | Portal FQDN |
| Cisco Secure Client | Profile XML path |
| FortiClient | Tunnel config, SSO, certificate validation |

**RMM & Remote Support**
| Template | Parameters |
|----------|-----------|
| Lansweeper | Server, port, cloud relay key |
| NinjaOne | Agent token |
| Freshservice | Registration token |
| TeamViewer | Custom config ID, API token |
| AnyDesk | Generic MSI |

**Productivity & ERP**
| Template | Parameters |
|----------|-----------|
| Microsoft Office | XML config file |
| Office 365 / LTSC (ODT) | Auto-generates XML from selections |
| SAP GUI | Version, theme |

**Backup**
| Template | Parameters |
|----------|-----------|
| Veeam Agent | XML config from Veeam server |
| CrashPlan | Deployment URL + token |

**Generic**
| Template | Parameters |
|----------|-----------|
| Generic EXE / MSI | Silent args, detection method |
| Winget | Package ID from Windows Package Manager catalog |
| Raw PowerShell | Write your own script with the full runtime wrapper |

### Custom Templates
Define your own templates with a named parameter form — reuse them across deployments the same way built-in templates work.

### Bundles
Group multiple apps into a **Bundle** and deploy them as a suite with a single GPO and one click. Each app in the bundle can have its own template and parameters.

### Smart Install Detection
Prevent re-installs by configuring a detection strategy per app:
- **Tracker token** — lightweight file written by the script on success.
- **File version** — check that a specific file exists at a minimum version.
- **Registry value** — inspect an HKLM/HKCU key and value.

### Winget Integration
Search and deploy from the Windows Package Manager catalog. The app resolves the package manifest at deploy time, keeping versions up to date.

### Uninstall Management
Every app can have an uninstall script generated alongside the install script:
- `auto-msi` — quiet MSI uninstall.
- `auto-registry` — find the uninstall string from Programs & Features.
- `manual` — custom script.
- `winget` — `winget uninstall`.

### Import / Export
Export your full configuration (apps, bundles, settings) to a portable JSON file. Secrets and API keys are automatically stripped from the export.

### Local Toast Notifications
Scripts raise native Windows notifications bridged from Session 0 to the user session, notifying end users that a corporate installation is in progress.

### Internationalization
Multi-language UI with a setup assistant on first boot. Language can be changed at any time in Settings.

---

## 📊 Logging System

AD Deploy Manager includes an optional self-hosted centralized logging backend. When enabled, every deployment action from every machine running the app is batched and sent to a central server — searchable, filterable, and paginated from within the app.

**Architecture:** Docker Compose stack — MariaDB + Fastify API + Caddy reverse proxy (internal TLS).

**Key capabilities:**
- Per-device enrollment (machines swap a one-time token for a personal ingest API key).
- Share-based auto-enrollment — publish a signed config to your network share and every client auto-enrolls on startup; no per-machine manual steps.
- Keyset-paginated log search (device, level, source, free text).
- Aggregated stats (24 h / 7 d / 30 d windows).
- Sensitive field auto-masking before any disk or network write (`password`, `token`, `apikey`, `secret`, `credential`, etc.).
- Web-based admin panel (username/password auth, TLS fingerprint display, API key management).

📖 **[Full deployment guide → logs.md](logs.md)**

---

## 🔒 Security

- **Electron hardening** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. All renderer ↔ main communication through a typed `contextBridge` preload.
- **IPC input validation** — every IPC channel validates type, length, and allowed values before touching any service.
- **PowerShell input sanitization** — all user-supplied strings are single-quote escaped before injection into PowerShell. DNs are parsed with RFC 4514 backslash-escape awareness.
- **Script path allowlisting** — generated scripts can only be written to paths under your configured `networkSharePath` or `logDirectory`. Absolute path traversal and control characters are rejected.
- **GPO concurrency locks** — per-GPO name mutex prevents race conditions when multiple async operations target the same GPO.
- **DPAPI secret storage** — API keys and enrollment tokens are stored encrypted via Windows DPAPI (user-bound). Never in plaintext config files.
- **TLS certificate pinning** — the remote logging client validates the server certificate by SHA-256 fingerprint, not the system trust store. Configurable per-deployment.
- **Log field masking** — `log-sanitizer` applies regex masking recursively (depth 6) on all log objects before writing to disk or network. Sensitive field names → `[REDACTED]`.
- **IPC error auditing** — all IPC handlers are wrapped with a logging decorator that records failures, exceptions, and slow calls (>10 s) to the activity log.

---

## ⚙️ Prerequisites

- **Windows** 10 / 11 / Server 2016+ (the app runs on the admin machine, not the targets).
- Machine joined to an **Active Directory** domain with **Domain Admin** privileges (required for GPO creation and linking).
- **Active Directory RSAT tools** installed locally (`RSAT: Active Directory Domain Services and Lightweight Directory Services Tools` and `RSAT: Group Policy Management Tools`). The app checks for these on startup and guides installation if missing.
- **Network share** accessible from both the admin machine (read/write) and the target machines (read-only) — used to store installers and generated scripts.
- **Node.js** only needed for developer / build mode.

---

## 🛠️ Local Installation and Build

```bash
git clone https://github.com/gpandres/ActiveDirectoryDeployManager
cd ActiveDirectoryDeployManager
npm install
```

Run in development mode:
```bash
npm start
```

Build distributable executable:
```bash
npm run build
# or for portable build:
npm run build:portable
```

---

## 📖 Architecture and How It Works

```
┌─────────────────────────────────────────────────────┐
│  Electron App (Admin Machine)                        │
│                                                      │
│  UI (Renderer) ←→ IPC ←→ Main Process               │
│                           ├─ app-service             │
│                           ├─ ad-service (PS bridge)  │
│                           ├─ script-service          │
│                           └─ log-sink                │
└──────────────────┬──────────────────────┬────────────┘
                   │                      │
       ┌───────────▼──────┐   ┌───────────▼──────────┐
       │  Network Share   │   │  Active Directory      │
       │  \\server\share  │   │                        │
       │  ├ apps-config   │   │  GPO created/linked    │
       │  └ Apps/         │   │  to target OUs         │
       │     └ MyApp/     │   └──────────┬─────────────┘
       │        ├ install │              │ GPO applies at boot
       │        ├ uninst  │              │
       │        ├ version │   ┌──────────▼─────────────┐
       │        └ setup   │   │  Client Machines        │
       └──────────────────┘   │                        │
                              │  • Downloads installer  │
                              │  • Checks detection     │
                              │  • Runs silently        │
                              │  • Toasts user          │
                              │  • Logs result          │
                              └──────────┬──────────────┘
                                         │ (remote mode)
                              ┌──────────▼──────────────┐
                              │  Logging Server          │
                              │  (Docker — optional)     │
                              │                          │
                              │  Caddy → Fastify API     │
                              │       → MariaDB          │
                              └──────────────────────────┘
```

### Deployment flow (step by step)

1. **Configure the app** — point it at your network share, set your domain, optional base OUs.
2. **Create an app** — select installer (EXE/MSI) or specify a winget package ID. Choose a template and fill in parameters.
3. **Generate script** — the app builds a PowerShell `install.ps1` with silent args, download logic, detection check, toast notification, and logging.
4. **Deploy to share** — installer and scripts are copied to `\\server\share\Apps\<AppName>\`. A `version.json` manifest tracks paths and hashes.
5. **Link to OUs** — the app either creates a new GPO or reuses an existing one, injects the startup script, bumps the `gpt.ini` version counter, and links to the selected OUs.
6. **Client execution** — at next boot, Group Policy applies and runs `install.ps1` in SYSTEM context. The script downloads the installer, checks if already installed (detection), executes silently, notifies the user, and logs the result.

---

## ⚡ First-Run Setup

On first launch, a setup assistant guides you through:

1. **Language selection** — UI locale (persisted in config).
2. **Network share path** — UNC path the app and clients share (e.g., `\\fileserver\Deploy`).
3. **Domain Controller** (optional) — leave blank to auto-discover.
4. **Base OUs** (optional) — scope the OU browser to specific subtrees.
5. **RSAT check** — the app verifies the required PowerShell modules are present.

Settings can be changed at any time under **Settings**.

---

> AD Deploy Manager is built with **Electron.js** and the native PowerShell subsystem. It has no mandatory cloud dependency — everything runs on your internal network. The logging server is entirely optional and self-hosted.
