# aidesk-agent

Remote agent CLI for [AIDesk](https://github.com/ssilistre/aidesk) — connects to your AIDesk server and executes Claude Code tasks automatically.

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

## Requirements

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated on the remote machine
- Network access to AIDesk server (port 3939)

## License

MIT
