#!/usr/bin/env node

/**
 * AIDesk Agent CLI
 *
 * Usage:
 *   AIDESK_TOKEN=xxx aidesk-agent --server http://192.168.1.5:3939
 *   aidesk-agent --server http://192.168.1.5:3939 --token xxx --insecure
 */

import { AideskClient } from "./client.js";
import { executeTask, type ExecutorOptions } from "./executor.js";

// === CLI Argument Parsing ===

const VALID_PERMISSION_MODES = ["default", "acceptEdits", "bypassPermissions"] as const;
type PermissionMode = (typeof VALID_PERMISSION_MODES)[number];

interface CliArgs {
  server: string;
  token: string;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  pollInterval: number;
  permissionMode: PermissionMode;
  insecure: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  AIDesk Agent - Remote Claude Code Agent

  Usage:
    AIDESK_TOKEN=<token> aidesk-agent --server <url> [options]
    aidesk-agent --server <url> --token <token> [options]

  Required:
    --server <url>       AIDesk server URL (e.g. https://192.168.1.5:3939)

  Authentication (one required):
    AIDESK_TOKEN env var  Recommended - not visible in process list
    --token <token>       Alternative - visible in \`ps\` output (less secure)

  Options:
    --cwd <path>          Working directory for task execution (default: current dir)
    --model <model>       Claude model to use (default: agent config)
    --max-turns <n>       Max conversation turns (default: agent config, min: 1)
    --poll-interval <s>   Poll interval in seconds (default: 3, min: 1)
    --permission-mode <m> default, acceptEdits, or bypassPermissions (default: default)
    --insecure            Allow plain HTTP connections (not recommended)
    --help, -h            Show this help
`);
    process.exit(0);
  }

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    return args[idx + 1];
  }

  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  // --- Server URL validation ---
  const server = getArg("server");
  if (!server) {
    console.error("Error: --server is required");
    process.exit(1);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(server);
  } catch {
    console.error(`Error: Invalid server URL: ${server}`);
    process.exit(1);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    console.error(`Error: Server URL must use http:// or https:// (got ${parsedUrl.protocol})`);
    process.exit(1);
  }

  const insecure = hasFlag("insecure");
  if (parsedUrl.protocol === "http:" && !insecure) {
    console.error(
      "Error: Plain HTTP is insecure (token sent in cleartext).\n" +
        "  Use https:// or pass --insecure to allow HTTP connections."
    );
    process.exit(1);
  }

  // --- Token: prefer env var, fall back to --token ---
  const token = process.env.AIDESK_TOKEN || getArg("token");
  if (!token) {
    console.error("Error: Token required. Set AIDESK_TOKEN env var or use --token <token>");
    process.exit(1);
  }

  if (!process.env.AIDESK_TOKEN && getArg("token")) {
    console.warn("  ⚠ Warning: --token is visible in process list. Prefer AIDESK_TOKEN env var.\n");
  }

  // --- Permission mode validation ---
  const permRaw = getArg("permission-mode") || "default";
  if (!VALID_PERMISSION_MODES.includes(permRaw as PermissionMode)) {
    console.error(`Error: Invalid permission mode '${permRaw}'. Must be: ${VALID_PERMISSION_MODES.join(", ")}`);
    process.exit(1);
  }
  const permissionMode = permRaw as PermissionMode;

  if (permissionMode === "bypassPermissions") {
    console.warn("  ⚠ Warning: bypassPermissions mode grants unrestricted system access.\n");
  }

  // --- Numeric validation ---
  let maxTurns: number | undefined;
  const maxTurnsRaw = getArg("max-turns");
  if (maxTurnsRaw) {
    maxTurns = parseInt(maxTurnsRaw, 10);
    if (isNaN(maxTurns) || maxTurns < 1) {
      console.error("Error: --max-turns must be a positive integer");
      process.exit(1);
    }
  }

  let pollInterval = 3;
  const pollRaw = getArg("poll-interval");
  if (pollRaw) {
    pollInterval = parseInt(pollRaw, 10);
    if (isNaN(pollInterval) || pollInterval < 1) {
      console.error("Error: --poll-interval must be a positive integer (min: 1)");
      process.exit(1);
    }
  }

  // Clear token from process.argv to reduce exposure in crash dumps
  const tokenIdx = args.indexOf("--token");
  if (tokenIdx !== -1 && tokenIdx + 1 < process.argv.length) {
    process.argv[tokenIdx + 2 + 1] = "***";
  }

  return {
    server,
    token,
    cwd: getArg("cwd"),
    model: getArg("model"),
    maxTurns,
    pollInterval,
    permissionMode,
    insecure,
  };
}

// === Main Loop ===

async function main(): Promise<void> {
  const args = parseArgs();
  const client = new AideskClient(args.server, args.token);

  const pollIntervalMs = args.pollInterval * 1000;
  const heartbeatIntervalMs = 30_000;

  const cwd = args.cwd || process.cwd();
  const serverDisplay = args.server.length > 27 ? args.server.substring(0, 24) + "..." : args.server;
  const cwdDisplay = cwd.length > 27 ? cwd.substring(0, 24) + "..." : cwd;

  console.log(`
  ╔══════════════════════════════════════╗
  ║         AIDesk Remote Agent          ║
  ╠══════════════════════════════════════╣
  ║  Server: ${serverDisplay.padEnd(27)}║
  ║  CWD:    ${cwdDisplay.padEnd(27)}║
  ║  Poll:   ${`${args.pollInterval}s`.padEnd(27)}║
  ║  Mode:   ${args.permissionMode.padEnd(27)}║
  ╚══════════════════════════════════════╝
`);

  if (args.insecure) {
    console.warn("  ⚠ Running in insecure mode (HTTP). Token transmitted in cleartext.\n");
  }

  // Verify server connectivity
  console.log("  Connecting to server...");
  const healthy = await client.healthCheck();
  if (!healthy) {
    console.error("  ✗ Cannot reach server. Check URL and network.");
    process.exit(1);
  }

  // Verify token by sending initial heartbeat
  try {
    await client.heartbeat("online");
    console.log("  ✓ Connected and authenticated\n");
  } catch (err) {
    console.error(`  ✗ Authentication failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Heartbeat loop
  const heartbeatTimer = setInterval(async () => {
    try {
      await client.heartbeat(isExecuting ? "busy" : "online");
    } catch {
      // Non-fatal
    }
  }, heartbeatIntervalMs);

  // Graceful shutdown
  let shuttingDown = false;
  let isExecuting = false;

  function shutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n  Shutting down...");
    clearInterval(heartbeatTimer);
    client
      .heartbeat("idle")
      .catch(() => {})
      .finally(() => process.exit(0));
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Poll loop with exponential backoff on errors
  console.log("  Waiting for tasks...\n");
  let consecutiveErrors = 0;

  while (!shuttingDown) {
    try {
      const task = await client.poll();
      consecutiveErrors = 0; // Reset on success

      if (task) {
        console.log(`  ► Received task: [${task.id.substring(0, 8)}] ${task.title}`);
        isExecuting = true;

        const execOptions: ExecutorOptions = {
          cwd,
          model: args.model,
          maxTurns: args.maxTurns,
          permissionMode: args.permissionMode,
        };

        await executeTask(client, task, execOptions);

        isExecuting = false;
        console.log("  Waiting for tasks...\n");
      }
    } catch (err) {
      if (!shuttingDown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Authentication failed")) {
          console.error(`  ✗ ${msg}`);
          process.exit(1);
        }
        consecutiveErrors++;
        console.error(`  ! Poll error: ${msg}`);
      }
    }

    // Exponential backoff: pollInterval * 2^errors (capped at 60s)
    const backoff = consecutiveErrors > 0
      ? Math.min(pollIntervalMs * Math.pow(2, consecutiveErrors), 60_000)
      : pollIntervalMs;
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
