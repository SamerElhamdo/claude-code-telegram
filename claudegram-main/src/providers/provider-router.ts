import { cursorProvider } from './cursor-provider.js';
import { parseSessionKey } from '../utils/session-key.js';
import type { AgentOptions, LoopOptions, AgentResponse, AgentUsage, ModelInfo } from './types.js';

export type { AgentUsage, AgentResponse, AgentOptions, LoopOptions, ModelInfo };

export function getActiveProviderName(): 'cursor' {
  return 'cursor';
}

export async function sendToAgent(
  sessionKey: string,
  message: string,
  options?: AgentOptions
): Promise<AgentResponse> {
  const chatId = parseSessionKey(sessionKey).chatId;
  const opts = { ...options, model: options?.model ?? cursorProvider.getModel(chatId) };
  return cursorProvider.sendToAgent(sessionKey, message, opts);
}

export async function sendLoopToAgent(
  sessionKey: string,
  message: string,
  options?: LoopOptions
): Promise<AgentResponse> {
  const chatId = parseSessionKey(sessionKey).chatId;
  const opts = { ...options, model: options?.model ?? cursorProvider.getModel(chatId) };
  return cursorProvider.sendLoopToAgent(sessionKey, message, opts);
}

export function clearConversation(sessionKey: string): void {
  cursorProvider.clearConversation(sessionKey);
}

export function setModel(chatId: number, model: string): void {
  cursorProvider.setModel(chatId, model);
}

export function getModel(chatId: number): string {
  return cursorProvider.getModel(chatId);
}

export function clearModel(chatId: number): void {
  cursorProvider.clearModel(chatId);
}

export function getCachedUsage(sessionKey: string): AgentUsage | undefined {
  const chatId = parseSessionKey(sessionKey).chatId;
  return cursorProvider.getCachedUsage(sessionKey);
}

export function isDangerousMode(): boolean {
  return cursorProvider.isDangerousMode();
}

export async function getAvailableModels(chatId: number): Promise<ModelInfo[]> {
  return cursorProvider.getAvailableModels(chatId);
}
