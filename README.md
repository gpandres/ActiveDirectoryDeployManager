# Active Directory Deploy Manager

<div align="center">
  <img src="img/screenshot.png" alt="AppDeploy Manager Screenshot" width="800"/>
</div>

**Active Directory Deploy Manager** is an application designed for SysAdmins and IT teams. It allows for unattended software deployment ("Drop & Run") using Active Directory Group Policy Objects (GPOs). Through a modern and unified interface, you can assign automated executables or MSIs directly to your company's Organizational Units (OUs).

## 🚀 Key Features

- **AD Graphical Interface:** Browse your Organizational Units (OUs) and visualize exactly which applications are being deployed through your GPOs.
- **Corporate Template Catalog:** Deploy complex software with 1 click. Includes auto-generating templates for:
  - *Security*: Wazuh, SentinelOne, Cortex XDR, Bitdefender, CrowdStrike Falcon.
  - *Connectivity*: GlobalProtect, Zscaler, FortiClient, Cisco Secure Client.
  - *Support & RMM*: TeamViewer, AnyDesk, Lansweeper, NinjaOne, Freshservice.
  - *Endpoints*: Microsoft Office, SAP GUI, Chrome Enterprise, and Custom scripts (Raw PowerShell).
- **Logs & Caching Control:** Every generated AppDeploy includes PSScript logic that first downloads the software to the hard drive (`C:\Temp\Deploy`), and also saves "already installed" tokens to prevent repeated deployments if the GPO is triggered again.
- **Local Visual Alerts (User Toast):** The system raises native Windows notifications directly connected to *Session 0* to notify the end user that a corporate installation is taking place.
- **Internationalization and Setup Assistant:** Configurable setup on first boot to route your `Share Network` and native multi-language support.

## ⚙️ Prerequisites

- **Windows** Environment (Preferably Windows 10 / 11 / Server 2016+).
- Machine connected to an **Active Directory** Domain with administrative privileges (Domain Admin for GPO creation).
- Active Directory RSAT tools installed locally (the program will check for them and guide you to install them if missing).
- **Node.js** (only for developer/build mode).

## 🛠️ Local Installation and Build

If you want to run the application natively from the source code or build your own executable:

1. Clone the repository and install the dependencies:
   ```bash
   git clone https://github.com/gpandres/ActiveDirectoryDeployManager
   cd ActiveDirectoryDeployManager
   npm install
   ```

2. Run the application in development mode:
   ```bash
   npm start
   ```

3. Build the executable:
   ```bash
   npm run build
   ```
   *(You can also use `npm run build:portable` if you configured webpack/electron-builder).*

## 📖 Architecture and How It Works

1. You select a local `.EXE` or `.MSI` and fill out its template.
2. AppDeploy copies the installer to your shared path (`\\Server\Share`).
3. A master `install.ps1` is auto-generated and injected into the GPO.
4. AD links the script to the computers in the OU.
5. Upon rebooting, the computers evaluate the `install.ps1` and execute your deployment in a distributed batch manner.

---

> AppDeploy Manager was built using **Electron.js** coupled with the native PowerShell terminal subsystem. It has no Cloud integrations; everything happens under the full control of your internal networks.