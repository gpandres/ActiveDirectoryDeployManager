# Logging Server — Deployment & Administration Guide

> Full guide for deploying the optional centralized logging stack and connecting the Electron app to it.

---

## Overview

AD Deploy Manager ships with an optional self-hosted logging backend. When enabled, every deployment action from every machine running the app is forwarded to a central MariaDB database — searchable, filterable, and visualized from within the app.

**Stack (Docker Compose):**

| Container | Role |
|-----------|------|
| `addeploy-mariadb` | MariaDB 11 — stores logs, devices, API keys |
| `addeploy-api` | Fastify (Node.js) — REST API for ingest / read / admin |
| `addeploy-caddy` | Caddy 2 — TLS termination, security headers, reverse proxy |

All traffic goes through Caddy on port 443. MariaDB is never exposed to the host network.

---

## 1. Prerequisites

- Linux server (or VM) with **Docker** and **Docker Compose v2** installed.
- A hostname or IP the Electron clients can reach (e.g., `logs.example.local`).
- DNS entry or `hosts` file entry mapping that hostname to the server.
- Ports **80** and **443** open to the client machines.

---

## 2. Directory Structure

```
server/
├── docker-compose.yml
├── .env                    ← you create this (see below)
├── caddy/
│   └── Caddyfile
├── db/
│   ├── Dockerfile
│   ├── my.cnf
│   └── init/
│       ├── 01-schema.sql
│       ├── 02-procedures.sql
│       └── 03-admin.sql
├── api/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── package.json
│   └── src/
│       └── ...
└── secrets/
    ├── db_root.txt         ← you create this
    └── db_user.txt         ← you create this
```

---

## 3. First-Time Setup

### 3.1 Clone and enter the server directory

```bash
cd server/
```

### 3.2 Create secret files

These files contain passwords used internally between containers. They are never exposed outside the Docker network.

```bash
mkdir -p secrets
# Generate strong random passwords
openssl rand -base64 32 > secrets/db_root.txt
openssl rand -base64 32 > secrets/db_user.txt
chmod 600 secrets/db_root.txt secrets/db_user.txt
```

### 3.3 Create the `.env` file

```bash
# server/.env
LOG_HOSTNAME=logs.example.local   # the hostname Caddy will serve (must match DNS)
```

> `LOG_HOSTNAME` is required. Both Caddy and the API container read it. Caddy uses it for TLS SNI; the API uses it for the fingerprint endpoint served in the admin panel.

### 3.4 Build and start

```bash
docker compose up -d --build
```

This will:
1. Build the MariaDB image (bakes in the init SQL).
2. Build the API image (installs npm deps, drops to unprivileged `app` user at runtime).
3. Pull `caddy:2-alpine`.
4. Wait for MariaDB to pass its health check before starting the API.
5. On first boot, the API entrypoint runs `seed.js` — this creates the default admin user (`admin` / `admin`).

Verify everything is running:

```bash
docker compose ps
docker compose logs api --tail 40
```

---

## 4. Admin Panel

Navigate to `https://logs.example.local/admin` in your browser.

> Your browser will warn about an untrusted certificate because Caddy uses its own internal CA. This is expected — the Electron app validates via TLS fingerprint pinning, not the system trust store. See §5 below.

### 4.1 First login (forced password change)

1. Sign in with **username:** `admin` **password:** `admin`.
2. The panel immediately redirects you to a password-change screen.
3. Set a strong password (min. 8 characters). All sessions are invalidated after the change.
4. Sign in again with your new credentials.

The default account has `must_change = 1` in the database, so no one can bypass this step.

### 4.2 Dashboard

After login you land on the **Dashboard** showing:

| Stat | Description |
|------|-------------|
| Events (24 h) | Total log entries ingested in the last 24 hours |
| Active machines (24 h) | Distinct devices that logged in the last 24 hours |
| Errors (24 h) | Log entries with `level = error` in the last 24 hours |
| Total machines | All enrolled devices in the database |
| Active API keys | Non-revoked API keys currently in the system |

### 4.3 API Keys

Used by the **Electron app** (admin scope) and **enrolled machines** (ingest scope).

**Scopes:**

| Scope | Access |
|-------|--------|
| `ingest` | Write-only. Post log batches. Assigned per device via enrollment. |
| `read` | Read-only. Query logs and stats. Optional for the Electron app. |
| `admin` | Full access. Key/secret management. Use for the Electron app. |

To create a key for the Electron app:
1. Go to **API Keys → Create Key**.
2. Name it (e.g., `electron-admin`), scope = `admin`.
3. Copy the key immediately — it is shown only once.

### 4.4 Enrollment

The enrollment system issues per-device ingest keys automatically without any manual step per machine.

**Share secrets** and **enrollment tokens** work together:

| Concept | What it is |
|---------|-----------|
| **Share secret** | HMAC key stored in a `logging-config.json` on your network share. The Electron app reads and signs the config with it. |
| **Enrollment token** | One-time-use (or multi-use) token a machine can swap for an ingest API key on first contact. |

Creating them:
1. **Enrollment → Share Secrets → Create** — enter the `shareId` (must match what you configured in the Electron app settings).
2. Copy the secret; you will need it in §6.
3. **Enrollment → Enrollment Tokens → Create** — same `shareId`, set TTL and max uses.
4. Copy the enrollment token.

### 4.5 TLS Certificate (Fingerprint)

The Electron app uses **TLS certificate pinning** instead of the system trust store. You need to paste the server's fingerprint into the app settings.

1. Go to **TLS Certificate → Fetch fingerprint**.
2. The server connects to Caddy internally and returns the SHA-256 fingerprint in `sha256//<base64>` format.
3. Click **Copy**.
4. Paste it in the Electron app → Settings → Log Server → TLS Fingerprint.

> The fingerprint changes if you rebuild the Caddy container and the certificate rotates. Re-fetch and update if the app reports a TLS error.

### 4.6 Change Password

Available under **Change Password** in the sidebar at any time. Changing the password revokes all active sessions — all open browser tabs will be signed out.

---

## 5. Connecting the Electron App

### 5.1 Manual configuration

In the Electron app, go to **Settings → Log Server**:

| Field | Value |
|-------|-------|
| Mode | `Dedicated server` |
| API base URL | `https://logs.example.local` |
| TLS fingerprint | `sha256//<base64>` (from §4.5) |
| Admin API key | Key created in §4.3 |

Save and reload. The app status bar will show a green indicator when connected.

### 5.2 Auto-enrollment via Share (recommended for fleets)

Instead of manually configuring each instance, publish a signed `logging-config.json` to your network share. Every Electron app instance that has access to the share will auto-enroll on startup.

**Publish the config from the Electron app:**

1. In **Settings → Log Server**, fill in the server URL, TLS fingerprint, and enrollment token.
2. Click **Publish to Share**. The app writes a signed `logging-config.json` to your share using the share secret as the HMAC key.

**What happens on each client:**
1. App reads `logging-config.json` from the share.
2. Verifies the HMAC signature with the stored share secret.
3. If the app has no ingest key yet, it calls `POST /api/enroll` with the enrollment token.
4. Server returns a per-device ingest API key (stored encrypted via Windows DPAPI).
5. Client starts batching logs to the server.

The enrollment token can be multi-use — set a high `usesLeft` value and a long TTL so all machines in the fleet can enroll without manual intervention.

---

## 6. API Reference

All endpoints except `/health` require a valid `X-API-Key` header. The admin panel endpoints use session cookies instead.

### Ingest

```
POST /api/logs
X-API-Key: <ingest-key>
Content-Type: application/json

{
  "entries": [
    {
      "ts": "2025-05-01T10:00:00.000Z",
      "level": "info",
      "source": "deploy",
      "message": "installed MyApp 2.1.0",
      "hostname": "PC-001",
      "shareId": "ABC12345"
    }
  ]
}
```

- Max 500 entries per batch, 1 MB max body.
- `ts` defaults to server time if omitted.

### Query logs

```
GET /api/logs?equipo=PC-001&level=error&limit=50
X-API-Key: <read-or-admin-key>
```

Query params: `equipo`, `equipoId`, `level`, `source`, `q` (message search), `beforeTs`, `beforeId` (keyset cursor), `limit` (max 200).

Response:
```json
{ "items": [...], "nextCursor": "2025-05-01T09:00:00.000Z_1234" }
```

### Stats

```
GET /api/stats/summary?window=24h
X-API-Key: <read-or-admin-key>
```

Windows: `1h`, `24h`, `7d`, `30d`. Returns counts by level, top error devices, active device count.

### Devices

```
GET /api/equipos?hostname=PC
X-API-Key: <read-or-admin-key>
```

Returns all enrolled devices matching the hostname prefix.

### Enrollment

```
POST /api/enroll
Content-Type: application/json

{
  "hostname": "PC-001",
  "shareId": "ABC12345",
  "enrollmentToken": "<raw-token>"
}
```

Returns `{ "apiKey": "<ingest-key>", "equipoId": 123 }`. The ingest key is returned only once.

---

## 7. Maintenance

### View logs

```bash
docker compose logs api -f
docker compose logs caddy -f
```

### Restart a service

```bash
docker compose restart api
```

### Rebuild after code changes

```bash
docker compose up -d --build api
```

### Access the database (read-only inspection)

```bash
docker exec -it addeploy-mariadb mariadb -u addeploy -p addeploy_logs
# password is in secrets/db_user.txt
```

### Monthly log partitions

The `logs` table is range-partitioned by month. Old partitions can be dropped with zero locking:

```sql
ALTER TABLE logs DROP PARTITION p_2025_01;
```

Partitions are named `p_YYYY_MM`. The stored procedure `addeploy_logs.add_future_partitions()` (defined in `02-procedures.sql`) creates partitions in advance.

### Rotate Caddy certificate / update fingerprint

Caddy auto-manages its internal CA. If the certificate rotates (e.g., after `docker compose down && up`):

1. Open the admin panel → **TLS Certificate → Fetch fingerprint**.
2. Copy the new fingerprint.
3. Update the Electron app settings.
4. Re-publish the `logging-config.json` to the share if using auto-enrollment.

---

## 8. Security Considerations

- **Admin panel sessions** expire after 8 hours. Sessions are stored as SHA-256 hashes — the raw token never touches the database.
- **Passwords** are hashed with `scrypt` (N=32768, r=8, p=1) — no plaintext ever stored.
- **API keys** are stored as SHA-256 hashes. The raw key value is shown exactly once at creation.
- **Log field masking** — the API and Electron app both apply regex-based redaction to field names matching `password`, `token`, `apikey`, `secret`, `credential`, etc. before writing to disk or wire.
- **Rate limiting** — login endpoint: 10 requests / 15 min. Change-password: 5 / 15 min. General API: 600 req / min.
- **MariaDB** is never exposed to the host network (no published port).
- **Caddy** enforces HSTS (1 year, includeSubdomains), X-Frame-Options: DENY, nosniff, and suppresses the Server header.
- **TLS certificate pinning** in the Electron app prevents MITM even on internal networks with untrusted CAs.
