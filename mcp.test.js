import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { UnrealMcp, toolNames } from './mcp.js';

async function serverFor(t, handler) {
  const server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks));
      handler(request, response, body);
    } catch (error) {
      response.writeHead(400).end(String(error));
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return server.address().port;
}

const result = (response, id, value) => response.end(JSON.stringify({ jsonrpc: '2.0', id, result: value }));

test('Unreal JSON MCP handshake, session forwarding and tool call', async t => {
  const methods = [];
  const port = await serverFor(t, (request, response, body) => {
    assert.equal(request.url, '/mcp');
    if (body?.method !== 'initialize') assert.equal(request.headers['mcp-session-id'], 'test-editor');
    if (request.method === 'DELETE') { methods.push('DELETE'); return response.writeHead(204).end(); }
    methods.push(body.method);
    if (body.method === 'initialize') {
      response.setHeader('Mcp-Session-Id', 'test-editor');
      return result(response, body.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} } });
    }
    if (body.method === 'notifications/initialized') return response.writeHead(202).end();
    if (body.method === 'tools/list') return result(response, body.id, { tools: toolNames.map(name => ({ name })) });
    assert.deepEqual(body.params, { name: 'list_toolsets', arguments: {} });
    return result(response, body.id, { content: [{ type: 'text', text: '- Editor tools' }] });
  });
  const client = new UnrealMcp(port);
  const signal = AbortSignal.timeout(5000);
  await client.connect(signal);
  assert.equal((await client.request('tools/call', { name: 'list_toolsets', arguments: {} }, signal)).content[0].text, '- Editor tools');
  await client.close(signal);
  assert.deepEqual(methods, ['initialize', 'notifications/initialized', 'tools/list', 'tools/call', 'DELETE']);
});

test('reads a matching SSE response before the stream closes', async t => {
  const port = await serverFor(t, (_request, response, body) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
    response.write(': heartbeat\r\n\r\n');
    response.write('data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n');
    response.write(`id: event-1\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } })}\n\n`);
  });
  assert.deepEqual(await new UnrealMcp(port).request('ping', {}, AbortSignal.timeout(5000)), { ok: true });
});

test('does not accept an unrelated MCP server or follow an HTTP redirect', async t => {
  const port = await serverFor(t, (_request, response, body) => {
    if (body.method === 'initialize') return result(response, body.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} } });
    if (body.method === 'notifications/initialized') return response.writeHead(202).end();
    return result(response, body.id, { tools: [{ name: 'something_else' }] });
  });
  const signal = AbortSignal.timeout(5000);
  await assert.rejects(new UnrealMcp(port).connect(signal), /does not expose/);
  let redirects = 0;
  const redirectPort = await serverFor(t, (_request, response) => {
    redirects++;
    response.writeHead(302, { Location: `http://127.0.0.1:${port}/mcp` }).end();
  });
  await assert.rejects(new UnrealMcp(redirectPort).connect(signal));
  assert.equal(redirects, 1);
});
