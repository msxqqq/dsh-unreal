import { readFileSync } from 'node:fs';
import { win32 as path } from 'node:path';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
// Unreal's built-in MCP server responds with JSON even on builds omitting Content-Type.
const maxResponseBytes = 32 * 1024 * 1024;
export const toolNames = ['list_toolsets', 'describe_toolset', 'call_tool'];
export const modernToolNames = ['list_toolsets', 'describe_toolsets', 'describe_tools', 'call_tool'];
// Only a path on the verified 127.0.0.1 listener, never a URL or authority.
export const validMcpPath = value => typeof value === 'string' && value.length <= 256 &&
  /^\/(?!\/)[A-Za-z0-9_~.!$&'()*+;=:@%/-]+$/.test(value) && !/%(?![0-9a-f]{2})/i.test(value) &&
  !value.split('/').some(part => ['.', '..'].includes(part.replace(/%2e/ig, '.')));

export function assertEditorIdentity(info, target) {
  const instance = info?._meta?.['com.epicgames.unrealengine/instance'];
  if (!target || instance === undefined) return;
  if (!instance || typeof instance !== 'object' ||
      (instance.processId !== undefined && Number(instance.processId) !== target.pid)) {
    throw new Error('Unreal MCP reported a different editor process.');
  }
  if (typeof instance.projectFile === 'string' && instance.projectFile &&
      normalizeWindowsPath(instance.projectFile) !== normalizeWindowsPath(target.path)) {
    throw new Error('Unreal MCP reported a different project file.');
  }
}

function normalizeWindowsPath(value) { return path.normalize(value).toLowerCase(); }

async function readEventStream(reader, id) {
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    bytes += value?.byteLength ?? 0;
    if (bytes > maxResponseBytes) throw new Error('Unreal MCP response exceeded 32 MiB.');
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    let separator;
    while ((separator = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator[0].length);
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data) continue;
      const event = JSON.parse(data);
      if (event?.id === id) return event;
    }
    if (done) return undefined;
  }
}

async function readResponse(response, id) {
  if (!response.body) return undefined;
  if (/^text\/event-stream\b/i.test(response.headers.get('content-type') ?? '')) {
    const reader = response.body.getReader();
    try { return await readEventStream(reader, id); }
    finally { await reader.cancel().catch(() => {}); }
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxResponseBytes) throw new Error('Unreal MCP response exceeded 32 MiB.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return undefined;
  if (!text.startsWith('data:') && !text.startsWith('event:')) return JSON.parse(text);
  return text.split(/\r?\n\r?\n/).map(frame => frame.split(/\r?\n/)
    .filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'))
    .filter(Boolean).map(data => JSON.parse(data));
}

export class UnrealMcp {
  #id = 0;
  #session;
  #protocol = '2025-11-25';
  #initialized = false;
  capabilities = {};
  #advertised = new Set();
  constructor(port, endpointPath = '/mcp') {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Unreal MCP port.');
    if (!validMcpPath(endpointPath)) throw new Error('Invalid Unreal MCP endpoint path.');
    this.url = `http://127.0.0.1:${port}${endpointPath}`;
  }
  async request(method, params, signal, notification = false) {
    const id = notification ? undefined : ++this.#id;
    try {
      return await this.#send(method, params, id, signal);
    } catch (error) {
      if (method === 'tools/call' && signal?.aborted && this.#initialized) {
        // Closing the HTTP request does not cancel work inside Unreal.
        void this.request('notifications/cancelled', { requestId: id, reason: 'Cancelled by DeepSeek Harness' },
          AbortSignal.timeout(1500), true).catch(() => {});
      }
      throw error;
    }
  }
  async #send(method, params, id, signal) {
    const response = await fetch(this.url, {
      method: 'POST', redirect: 'error', signal,
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        ...(this.#session ? { 'Mcp-Session-Id': this.#session } : {}),
        ...(this.#initialized ? { 'MCP-Protocol-Version': this.#protocol } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Unreal MCP returned HTTP ${response.status} (${method}).`);
    }
    const session = response.headers.get('mcp-session-id');
    if (method === 'initialize' && session) this.#session = session;
    if (id === undefined) { await response.body?.cancel(); return; }
    const body = await readResponse(response, id);
    const message = Array.isArray(body) ? body.find(item => item?.id === id) : body;
    if (message?.id !== id || message?.jsonrpc !== '2.0') throw new Error('Invalid Unreal MCP response.');
    if (message.error) throw new Error(String(message.error.message ?? 'Unreal MCP request failed.'));
    return message.result;
  }
  async connect(signal, target) {
    const info = await this.request('initialize', {
      protocolVersion: this.#protocol, capabilities: {}, clientInfo: { name: 'DSH Unreal Projects', version },
    }, signal);
    if (!info?.capabilities?.tools || typeof info.protocolVersion !== 'string') throw new Error('The endpoint did not advertise MCP tools.');
    assertEditorIdentity(info, target);
    this.#protocol = info.protocolVersion;
    this.#initialized = true;
    this.capabilities = info.capabilities;
    await this.request('notifications/initialized', undefined, signal, true);
    await this.refreshTools(signal);
    const search = toolNames.every(name => this.hasTool(name)) || modernToolNames.every(name => this.hasTool(name));
    const instance = info._meta?.['com.epicgames.unrealengine/instance'];
    const verifiedEngine = target?.supportedEngine && !!this.#session;
    const identified = instance?.processId !== undefined || typeof instance?.projectFile === 'string' && !!instance.projectFile;
    if (!search && !(verifiedEngine && (identified || info.serverInfo?.name === '' || info.serverInfo?.name === 'unreal-mcp'))) {
      throw new Error('The endpoint does not expose a recognizable Unreal MCP tool catalog.');
    }
  }
  async refreshTools(signal) {
    let page = await this.listTools({}, signal);
    const advertised = new Set(page.tools.map(tool => tool.name));
    const cursors = new Set();
    while (typeof page.nextCursor === 'string' && page.nextCursor) {
      if (cursors.has(page.nextCursor) || cursors.size >= 128) throw new Error('Invalid Unreal MCP catalog pagination.');
      cursors.add(page.nextCursor);
      page = await this.listTools({ cursor: page.nextCursor }, signal);
      for (const tool of page.tools) advertised.add(tool.name);
    }
    this.#advertised = advertised;
  }
  hasTool(name) { return this.#advertised.has(name); }
  async listTools(params, signal) {
    const page = await this.request('tools/list', params, signal);
    if (!Array.isArray(page?.tools) || page.tools.some(tool => typeof tool?.name !== 'string' || !tool.name)) {
      throw new Error('Invalid Unreal MCP tools/list response.');
    }
    return page;
  }
  callTool(name, args, signal) {
    return this.request('tools/call', { name, arguments: args }, signal);
  }
  async close(signal) {
    if (!this.#session) return;
    const response = await fetch(this.url, { method: 'DELETE', redirect: 'error', signal,
      headers: { 'Mcp-Session-Id': this.#session, 'MCP-Protocol-Version': this.#protocol } });
    await response.body?.cancel();
  }
}
