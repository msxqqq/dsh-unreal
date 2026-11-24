import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
// Unreal's built-in MCP server responds with JSON even on builds omitting Content-Type.
const maxResponseBytes = 32 * 1024 * 1024;
export const toolNames = ['list_toolsets', 'describe_toolset', 'call_tool'];

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
  #protocol = '2025-06-18';
  constructor(port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Unreal MCP port.');
    this.url = `http://127.0.0.1:${port}/mcp`;
  }
  async request(method, params, signal, notification = false) {
    const id = notification ? undefined : ++this.#id;
    const response = await fetch(this.url, {
      method: 'POST', redirect: 'error', signal,
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        ...(this.#session ? { 'Mcp-Session-Id': this.#session, 'MCP-Protocol-Version': this.#protocol } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Unreal MCP returned HTTP ${response.status} (${method}).`);
    }
    const session = response.headers.get('mcp-session-id');
    if (method === 'initialize' && session) this.#session = session;
    if (notification) { await response.body?.cancel(); return; }
    const body = await readResponse(response, id);
    const message = Array.isArray(body) ? body.find(item => item?.id === id) : body;
    if (message?.id !== id || message?.jsonrpc !== '2.0') throw new Error('Invalid Unreal MCP response.');
    if (message.error) throw new Error(String(message.error.message ?? 'Unreal MCP request failed.'));
    return message.result;
  }
  async connect(signal) {
    const info = await this.request('initialize', {
      protocolVersion: this.#protocol, capabilities: {}, clientInfo: { name: 'DSH Unreal Projects', version },
    }, signal);
    if (!info?.capabilities?.tools || !info.protocolVersion) throw new Error('The endpoint did not advertise MCP tools.');
    this.#protocol = info.protocolVersion;
    await this.request('notifications/initialized', undefined, signal, true);
    const result = await this.request('tools/list', {}, signal);
    if (!Array.isArray(result?.tools) || !toolNames.every(name => result.tools.some(tool => tool?.name === name))) {
      throw new Error('The endpoint does not expose the three Unreal MCP tools. Enable Tool Search in Unreal MCP settings.');
    }
  }
  async close(signal) {
    if (!this.#session) return;
    const response = await fetch(this.url, { method: 'DELETE', redirect: 'error', signal,
      headers: { 'Mcp-Session-Id': this.#session, 'MCP-Protocol-Version': this.#protocol } });
    await response.body?.cancel();
  }
}
