<p align="center">
  <img src="docs/icon.png" alt="AIDesk Logo" width="120" />
</p>

<h1 align="center">AIDesk</h1>
<p align="center"><strong>Claude Code Agent Control Panel</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/aidesk-agent"><img src="https://img.shields.io/npm/v/aidesk-agent?label=aidesk-agent&color=cb3837" alt="npm version" /></a>
  <a href="https://github.com/unkownpr/AIDesk"><img src="https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white" alt="Tauri v2" /></a>
  <a href="https://github.com/unkownpr/AIDesk"><img src="https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=white" alt="Rust" /></a>
  <a href="https://github.com/unkownpr/AIDesk"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" /></a>
  <a href="https://github.com/unkownpr/AIDesk/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" /></a>
</p>

---

**[English](#-english)** | **[Turkce](#-turkce)**

---

## English

### What is AIDesk?

AIDesk is a native desktop application for managing multiple Claude Code AI agents from a single control panel. Built with Tauri v2 (Rust) and React, it provides a fast, secure, and lightweight interface to create tasks, assign them to agents, and monitor execution in real time.

Agents can run locally on the same machine or remotely on any server via the `aidesk-agent` npm package.

### Features

- **Multi-Agent Management** -- Register and manage multiple Claude Code agents (local and remote)
- **Task System** -- Create tasks with priority levels (critical / high / medium / low), assign to agents, track status
- **Real-Time Log Streaming** -- SSE-based live log output from running agents
- **Remote Agents** -- Connect agents from any machine with `npx aidesk-agent`
- **Project Management** -- Link tasks to project directories for context-aware execution
- **Encrypted Vault** -- Store API keys and secrets with AES-256-GCM encryption
- **MCP Server Config** -- Configure Model Context Protocol servers per agent
- **Git Repository Config** -- Manage git configurations for agent workspaces
- **Activity Logging** -- Full audit trail for all operations
- **Native Notifications** -- macOS notifications for task completion, failure, and agent status changes
- **Dark / Light Theme** -- System-aware theme with manual toggle
- **Dashboard** -- Overview of agent statuses, task distribution, and offline warnings

### Architecture

```
+-----------------------------------------------------------+
|                     AIDesk Desktop App                     |
|                                                           |
|  +---------------------+   +---------------------------+  |
|  |   React Frontend    |   |     Tauri v2 (Rust)       |  |
|  |                     |   |                           |  |
|  |  - Dashboard        |   |  +---------------------+ |  |
|  |  - Tasks            |   |  |   Axum HTTP Server  | |  |
|  |  - Agents           |   |  |   (port 3939)       | |  |
|  |  - Activity         |   |  +---------------------+ |  |
|  |  - Settings         |   |  |   SQLite (WAL)      | |  |
|  |                     |   |  +---------------------+ |  |
|  |  Tailwind CSS v4    |   |  |   Vault (AES-256)   | |  |
|  |  Lucide Icons       |   |  +---------------------+ |  |
|  |  React Router v7    |   |  |   Orchestrator      | |  |
|  +---------------------+   |  +---------------------+ |  |
|          IPC                |  |   Agent Runner      | |  |
|   <-------------------->    |  |   (Node.js sidecar) | |  |
|                             |  +---------------------+ |  |
|                             +---------------------------+  |
+-----------------------------------------------------------+
        |                              |
        |  HTTP API (:3939)            |  stdin/stdout JSON
        |                              |
+-------v--------+           +--------v---------+
| Remote Agent 1 |           | Claude Agent SDK |
| (aidesk-agent) |           | (@anthropic-ai)  |
+----------------+           +------------------+
        |
+-------v--------+
| Remote Agent N |
| (aidesk-agent) |
+----------------+
```

### Project Structure

```
aidesk/
  src-tauri/src/          # Rust backend
    db/                   #   SQLite models (agents, tasks, task_logs, secrets, mcp, git)
    api/                  #   Axum HTTP endpoints (agent polling, heartbeat, reporting)
    agent/                #   Agent SDK sidecar runner (timeout, stderr drain)
    orchestrator/         #   Task distribution with panic guard
    vault/                #   AES-256-GCM encryption (vault.key, OnceLock cipher)
  agent-runner/           # Node.js sidecar (Claude Agent SDK bridge)
  aidesk-agent/           # npm package for remote agent connectivity
  src/                    # React frontend
    pages/                #   Dashboard, Tasks, Agents, Activity, Settings
    components/           #   Reusable UI components
    hooks/                #   useNotifications, useTaskLogStream, usePolling, useTheme
    lib/                  #   Tauri command bindings, utilities
  public/                 # Static assets
  docs/                   # Documentation and screenshots
```

### Prerequisites

| Requirement | Version |
|---|---|
| Rust + Cargo | latest stable |
| Node.js | >= 18 |
| pnpm | >= 9 |
| Claude Code | installed and authenticated |

### Installation

```bash
# Clone the repository
git clone https://github.com/unkownpr/AIDesk.git
cd aidesk

# Install frontend dependencies
pnpm install

# Install agent runner (sidecar) dependencies
cd agent-runner && npm install && cd ..

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

### Remote Agent Setup

Remote agents connect to the AIDesk server over HTTP. No WebSocket required -- agents poll for tasks, making it firewall-friendly.

1. Create an agent in the AIDesk UI and copy its token.
2. On the remote machine:

```bash
AIDESK_TOKEN=your-agent-token npx aidesk-agent --server https://your-server:3939
```

The agent will:
- Poll for new task assignments
- Send heartbeats every 30 seconds
- Stream execution logs back to AIDesk
- Report task results on completion

### API Endpoints

The Axum HTTP server runs on port **3939** and exposes the following endpoints for agent communication:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agent/poll` | Agent polls for assigned tasks |
| `POST` | `/api/agent/heartbeat` | Agent sends heartbeat signal |
| `POST` | `/api/agent/report` | Agent reports task result |
| `POST` | `/api/agent/log` | Agent sends progress log entry |
| `GET` | `/api/tasks/{id}/logs/stream` | SSE stream for real-time logs |
| `GET` | `/api/health` | Server health check |

All agent endpoints require the `Authorization: Bearer <token>` header.

### Screenshots

> Screenshots will be added here.

<!--
<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="800" />
  <br/><em>Dashboard -- agent overview and task distribution</em>
</p>

<p align="center">
  <img src="docs/screenshots/tasks.png" alt="Tasks" width="800" />
  <br/><em>Task management with filtering and search</em>
</p>

<p align="center">
  <img src="docs/screenshots/agents.png" alt="Agents" width="800" />
  <br/><em>Agent management and status monitoring</em>
</p>
-->

### License

This project is licensed under the [MIT License](LICENSE).

---

## Turkce

### AIDesk Nedir?

AIDesk, birden fazla Claude Code yapay zeka ajanini tek bir kontrol panelinden yonetmek icin gelistirilmis yerel bir masaustu uygulamasidir. Tauri v2 (Rust) ve React ile insa edilmistir; gorev olusturma, ajanlara atama ve gercek zamanli izleme icin hizli, guvenli ve hafif bir arayuz sunar.

Ajanlar yerel makinede calisabildigi gibi, `aidesk-agent` npm paketi araciligiyla herhangi bir uzak sunucudan da baglanabilir.

### Ozellikler

- **Coklu Ajan Yonetimi** -- Birden fazla Claude Code ajanini kaydedin ve yonetin (yerel ve uzak)
- **Gorev Sistemi** -- Oncelik seviyeleriyle (kritik / yuksek / orta / dusuk) gorev olusturun, ajanlara atayin, durumu takip edin
- **Gercek Zamanli Log Akisi** -- SSE tabanli canli log ciktisi
- **Uzak Ajanlar** -- `npx aidesk-agent` ile herhangi bir makineden ajan baglantisi
- **Proje Yonetimi** -- Gorevleri proje dizinlerine baglayarak baglama duyarli calistirma
- **Sifreli Kasa** -- API anahtarlarini ve sirlari AES-256-GCM sifrelemeyle saklayin
- **MCP Sunucu Yapilandirmasi** -- Ajan basina Model Context Protocol sunuculari yapilandirin
- **Git Depo Yapilandirmasi** -- Ajan calisma alanlari icin git yapilandirmalarini yonetin
- **Aktivite Kaydi** -- Tum islemler icin tam denetim izi
- **Yerel Bildirimler** -- Gorev tamamlama, basarisizlik ve ajan durum degisiklikleri icin macOS bildirimleri
- **Karanlik / Aydinlik Tema** -- Sisteme duyarli tema ve manuel gecis
- **Kontrol Paneli** -- Ajan durumlari, gorev dagilimi ve cevrimdisi uyarilara genel bakis

### Mimari

```
+-----------------------------------------------------------+
|                  AIDesk Masaustu Uygulamasi                |
|                                                           |
|  +---------------------+   +---------------------------+  |
|  |  React On Yuz       |   |     Tauri v2 (Rust)       |  |
|  |                     |   |                           |  |
|  |  - Kontrol Paneli   |   |  +---------------------+ |  |
|  |  - Gorevler         |   |  |  Axum HTTP Sunucu   | |  |
|  |  - Ajanlar          |   |  |  (port 3939)        | |  |
|  |  - Aktivite         |   |  +---------------------+ |  |
|  |  - Ayarlar          |   |  |  SQLite (WAL)       | |  |
|  |                     |   |  +---------------------+ |  |
|  |  Tailwind CSS v4    |   |  |  Kasa (AES-256)     | |  |
|  |  Lucide Ikonlar     |   |  +---------------------+ |  |
|  |  React Router v7    |   |  |  Orkestrator        | |  |
|  +---------------------+   |  +---------------------+ |  |
|          IPC                |  |  Ajan Calistirici   | |  |
|   <-------------------->    |  |  (Node.js sidecar)  | |  |
|                             |  +---------------------+ |  |
|                             +---------------------------+  |
+-----------------------------------------------------------+
        |                              |
        |  HTTP API (:3939)            |  stdin/stdout JSON
        |                              |
+-------v--------+           +--------v---------+
| Uzak Ajan 1    |           | Claude Agent SDK |
| (aidesk-agent) |           | (@anthropic-ai)  |
+----------------+           +------------------+
        |
+-------v--------+
| Uzak Ajan N    |
| (aidesk-agent) |
+----------------+
```

### Proje Yapisi

```
aidesk/
  src-tauri/src/          # Rust arka yuz
    db/                   #   SQLite modelleri (ajanlar, gorevler, loglar, sirlar, mcp, git)
    api/                  #   Axum HTTP endpointleri (yoklama, kalp atisi, raporlama)
    agent/                #   Ajan SDK sidecar calistiricisi (zaman asimi, stderr)
    orchestrator/         #   Panik korumali gorev dagitimi
    vault/                #   AES-256-GCM sifreleme (vault.key, OnceLock cipher)
  agent-runner/           # Node.js sidecar (Claude Agent SDK koprusu)
  aidesk-agent/           # Uzak ajan baglantisi icin npm paketi
  src/                    # React on yuz
    pages/                #   Kontrol Paneli, Gorevler, Ajanlar, Aktivite, Ayarlar
    components/           #   Yeniden kullanilabilir UI bilesenleri
    hooks/                #   useNotifications, useTaskLogStream, usePolling, useTheme
    lib/                  #   Tauri komut baglantilari, yardimci fonksiyonlar
  public/                 # Statik dosyalar
  docs/                   # Dokumantasyon ve ekran goruntuleri
```

### Onkosuller

| Gereksinim | Surum |
|---|---|
| Rust + Cargo | en son kararli surum |
| Node.js | >= 18 |
| pnpm | >= 9 |
| Claude Code | kurulu ve kimlik dogrulanmis |

### Kurulum

```bash
# Depoyu klonlayin
git clone https://github.com/unkownpr/AIDesk.git
cd aidesk

# On yuz bagimliklarini yukleyin
pnpm install

# Ajan calistiricisi (sidecar) bagimliklarini yukleyin
cd agent-runner && npm install && cd ..

# Gelistirme modunda calistirin
cargo tauri dev

# Uretim icin derleyin
cargo tauri build
```

### Uzak Ajan Kurulumu

Uzak ajanlar AIDesk sunucusuna HTTP uzerinden baglanir. WebSocket gerektirmez -- ajanlar gorevleri yoklama yontemiyle alir, bu da guvenlik duvari dostu bir yaklasimdir.

1. AIDesk arayuzunde bir ajan olusturun ve tokenini kopyalayin.
2. Uzak makinede:

```bash
AIDESK_TOKEN=ajan-tokeniniz npx aidesk-agent --server https://sunucunuz:3939
```

Ajan sunucu islemleri:
- Yeni gorev atamalarini yoklar
- Her 30 saniyede kalp atisi sinyali gonderir
- Calistirma loglarini AIDesk'e geri aktarir
- Tamamlanan gorevlerin sonuclarini raporlar

### API Endpointleri

Axum HTTP sunucusu **3939** portunda calisir ve ajan iletisimi icin asagidaki endpointleri sunar:

| Metot | Endpoint | Aciklama |
|---|---|---|
| `GET` | `/api/agent/poll` | Ajan atanmis gorevleri yoklar |
| `POST` | `/api/agent/heartbeat` | Ajan kalp atisi sinyali gonderir |
| `POST` | `/api/agent/report` | Ajan gorev sonucunu raporlar |
| `POST` | `/api/agent/log` | Ajan ilerleme log kaydi gonderir |
| `GET` | `/api/tasks/{id}/logs/stream` | Gercek zamanli loglar icin SSE akisi |
| `GET` | `/api/health` | Sunucu saglik kontrolu |

Tum ajan endpointleri `Authorization: Bearer <token>` basligini gerektirir.

### Ekran Goruntuleri

> Ekran goruntuleri buraya eklenecektir.

<!--
<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Kontrol Paneli" width="800" />
  <br/><em>Kontrol Paneli -- ajan durumu ve gorev dagilimi</em>
</p>

<p align="center">
  <img src="docs/screenshots/tasks.png" alt="Gorevler" width="800" />
  <br/><em>Filtreleme ve arama ile gorev yonetimi</em>
</p>

<p align="center">
  <img src="docs/screenshots/agents.png" alt="Ajanlar" width="800" />
  <br/><em>Ajan yonetimi ve durum izleme</em>
</p>
-->

### Lisans

Bu proje [MIT Lisansi](LICENSE) ile lisanslanmistir.

---

<p align="center">
  Built by <a href="https://ssilistre.dev">ssilistre.dev</a>
</p>
