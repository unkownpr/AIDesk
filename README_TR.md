<p align="center">
  <img src="docs/icon.png" alt="AIDesk" width="100" height="100" style="border-radius: 20px;" />
</p>

<h1 align="center">AIDesk</h1>
<p align="center"><strong>Claude Code Agent Kontrol Paneli</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/aidesk-agent"><img src="https://img.shields.io/npm/v/aidesk-agent?label=aidesk-agent&color=cb3837" alt="npm" /></a>
  <img src="https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/Lisans-MIT-green.svg" alt="MIT" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="#aidesk-nedir">Türkçe</a> · <a href="https://unkownpr.github.io/AIDesk/">Website</a>
</p>

<p align="center">
  <img src="docs/screen.png" alt="AIDesk Dashboard" width="800" />
</p>

---

## AIDesk Nedir?

AIDesk, birden fazla Claude Code yapay zekâ ajanını tek bir kontrol panelinden yönetmenizi sağlayan yerel masaüstü uygulamasıdır. **Tauri v2** (Rust) ve **React** ile geliştirilmiştir; görev oluşturma, ajanlara atama ve gerçek zamanlı izleme için hızlı, güvenli ve hafif bir arayüz sunar.

Ajanlar hem **yerel** makinenizde hem de [`aidesk-agent`](https://www.npmjs.com/package/aidesk-agent) npm paketi aracılığıyla herhangi bir **uzak** sunucuda çalışabilir.

## Özellikler

- **Çoklu Ajan Yönetimi** — Yerel ve uzak Claude Code ajanlarını oluşturun ve yönetin
- **Görev Kuyruğu ve Öncelikler** — Öncelik seviyelerine göre (kritik / yüksek / orta / düşük) görev oluşturun
- **Gerçek Zamanlı Log Akışı** — SSE tabanlı canlı log çıktısı
- **Uzak Ajan Desteği** — `npx aidesk-agent` ile herhangi bir makineden bağlantı
- **Proje Yönetimi** — Görevleri proje dizinlerine bağlayarak bağlama duyarlı çalıştırma
- **Şifreli Kasa** — API anahtarlarını ve gizli bilgileri AES-256-GCM şifrelemeyle saklayın
- **MCP ve Git Yapılandırması** — Ajan bazında MCP sunucuları ve git depoları yapılandırın
- **Aktivite Günlüğü** — Tüm işlemler için tam denetim kaydı
- **Yerel Bildirimler** — Görev tamamlanma, başarısızlık ve ajan durumu için macOS bildirimleri
- **Karanlık / Aydınlık Tema** — Sisteme duyarlı tema ve manuel geçiş
- **Kontrol Paneli** — Ajan durumları, görev dağılımı ve çevrimdışı uyarılarına genel bakış

## Mimari

```
┌───────────────────────────────────────────────────────────┐
│                  AIDesk Masaüstü Uygulaması                │
│                                                           │
│  ┌─────────────────┐       ┌───────────────────────────┐  │
│  │  React Ön Yüz    │       │     Tauri v2 (Rust)       │  │
│  │                  │       │                           │  │
│  │  Kontrol Paneli  │       │  ┌─────────────────────┐  │  │
│  │  Görevler        │  IPC  │  │  Axum HTTP :3939    │  │  │
│  │  Ajanlar         │◄─────►│  ├─────────────────────┤  │  │
│  │  Aktivite        │       │  │  SQLite (WAL)       │  │  │
│  │  Ayarlar         │       │  ├─────────────────────┤  │  │
│  │                  │       │  │  Kasa (AES-256)     │  │  │
│  │  Tailwind CSS v4 │       │  ├─────────────────────┤  │  │
│  │  Lucide Icons    │       │  │  Orkestratör        │  │  │
│  └─────────────────┘       │  ├─────────────────────┤  │  │
│                             │  │  Ajan Çalıştırıcı   │  │  │
│                             │  │  (Node.js sidecar)  │  │  │
│                             │  └─────────────────────┘  │  │
│                             └───────────────────────────┘  │
└─────────────┬──────────────────────────┬──────────────────┘
              │ HTTP API (:3939)          │ stdin/stdout JSON
              ▼                           ▼
     ┌────────────────┐         ┌──────────────────┐
     │  Uzak Ajan      │         │ Claude Agent SDK │
     │  (aidesk-agent) │         │ (@anthropic-ai)  │
     └────────────────┘         └──────────────────┘
```

## Proje Yapısı

```
aidesk/
├── src-tauri/src/           # Rust arka yüz
│   ├── db/                  #   SQLite modelleri, sorgular
│   ├── api/                 #   Axum HTTP uç noktaları
│   ├── agent/               #   SDK sidecar çalıştırıcı
│   ├── orchestrator/        #   Görev dağıtımı
│   └── vault/               #   AES-256-GCM şifreleme
├── agent-runner/            # Node.js sidecar (Claude Agent SDK)
├── aidesk-agent/            # Uzak ajanlar için npm paketi
├── src/                     # React ön yüz
│   ├── pages/               #   Kontrol Paneli, Görevler, Ajanlar, Aktivite, Ayarlar
│   ├── components/          #   Arayüz bileşenleri
│   ├── hooks/               #   Özel React hook'ları
│   └── lib/                 #   Tauri bağlantıları, yardımcı fonksiyonlar
└── docs/                    # GitHub Pages sitesi
```

## Ön Koşullar

| Gereksinim | Sürüm |
|---|---|
| Rust + Cargo | en son kararlı sürüm |
| Node.js | >= 18 |
| pnpm | >= 9 |
| Claude Code | kurulu ve kimlik doğrulanmış |

## Kurulum

```bash
# Depoyu klonlayın
git clone https://github.com/unkownpr/AIDesk.git
cd AIDesk

# Bağımlılıkları yükleyin
pnpm install
cd agent-runner && npm install && cd ..

# Geliştirme modunda çalıştırın
cargo tauri dev

# Üretim için derleyin
cargo tauri build
```

## Uzak Ajan Kurulumu

Uzak ajanlar HTTP yoklama yöntemiyle bağlanır — WebSocket gerekmez, güvenlik duvarı dostudur.

1. AIDesk arayüzünde **uzak** tipinde bir ajan oluşturun ve token'ını kopyalayın.
2. Uzak makinede:

```bash
# Önerilen: token'ı ortam değişkeni ile verin
AIDESK_TOKEN=ajan-tokeniniz npx aidesk-agent --server https://sunucu-adresiniz:3939

# Yerel ağ (HTTP)
AIDESK_TOKEN=ajan-tokeniniz npx aidesk-agent --server http://192.168.1.5:3939 --insecure
```

Ajan şunları yapar:
- Her 3 saniyede yeni görev atamaları için sunucuyu yoklar
- Her 30 saniyede kalp atışı sinyali gönderir
- Çalıştırma loglarını gerçek zamanlı olarak AIDesk'e aktarır
- Görev tamamlandığında sonuçları raporlar

Tüm seçenekler için [`aidesk-agent` npm sayfasına](https://www.npmjs.com/package/aidesk-agent) bakın.

## API Uç Noktaları

Axum HTTP sunucusu **3939** portunda çalışır:

| Metot | Uç Nokta | Yetkilendirme | Açıklama |
|---|---|---|---|
| `GET` | `/api/agent/poll` | Ajan token'ı | Atanmış görevleri yokla |
| `POST` | `/api/agent/heartbeat` | Ajan token'ı | Kalp atışı sinyali gönder |
| `POST` | `/api/agent/report` | Ajan token'ı | Görev sonucunu raporla |
| `POST` | `/api/agent/log` | Ajan token'ı | İlerleme log kaydı gönder |
| `GET` | `/api/tasks/{id}/logs/stream` | Dashboard anahtarı | SSE gerçek zamanlı log akışı |
| `GET` | `/api/health` | Yok | Sağlık kontrolü |

## Lisans

[MIT](LICENSE)

---

<p align="center">
  <a href="https://ssilistre.dev">ssilistre.dev</a> tarafından geliştirilmiştir.
</p>
