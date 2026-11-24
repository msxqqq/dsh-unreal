import { fromHost } from './runtime.js';
const { createMcpToolDefinition } = await fromHost('@deepseek-ai/dsh-mcp-client');

export const inject = ['tools', 'unrealProjects'];

const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' };
const tools = [
  ['list_toolsets', 'List Unreal Editor toolsets in the selected project.', object({})],
  ['describe_toolset', 'Get exact names and input/output schemas for one Unreal toolset.', object({ toolset_name: string }, ['toolset_name'])],
  ['call_tool', 'Run an Unreal Editor tool from a discovered toolset. Use the short name as tool_name.',
    object({ toolset_name: string, tool_name: string, arguments: { type: 'object', additionalProperties: {} } }, ['tool_name', 'arguments'])],
];

export function apply(ctx) {
  const projects = ctx.get('unrealProjects');
  ctx.tools.register({
    name: 'unreal_project_status',
    description: 'Read the current conversation’s Unreal MCP project selection and connection status. Project selection or launching an editor requires the user’s toolbar action.',
    parameters: object({}),
    output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(_args, exec) { return projects.perform(exec.agent, { action: 'status' }, exec.signal); },
    isConcurrencySafe: () => true,
  });
  for (const [name, description, inputSchema] of tools) {
    const definition = createMcpToolDefinition(ctx, {
      name: `mcp__ue__${name}`, rawName: name, description, inputSchema,
      call: (args, exec) => projects.callTool(exec.agent, name, args, exec.signal),
    });
    ctx.tools.register({ ...definition, timeoutMs: 180_000 }, { when: ({ agent }) => projects.visible(agent) });
  }
}
