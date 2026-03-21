import {
  sendToCursorAgent,
  sendLoopToCursorAgent,
  clearCursorConversation,
  setCursorModel,
  getCursorModel,
  clearCursorModel,
  getCursorCachedUsage,
  isCursorDangerousMode,
  getCursorAvailableModels,
} from '../cursor/cursor-agent.js';
import type { Provider, AgentOptions, LoopOptions, AgentResponse, AgentUsage, ModelInfo } from './types.js';

export const cursorProvider: Provider = {
  name: 'cursor',

  sendToAgent(sessionKey: string, message: string, options?: AgentOptions): Promise<AgentResponse> {
    return sendToCursorAgent(sessionKey, message, options);
  },

  sendLoopToAgent(sessionKey: string, message: string, options?: LoopOptions): Promise<AgentResponse> {
    return sendLoopToCursorAgent(sessionKey, message, options);
  },

  clearConversation(sessionKey: string): void {
    clearCursorConversation(sessionKey);
  },

  setModel(chatId: number, model: string): void {
    setCursorModel(chatId, model);
  },

  getModel(chatId: number): string {
    return getCursorModel(chatId);
  },

  clearModel(chatId: number): void {
    clearCursorModel(chatId);
  },

  getCachedUsage(sessionKey: string): AgentUsage | undefined {
    return getCursorCachedUsage(sessionKey);
  },

  isDangerousMode(): boolean {
    return isCursorDangerousMode();
  },

  async getAvailableModels(_chatId: number): Promise<ModelInfo[]> {
    return getCursorAvailableModels();
  },
};
