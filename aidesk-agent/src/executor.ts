/**
 * Task Executor - runs tasks using Claude Agent SDK
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { AideskClient, type Task } from "./client.js";

export interface ExecutorOptions {
  cwd?: string;
  model?: string;
  maxTurns?: number;
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
}

export async function executeTask(
  client: AideskClient,
  task: Task,
  options: ExecutorOptions
): Promise<void> {
  const taskId = task.id;
  const cwd = options.cwd || process.cwd();

  console.log(`\n  Task: ${task.title}`);
  console.log(`  Priority: ${task.priority}`);
  console.log(`  CWD: ${cwd}`);
  console.log(`  Description: ${task.description.substring(0, 100)}...`);
  console.log("");

  await client.sendLog({
    task_id: taskId,
    log_type: "info",
    message: `Remote agent started task execution (cwd: ${cwd})`,
  });

  try {
    const queryInstance = query({
      prompt: task.description,
      options: {
        cwd,
        model: options.model || undefined,
        maxTurns: options.maxTurns || undefined,
        allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
        permissionMode: options.permissionMode || "default",
      },
    });

    let finalResult = "";

    for await (const message of queryInstance) {
      const msgType = (message as Record<string, unknown>).type as string;

      if (msgType === "assistant") {
        const msg = message as Record<string, unknown>;
        const msgContent = (msg.message as Record<string, unknown>)?.content;

        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (
              block &&
              typeof block === "object" &&
              "text" in block &&
              typeof block.text === "string"
            ) {
              // Send progress log to server
              await client.sendLog({
                task_id: taskId,
                log_type: "assistant",
                message: block.text,
              });

              // Print truncated output to console
              const preview = block.text.substring(0, 200);
              process.stdout.write(`  ${preview}${block.text.length > 200 ? "..." : ""}\n`);
            }
          }
        }
      } else if (msgType === "result") {
        const msg = message as Record<string, unknown>;
        finalResult = (msg.result as string) || "";

        await client.sendLog({
          task_id: taskId,
          log_type: "result",
          message: finalResult,
        });
      }
    }

    // Report success
    await client.report({
      task_id: taskId,
      status: "completed",
      result: finalResult,
    });

    console.log(`\n  ✓ Task completed successfully\n`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await client.sendLog({
      task_id: taskId,
      log_type: "error",
      message: errorMsg,
    });

    await client.report({
      task_id: taskId,
      status: "failed",
      error: errorMsg,
    });

    console.error(`\n  ✗ Task failed: ${errorMsg}\n`);
  }
}
