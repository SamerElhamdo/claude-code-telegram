/**
 * Cursor CLI agent integration.
 * Spawns Cursor's `agent` CLI and parses output for streaming/response.
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import { sessionManager } from '../claude/session-manager.js';
import { config } from '../config.js';
import { parseSessionKey } from '../utils/session-key.js';
import { ensureCursorMcpConfig } from './cursor-mcp.js';
import type {
  AgentResponse,
  AgentOptions,
  LoopOptions,
  AgentUsage,
} from '../providers/types.js';

const cursorModels = new Map<string, string>();
const cursorUsageCache = new Map<string, AgentUsage>();

function getCursorSessionId(sessionKey: string): string | undefined {
  const session = sessionManager.getSession(sessionKey);
  return session?.claudeSessionId; // Reuse for Cursor thread ID
}

function buildAgentArgs(
  prompt: string,
  options: {
    cwd: string;
    resumeId?: string;
    mode?: 'plan' | 'ask';
    model?: string;
  }
): string[] {
  const args: string[] = ['-p', prompt, '--trust', '--approve-mcps', '--yolo'];
  if (options.resumeId) {
    args.push('--resume', options.resumeId);
  }
  if (options.mode === 'plan') {
    args.push('--plan');
  } else if (options.mode === 'ask') {
    args.push('--mode=ask');
  }
  if (options.model) {
    args.push('--model', options.model);
  }
  args.push('--output-format', 'text');
  return args;
}

/** Brief context so the agent identifies correctly (Cursor/Composer/GPT/Claude) when asked who it is. */
const IDENTITY_CONTEXT = `[Context: You are responding via a Telegram bot. The user chose Cursor as provider. When asked about your identity or model, state truthfully what you actually are (e.g. Composer 2, GPT-5, Claude Opus) — not a generic "Claude from Anthropic" unless you are actually Claude.]\n\n`;

export async function sendToCursorAgent(
  sessionKey: string,
  message: string,
  options: AgentOptions = {}
): Promise<AgentResponse> {
  const { onProgress, abortController } = options;
  const session = sessionManager.getSession(sessionKey);
  if (!session) {
    throw new Error('No active session. Use /project to set working directory.');
  }

  let cwd = session.workingDirectory;
  if (!fs.existsSync(cwd)) {
    cwd = process.env.HOME || process.cwd();
  }

  const cliPath = config.CURSOR_CLI_PATH || 'agent';
  const resumeId = getCursorSessionId(sessionKey);
  const mode = options.command === 'plan' ? 'plan' : options.command === 'explore' ? 'ask' : undefined;
  const prompt = IDENTITY_CONTEXT + message;

  ensureCursorMcpConfig(cwd);

  const args = buildAgentArgs(prompt, {
    cwd,
    resumeId,
    mode,
    model: options.model || getCursorModel(parseSessionKey(sessionKey).chatId),
  });

  return new Promise<AgentResponse>((resolve, reject) => {
    let fullText = '';
    const toolsUsed: string[] = [];

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (config.CURSOR_API_KEY) {
      env.CURSOR_API_KEY = config.CURSOR_API_KEY;
    }

    const child: ChildProcess = spawn(cliPath, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const handleAbort = () => {
      try {
        child.kill('SIGTERM');
      } catch {
        child.kill('SIGKILL');
      }
    };

    if (abortController) {
      if (abortController.signal.aborted) {
        handleAbort();
        resolve({ text: '🛑 Request cancelled.', toolsUsed });
        return;
      }
      abortController.signal.addEventListener('abort', handleAbort);
    }

    let stderrBuf = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      console.error('[Cursor stderr]:', chunk.toString());
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      fullText += text;
      onProgress?.(fullText);
    });

    child.on('error', (err) => {
      abortController?.signal.removeEventListener('abort', handleAbort);
      reject(new Error(`Cursor CLI error: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      abortController?.signal.removeEventListener('abort', handleAbort);

      if (abortController?.signal.aborted) {
        resolve({ text: '🛑 Request cancelled.', toolsUsed });
        return;
      }

      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        resolve({ text: '🛑 Request cancelled.', toolsUsed });
        return;
      }

      if (code !== 0 && code !== null) {
        const errMsg = stderrBuf.trim() || `Cursor exited with code ${code}`;
        reject(new Error(errMsg));
        return;
      }

      // Try to extract thread ID from output if Cursor emits it (future)
      // For now we don't have thread ID from -p mode easily; would need agent ls parsing
      resolve({
        text: fullText.trim() || 'No response from Cursor.',
        toolsUsed,
        usage: cursorUsageCache.get(sessionKey),
      });
    });
  });
}

export async function sendLoopToCursorAgent(
  sessionKey: string,
  message: string,
  options: LoopOptions = {}
): Promise<AgentResponse> {
  const {
    onProgress,
    abortController,
    maxIterations = config.MAX_LOOP_ITERATIONS,
    onIterationComplete,
  } = options;

  const session = sessionManager.getSession(sessionKey);
  if (!session) {
    throw new Error('No active session. Use /project to set working directory.');
  }

  const loopPrompt = `${message}

IMPORTANT: When you have fully completed this task, respond with the word "DONE" on its own line at the end of your response.`;

  let iteration = 0;
  let combinedText = '';
  const allToolsUsed: string[] = [];
  let isComplete = false;

  while (iteration < maxIterations && !isComplete) {
    iteration++;
    if (abortController?.signal.aborted) {
      return { text: combinedText + '\n\n🛑 Loop cancelled.', toolsUsed: allToolsUsed };
    }

    const currentPrompt = iteration === 1 ? loopPrompt : 'Continue the task. Say "DONE" when complete.';

    try {
      const response = await sendToCursorAgent(sessionKey, currentPrompt, {
        onProgress: (text) => onProgress?.(combinedText + text),
        abortController,
        model: options.model,
      });

      combinedText += response.text;
      allToolsUsed.push(...response.toolsUsed);
      onIterationComplete?.(iteration, response.text);

      if (response.text.includes('DONE')) {
        isComplete = true;
      }
    } catch (error) {
      if (abortController?.signal.aborted) {
        return { text: combinedText + '\n\n🛑 Loop cancelled.', toolsUsed: allToolsUsed };
      }
      throw error;
    }
  }

  return {
    text: combinedText,
    toolsUsed: allToolsUsed,
  };
}

export function clearCursorConversation(sessionKey: string): void {
  const session = sessionManager.getSession(sessionKey);
  if (session) {
    session.claudeSessionId = undefined;
  }
}

export function setCursorModel(chatId: number, model: string): void {
  cursorModels.set(String(chatId), model);
}

export function getCursorModel(chatId: number): string {
  return cursorModels.get(String(chatId)) || 'composer-1.5';
}

export function clearCursorModel(chatId: number): void {
  cursorModels.delete(String(chatId));
}

export function getCursorCachedUsage(sessionKey: string): AgentUsage | undefined {
  return cursorUsageCache.get(sessionKey);
}

export function isCursorDangerousMode(): boolean {
  return config.DANGEROUS_MODE;
}

/** Fallback models when `agent models` fails (e.g. no auth in Docker) */
const CURSOR_MODELS_FALLBACK = [
  { id: 'auto', label: 'Auto', description: 'Auto' },
  { id: 'composer-2-fast', label: 'Composer 2 Fast', description: 'Fast' },
  { id: 'composer-2', label: 'Composer 2', description: 'Default' },
  { id: 'composer-1.5', label: 'Composer 1.5', description: 'Balanced' },
  { id: 'gpt-5.4-medium', label: 'GPT-5.4', description: 'GPT-5.4' },
  { id: 'gpt-5.4-mini-medium', label: 'GPT-5.4 Mini', description: 'Faster' },
  { id: 'claude-4.6-opus-high-thinking', label: 'Claude Opus 4.6 Thinking', description: 'Max' },
  { id: 'claude-4.6-sonnet-medium', label: 'Claude Sonnet 4.6', description: 'Sonnet' },
  { id: 'claude-4.5-opus-high', label: 'Claude Opus 4.5', description: 'Opus' },
  { id: 'claude-4.5-sonnet', label: 'Claude Sonnet 4.5', description: 'Sonnet' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', description: 'Gemini' },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', description: 'Fast' },
  { id: 'grok-4-20', label: 'Grok 4.20', description: 'xAI' },
];

const MODELS_FETCH_TIMEOUT_MS = 10000;

export async function getCursorAvailableModels(): Promise<Array<{ id: string; label: string; description: string }>> {
  const cliPath = config.CURSOR_CLI_PATH || 'agent';
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (config.CURSOR_API_KEY) {
      env.CURSOR_API_KEY = config.CURSOR_API_KEY;
    }
    const child = spawn(cliPath, ['models'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let settled = false;
    const finish = (models: typeof CURSOR_MODELS_FALLBACK) => {
      if (!settled) {
        settled = true;
        try { child.kill(); } catch { /* ignore */ }
        resolve(models);
      }
    };
    const timeout = setTimeout(() => finish(CURSOR_MODELS_FALLBACK), MODELS_FETCH_TIMEOUT_MS);
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        resolve(CURSOR_MODELS_FALLBACK);
        return;
      }
      const models: Array<{ id: string; label: string; description: string }> = [];
      const lines = stdout.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        if (line === 'Available models' || line.startsWith('Tip:')) continue;
        const dashIdx = line.indexOf(' - ');
        if (dashIdx > 0) {
          const id = line.slice(0, dashIdx).trim();
          let rest = line.slice(dashIdx + 3).trim();
          rest = rest.replace(/\s*\((current|default)\)\s*$/i, '').trim();
          models.push({ id, label: rest || id, description: rest || id });
        }
      }
      resolve(models.length > 0 ? models : CURSOR_MODELS_FALLBACK);
    });
    child.on('error', () => finish(CURSOR_MODELS_FALLBACK));
  });
}
