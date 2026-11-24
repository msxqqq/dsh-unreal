import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { UnrealMcp, toolNames, modernToolNames } from './mcp.js';

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

const project = { path: 'D:\\Projects\\Game.uproject', pid: 42, supportedEngine: true };
const instanceKey = 'com.epicgames.unrealengine/instance';

for (const version of ['5.8', '5.9']) {
  for (const search of [true, false]) {
    test(`UE ${version} ${search ? 'Tool Search' : 'native'} catalog, calls and resources`, async t => {
      const modern = version === '5.9';
      const names = search ? (modern ? modernToolNames : toolNames) : ['Editor.Tools.Get Info', 'Editor.Custom'];
      const port = await serverFor(t, (request, response, body) => {
        if (body.method === 'initialize') {
          response.setHeader('Mcp-Session-Id', 'ue-editor');
          return result(response, body.id, {
            protocolVersion: modern ? '2025-11-25' : '2025-06-18',
            capabilities: { tools: { listChanged: true }, resources: {} },
            serverInfo: { name: modern ? 'unreal-mcp' : '' },
            ...(modern ? { _meta: { [instanceKey]: { processId: 42, projectFile: 'd:/Projects/Game.uproject' } } } : {}),
          });
        }
        assert.equal(request.headers['mcp-session-id'], 'ue-editor');
        assert.equal(request.headers['mcp-protocol-version'], modern ? '2025-11-25' : '2025-06-18');
        if (body.method === 'notifications/initialized') return response.writeHead(202).end();
        if (body.method === 'tools/list') {
          const isSecondPage = body.params.cursor === 'page2';
          return result(response, body.id, {
            tools: (isSecondPage ? names.slice(1) : names.slice(0, 1)).map(name => ({ name, inputSchema: { type: 'object' } })),
            ...(!isSecondPage && { nextCursor: 'page2' }),
          });
        }
        if (body.method === 'resources/list') return result(response, body.id, { resources: [{ uri: 'ue://project' }] });
        if (body.method === 'resources/read') return result(response, body.id, { contents: [{ uri: body.params.uri, text: 'project' }] });
        assert.equal(body.method, 'tools/call');
        assert.ok(names.includes(body.params.name));
        const outputs = {
          describe_toolset: { name: 'Editor', tools: [] },
          describe_toolsets: { toolsets: { Editor: { tools: [] } }, errors: { Missing: 'Unknown toolset' } },
          describe_tools: { tools: { 'Editor.Get': {} }, errors: {} },
        };
        if (body.params.name === 'describe_toolsets') assert.deepEqual(body.params.arguments, { toolset_names: ['Editor', 'Missing'], include_schemas: true });
        if (body.params.name === 'describe_tools') assert.deepEqual(body.params.arguments, { tool_names: ['Editor.Get'] });
        return result(response, body.id, outputs[body.params.name] ? { content: [{ type: 'text', text: JSON.stringify(outputs[body.params.name]) }] }
          : { content: [], structuredContent: { value: 42 } });
      });
      const signal = AbortSignal.timeout(5000);
      const client = new UnrealMcp(port);
      await client.connect(signal, project);
      for (const name of names) assert.ok(client.hasTool(name));
      assert.equal((await client.listTools({}, signal)).nextCursor, 'page2');
      assert.ok(client.hasTool(names.at(-1)), 'listing a page must not shrink the catalog');
      assert.equal(client.hasTool('describe_tools'), modern && search);
      if (modern && search) {
        const sets = await client.callTool('describe_toolsets', { toolset_names: ['Editor', 'Missing'], include_schemas: true }, signal);
        assert.equal(JSON.parse(sets.content[0].text).errors.Missing, 'Unknown toolset');
        const tools = await client.callTool('describe_tools', { tool_names: ['Editor.Get'] }, signal);
        assert.deepEqual(JSON.parse(tools.content[0].text).tools, { 'Editor.Get': {} });
      } else if (search) {
        const res = await client.callTool('describe_toolset', { toolset_name: 'Editor' }, signal);
        assert.equal(JSON.parse(res.content[0].text).name, 'Editor');
      }
      const raw = await client.callTool(search ? 'call_tool' : names[1], search ? { tool_name: 'Get', toolset_name: 'Editor', arguments: {} } : {}, signal);
      assert.deepEqual(raw.structuredContent, { value: 42 });
      const catalog = await client.request('resources/list', {}, signal);
      assert.equal((await client.request('resources/read', catalog.resources[0], signal)).contents[0].text, 'project');
    });
  }
}

test('sends a cancellation notification with the original tool request ID', async t => {
  const controller = new AbortController();
  let requestId;
  let cancel;
  const received = new Promise(resolve => { cancel = resolve; });
  const port = await serverFor(t, (_request, response, body) => {
    if (body.method === 'initialize') {
      response.setHeader('Mcp-Session-Id', 'cancel-session');
      return result(response, body.id, { protocolVersion: '2025-11-25', capabilities: { tools: {} } });
    }
    if (body.method === 'notifications/initialized') return response.writeHead(202).end();
    if (body.method === 'tools/list') return result(response, body.id, { tools: toolNames.map(name => ({ name })) });
    if (body.method === 'notifications/cancelled') {
      cancel(body.params.requestId);
      return response.writeHead(202).end();
    }
    requestId = body.id;
    controller.abort();
  });
  const client = new UnrealMcp(port);
  await client.connect(AbortSignal.timeout(5000));
  await assert.rejects(client.callTool('call_tool', { tool_name: 'Example' }, controller.signal), { name: 'AbortError' });
  const signal = AbortSignal.timeout(2500);
  assert.equal(await Promise.race([received, new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  })]), requestId);
});

test('supports a custom MCP path without allowing a URL or traversal', async t => {
  const port = await serverFor(t, (request, response, body) => {
    assert.equal(request.url, '/unreal/custom-mcp');
    result(response, body.id, {});
  });
  await new UnrealMcp(port, '/unreal/custom-mcp').request('ping', {}, AbortSignal.timeout(5000));
  for (const value of ['https://elsewhere/mcp', '//elsewhere/mcp', '/a/%2e%2e/mcp', '/mcp?redirect=1']) {
    assert.throws(() => new UnrealMcp(port, value), /Invalid Unreal MCP endpoint path/);
  }
});

test('rejects UE 5.9 claimed process or project mismatches before dispatching tools', async t => {
  const port = await serverFor(t, (_request, response, body) => {
    assert.equal(body.method, 'initialize');
    return result(response, body.id, { protocolVersion: '2025-11-25', capabilities: { tools: {} },
      _meta: { [instanceKey]: { processId: 42, projectFile: project.path } } });
  });
  const signal = AbortSignal.timeout(5000);
  await assert.rejects(new UnrealMcp(port).connect(signal, { ...project, pid: 70 }), /different editor process/);
  await assert.rejects(new UnrealMcp(port).connect(signal, { ...project, path: 'D:\\Other\\Other.uproject' }), /different project file/);
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
