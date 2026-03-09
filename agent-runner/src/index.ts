import { query } from "@anthropic-ai/claude-agent-sdk";
import { createInterface } from "readline";

// === Types ===

interface RunCommand {
  type: "run";
  taskId: string;
  prompt: string;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  allowedTools?: string[];
  systemPrompt?: string;
  permissionMode?: string;
  timeoutMs?: number;
}

interface AbortCommand {
  type: "abort";
  taskId: string;
}

type Command = RunCommand | AbortCommand;

interface OutputMessage {
  type: "progress" | "result" | "error" | "started";
  taskId: string;
  content?: string;
  outputType?: string;
  success?: boolean;
}

// === State ===

const activeQueries = new Map<string, { close: () => void }>();

// === Helpers ===

function send(msg: OutputMessage): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

// === Task Execution ===

async function executeTask(cmd: RunCommand): Promise<void> {
  const { taskId, prompt, cwd, model, maxTurns, allowedTools, systemPrompt, permissionMode, timeoutMs } = cmd;

  send({ type: "started", taskId });

  // Change Node.js process working directory to match the agent's configured directory
  if (cwd) {
    try {
      process.chdir(cwd);
    } catch (e) {
      send({ type: "error", taskId, content: `Failed to change directory to ${cwd}: ${e}` });
      return;
    }
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const queryInstance = query({
      prompt,
      options: {
        cwd: cwd || undefined,
        model: model || undefined,
        maxTurns: maxTurns || undefined,
        allowedTools: allowedTools || ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
        permissionMode: (permissionMode as "default" | "acceptEdits" | "bypassPermissions") || "bypassPermissions",
        systemPrompt: systemPrompt || undefined,
      },
    });

    // Store for abort capability
    activeQueries.set(taskId, { close: () => queryInstance.close() });

    // Setup timeout
    if (timeoutMs) {
      timeoutHandle = setTimeout(() => {
        queryInstance.close();
        send({ type: "error", taskId, content: "Task timed out" });
      }, timeoutMs);
    }

    let finalResult = "";

    for await (const message of queryInstance) {
      const msgType = (message as Record<string, unknown>).type as string;

      if (msgType === "assistant") {
        const msg = message as Record<string, unknown>;
        const msgContent = (msg.message as Record<string, unknown>)?.content;

        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block && typeof block === "object" && "text" in block && typeof block.text === "string") {
              send({
                type: "progress",
                taskId,
                content: block.text,
                outputType: "assistant",
              });
            }
          }
        }
      } else if (msgType === "result") {
        const msg = message as Record<string, unknown>;
        finalResult = (msg.result as string) || "";

        send({
          type: "progress",
          taskId,
          content: finalResult,
          outputType: "result",
        });
      }
    }

    send({
      type: "result",
      taskId,
      content: finalResult,
      success: true,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    send({
      type: "error",
      taskId,
      content: errorMsg,
    });
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    activeQueries.delete(taskId);
  }
}

// === Command Router ===

function handleCommand(line: string): void {
  let cmd: Command;
  try {
    cmd = JSON.parse(line) as Command;
  } catch {
    send({ type: "error", taskId: "unknown", content: "Invalid JSON command" });
    return;
  }

  switch (cmd.type) {
    case "run":
      // Fire and forget - results streamed via stdout
      executeTask(cmd).catch((err) => {
        send({ type: "error", taskId: cmd.taskId, content: String(err) });
      });
      break;

    case "abort": {
      const active = activeQueries.get(cmd.taskId);
      if (active) {
        active.close();
        activeQueries.delete(cmd.taskId);
        send({ type: "error", taskId: cmd.taskId, content: "Task aborted" });
      }
      break;
    }

    default:
      send({ type: "error", taskId: "unknown", content: `Unknown command type: ${(cmd as Command).type}` });
  }
}

// === Main ===

const rl = createInterface({ input: process.stdin });

rl.on("line", (line: string) => {
  const trimmed = line.trim();
  if (trimmed) handleCommand(trimmed);
});

rl.on("close", () => {
  // Parent process closed stdin - cleanup and exit
  for (const [, q] of activeQueries) {
    q.close();
  }
  process.exit(0);
});

// Signal readiness
send({ type: "started", taskId: "__runner__", content: "Agent runner ready" });
