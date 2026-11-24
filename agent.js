import { fromHost } from './runtime.js';
const { createMcpToolDefinition } = await fromHost('@deepseek-ai/dsh-mcp-client');

export const inject = ['tools', 'unrealProjects'];

const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' };
const names = { type: 'array', items: string };
const argumentsObject = { type: 'object', additionalProperties: {} };
const text = value => [{ type: 'text', text: JSON.stringify(value) }];
const has = tool => ({ tool });
const sends = name => (client, args, signal) => client.callTool(name, args, signal);
const tools = [
  ['list_toolsets', 'List Unreal Editor toolsets in the selected project.', object({}), has('list_toolsets'), sends('list_toolsets')],
  ['describe_toolset', 'UE 5.8: get the schemas and names for one toolset.', object({ toolset_name: string }, ['toolset_name']), has('describe_toolset'), sends('describe_toolset')],
  ['describe_toolsets', 'UE 5.9: describe one or more toolsets. Set include_schemas to true for input and output schemas.',
    object({ toolset_names: names, include_schemas: { type: 'boolean' } }, ['toolset_names']), has('describe_toolsets'), sends('describe_toolsets')],
  ['describe_tools', 'UE 5.9: describe qualified Toolset.Tool names or bare top-level tool names.',
    object({ tool_names: names }, ['tool_names']), has('describe_tools'), sends('describe_tools')],
  ['call_tool', 'Call a tool discovered through Unreal Tool Search. For toolset tools, send toolset_name and the short tool_name.',
    object({ toolset_name: string, tool_name: string, arguments: argumentsObject }, ['tool_name']), has('call_tool'),
    (client, args, signal) => client.callTool('call_tool', { ...args, arguments: args.arguments ?? {} }, signal)],
  ['call_native_tool', 'Call an exact native MCP name returned by mcp__ue__list_native_tools, including when Unreal Tool Search is disabled.',
    object({ name: string, arguments: argumentsObject }, ['name']), {},
    (client, args, signal) => client.callTool(args.name, args.arguments ?? {}, signal)],
];

export function apply(ctx) {
  const projects = ctx.get('unrealProjects');
  const withClient = (exec, operation) => projects.useClient(exec.agent, exec.signal, operation);
  function registerJson(name, description, parameters, condition, run) {
    ctx.tools.register({ name, description, parameters, timeoutMs: 180_000,
      output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
      execute: (args, exec) => withClient(exec, (client, signal) => run(client, args, signal)),
    }, { when: ({ agent }) => projects.visible(agent, condition) });
  }
  ctx.tools.register({
    name: 'unreal_project_status',
    description: 'Read the current conversation’s Unreal MCP project selection and connection status. Project selection or launching an editor requires the user’s toolbar action.',
    parameters: object({}),
    output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
    async execute(_args, exec) { return projects.perform(exec.agent, { action: 'status' }, exec.signal); },
    isConcurrencySafe: () => true,
  });
  for (const [name, description, inputSchema, condition, run] of tools) {
    const definition = createMcpToolDefinition(ctx, {
      name: `mcp__ue__${name}`, rawName: name, description, inputSchema,
      call: (args, exec) => withClient(exec, async (client, signal) => {
        const result = await run(client, args, signal);
        // DSH renders content blocks, so surface structured data alongside images/text without duplicating identical JSON.
        if (result?.structuredContent !== undefined) {
          const content = Array.isArray(result.content) ? result.content : [];
          const structured = text(result.structuredContent)[0];
          if (!content.some(block => block.type === 'text' && block.text === structured.text)) {
            return { ...result, content: [...content, structured] };
          }
        }
        return result;
      }),
    });
    ctx.tools.register({ ...definition, timeoutMs: 180_000 }, { when: ({ agent }) => projects.visible(agent, condition) });
  }
  registerJson('mcp__ue__list_native_tools', 'Read the selected Unreal server’s live tools/list catalog and input schemas. Pass nextCursor back as cursor to get the next page.',
    object({ cursor: string }), {}, (client, args, signal) => client.listTools(args, signal));
  registerJson('mcp__ue__list_resources', 'List resources exposed by the selected Unreal MCP server. Follow nextCursor if present.',
    object({ cursor: string }), { capability: 'resources' }, (client, args, signal) => client.request('resources/list', args, signal));
  registerJson('mcp__ue__read_resource', 'Read a URI returned by the selected Unreal MCP server’s resource list.',
    object({ uri: string }, ['uri']), { capability: 'resources' }, (client, args, signal) => client.request('resources/read', args, signal));
}
