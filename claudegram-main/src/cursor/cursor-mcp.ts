/**
 * Cursor MCP configuration — creates .cursor/mcp.json in the workspace
 * so Cursor agent can use MCP servers (Dokploy, GitHub, etc.) when running.
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.js';

export interface CursorMcpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Ensures .cursor/mcp.json exists in the workspace with configured MCP servers.
 * Cursor agent reads this file when run with cwd = workingDirectory.
 * Call before spawning the agent.
 */
export function ensureCursorMcpConfig(workingDirectory: string): void {
  const mcpServers: Record<string, CursorMcpServer> = {};

  // Dokploy MCP (stdio via npx)
  if (config.DOKPLOY_MCP_ENABLED && config.DOKPLOY_URL && config.DOKPLOY_API_KEY) {
    mcpServers['dokploy'] = {
      command: 'npx',
      args: ['-y', '@ahdev/dokploy-mcp'],
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        HOME: process.env.HOME || '/home/node',
        DOKPLOY_URL: config.DOKPLOY_URL,
        DOKPLOY_API_KEY: config.DOKPLOY_API_KEY,
      },
    };
  }

  // GitHub MCP (stdio via npx)
  const githubToken = config.GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (config.GITHUB_MCP_ENABLED && githubToken) {
    mcpServers['github'] = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        HOME: process.env.HOME || '/home/node',
        GITHUB_TOKEN: githubToken,
      },
    };
  }

  if (Object.keys(mcpServers).length === 0) {
    return;
  }

  console.log('[Cursor MCP] Writing mcp.json with servers:', Object.keys(mcpServers).join(', '));

  const cursorDir = path.join(workingDirectory, '.cursor');
  const mcpPath = path.join(cursorDir, 'mcp.json');

  try {
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true, mode: 0o755 });
    }

    const mcpConfig = {
      mcpServers,
    };

    fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Cursor MCP] Failed to write mcp.json:', err instanceof Error ? err.message : err);
  }
}
