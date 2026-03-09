<p align="center">
  <img src="https://raw.githubusercontent.com/unkownpr/AIDesk/main/docs/icon.png" alt="AIDesk" width="80" height="80" />
</p>

<h1 align="center">aidesk-agent</h1>
<p align="center">Remote agent CLI for <a href="https://github.com/unkownpr/AIDesk">AIDesk</a> — connects to your AIDesk server and executes Claude Code tasks automatically.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/aidesk-agent"><img src="https://img.shields.io/npm/v/aidesk-agent?color=cb3837" alt="npm" /></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <a href="https://github.com/unkownpr/AIDesk"><img src="https://img.shields.io/badge/AIDesk-GitHub-181717?logo=github" alt="GitHub" /></a>
  <a href="https://unkownpr.github.io/AIDesk/"><img src="https://img.shields.io/badge/Website-unkownpr.github.io-10b981" alt="Website" /></a>
  <a href="https://github.com/unkownpr/AIDesk/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT" /></a>
</p>

---

## Quick Start

```bash
# Using environment variable (recommended)
AIDESK_TOKEN=your_token npx aidesk-agent --server https://your-server:3939

# Using --token flag (visible in process list)
npx aidesk-agent --server https://your-server:3939 --token your_token

# Local network (HTTP requires --insecure flag)
AIDESK_TOKEN=your_token npx aidesk-agent --server http://192.168.1.5:3939 --insecure
```

## How It Works

1. **AIDesk UI** — Create a remote agent and copy the token
2. **Remote machine** — Run `aidesk-agent` with the token
3. **Agent polls** for tasks every 3 seconds
4. **Claude Code SDK** executes the task locally
5. **Results stream** back to AIDesk in real-time

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  AIDesk App  │◄──HTTP──│ aidesk-agent │──SDK──►│  Claude API  │
│  (server)    │──task──►│  (remote)    │         │              │
└─────────────┘         └──────────────┘         └─────────────┘
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--server <url>` | AIDesk server URL **(required)** | — |
| `--token <token>` | Agent token (prefer `AIDESK_TOKEN` env var) | — |
| `--cwd <path>` | Working directory for tasks | Current dir |
| `--model <model>` | Claude model override | Agent config |
| `--max-turns <n>` | Max conversation turns | Agent config |
| `--poll-interval <s>` | Poll interval in seconds | `3` |
| `--permission-mode <m>` | `default`, `acceptEdits`, or `bypassPermissions` | `default` |
| `--insecure` | Allow plain HTTP connections | `false` |

## Authentication

The agent token is created in the AIDesk UI when you add a **remote** agent.

**Recommended:** Use the `AIDESK_TOKEN` environment variable — CLI arguments are visible to other users via `ps`.

```bash
export AIDESK_TOKEN=your_token
npx aidesk-agent --server https://your-server:3939
```

## Security

- HTTPS enforced by default (use `--insecure` to allow HTTP)
- Token via env var to avoid process list exposure
- Permission mode defaults to `default` (explicit opt-in for `bypassPermissions`)
- Exponential backoff on connection failures

## Requirements

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated on the remote machine
- Network access to AIDesk server (port 3939)

## Links

- **AIDesk App**: [github.com/unkownpr/AIDesk](https://github.com/unkownpr/AIDesk)
- **Website**: [unkownpr.github.io/AIDesk](https://unkownpr.github.io/AIDesk/)
- **Author**: [ssilistre.dev](https://ssilistre.dev)

## License

[MIT](https://github.com/unkownpr/AIDesk/blob/main/LICENSE)
