import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { win32 as path } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UnrealMcp } from './mcp.js';
import { fromHost } from './runtime.js';
import { newProjectPath, suggestProjectName, validDirectory, validProjectName } from './project-paths.js';

const { Remote, TypertRemoteService } = await fromHost('@deepseek-ai/dsh-typert-protocol');
const workerFile = fileURLToPath(new URL('./windows-ue.ps1', import.meta.url));
const pickerFile = fileURLToPath(new URL('./windows-picker.ps1', import.meta.url));
const run = promisify(execFile);
const fail = (error, status) => ({ ok: false, error, ...(status ? { status } : {}) });
const message = error => error instanceof Error ? error.message : String(error);
const validPort = port => Number.isInteger(port) && port > 0 && port <= 65535;
const projectPath = value => typeof value === 'string' && value.length <= 2048 &&
  /\.uproject$/i.test(value) && validDirectory(value);
const pid = value => Number.isInteger(value) && value > 0 && value <= 0x7fffffff;
const fields = {
  discover: [], status: [], disconnect: [], connect: ['path', 'pid'],
  create: ['directory', 'name', 'engineId'], open: ['path', 'engineId'], browse: ['mode', 'path'],
};
const waitLimit = 4 * 60 * 1000;
const newState = () => ({ binding: null, pending: null, client: null, locked: false, checkedAt: 0, tracked: false, timer: null });
const verifyTarget = (target, signal) => worker({ action: 'verify', path: target.path, pid: target.pid, port: target.port }, signal);

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      typeof input.sessionId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(input.sessionId) ||
      !Object.hasOwn(fields, input.action) ||
      Object.keys(input).some(key => !['sessionId', 'action', ...fields[input.action]].includes(key))) {
    throw new Error('Invalid Unreal project request.');
  }
  if ((input.action === 'connect' || input.action === 'open') && !projectPath(input.path)) throw new Error('Enter an absolute local .uproject path.');
  if (input.action === 'connect' && !pid(input.pid)) throw new Error('Select a detected Unreal Editor process.');
  if (input.action === 'create' && !validProjectName(input.name)) throw new Error('Use 1–20 letters, digits, or underscores, starting with a letter. Reserved platform names are not accepted.');
  if (input.action === 'create' && input.directory !== undefined && !validDirectory(input.directory)) throw new Error('Enter an absolute local folder path.');
  if (input.action === 'browse' && (!['project', 'directory'].includes(input.mode) || (input.path !== undefined && !(input.mode === 'project' ? projectPath(input.path) : validDirectory(input.path))))) throw new Error('Invalid Unreal project picker request.');
  if (input.engineId !== undefined && (typeof input.engineId !== 'string' || input.engineId.length > 128)) throw new Error('Invalid Unreal Engine selection.');
}

async function worker(input, signal, picker = false) {
  if (process.platform !== 'win32') throw new Error('Unreal project discovery and launch are currently supported on Windows.');
  const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = await run(exe, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass',
    picker ? '-STA' : '-NonInteractive', '-File', picker ? pickerFile : workerFile], {
    windowsHide: true, timeout: picker ? 290_000 : 20_000, signal, maxBuffer: 1024 * 1024,
    env: { ...process.env, DSH_UNREAL_REQUEST: JSON.stringify(input) },
  });
  return JSON.parse(stdout.replace(/^\uFEFF/, ''));
}

class UnrealProjects extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'unrealProjects');
    markAction.call(this);
    this.state = new WeakMap();
    this.preparing = false;
    this.lifetime = new AbortController();
    ctx.effect(() => () => this.lifetime.abort());
    ctx.on('agent/disposed', ({ agent }) => {
      const state = this.state.get(agent);
      if (state) this.reset(state);
      this.state.delete(agent);
    });
  }

  async action(input, signal) {
    if (this.ctx.invocation?.peer.principal.kind !== 'owner') return fail('Only the local DeepSeek Harness owner can select an Unreal project.');
    try {
      validate(input);
      const agent = this.ctx.agents.get(input.sessionId);
      if (!agent || this.ctx.agentPresets.presetForSession(agent.session) !== 'unreal') return fail('Open a session in Unreal mode first.');
      if (!this.ctx.tools.get('unreal_project_status', agent)) return fail('This session uses an older Unreal preset. Start a new Unreal session to select a project safely.');
      signal?.throwIfAborted();
      // Once accepted, an editor launch belongs to this Host and session, not to the
      // current browser view. Navigation may cancel the reply, not the launch.
      const launches = ['open', 'create', 'connect'].includes(input.action);
      return await this.perform(agent, input, launches ? this.lifetime.signal : signal);
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      return fail(message(error));
    }
  }

  sessionState(agent) {
    let state = this.state.get(agent);
    if (!state) {
      state = newState();
      this.state.set(agent, state);
    }
    return state;
  }
  view(state) {
    const pending = state.pending;
    return { ok: true, binding: state.binding, pending: pending ? {
      path: pending.path, pid: pending.pid, name: pending.name, port: pending.port ?? null,
      status: pending.status, ...(pending.error ? { error: pending.error } : {}),
    } : null };
  }

  async perform(agent, input, signal) {
    signal = AbortSignal.any([signal ?? this.lifetime.signal, this.lifetime.signal]);
    const state = this.sessionState(agent);
    if (input.action === 'status') {
      if (state.binding && Date.now() - state.checkedAt > 12_000) {
        const target = state.binding;
        const verified = await verifyTarget(target, signal);
        if (state.binding === target) {
          state.checkedAt = Date.now();
          if (!verified.ok) this.lost(agent, state, target, verified);
        }
      }
      this.schedule(agent, state);
      return this.view(state);
    }
    if (input.action === 'discover') {
      const facts = await worker({ action: 'discover' }, signal);
      if (!facts.ok) return facts;
      this.schedule(agent, state);
      const workspace = this.ctx.workingDirectory.get(agent.session);
      const defaultName = validDirectory(workspace) ? await suggestProjectName(workspace).catch(() => undefined) : undefined;
      return { ...facts, ...this.view(state), workspace, ...(defaultName ? { defaultName } : {}) };
    }
    if (input.action === 'browse') {
      if (this.browsing) return fail('A native Unreal path picker is already open.');
      const workspace = this.ctx.workingDirectory.get(agent.session);
      const start = input.path && input.mode === 'project' ? path.dirname(input.path) : input.path ?? workspace;
      this.browsing = true;
      try {
        const result = await worker({ mode: input.mode, directory: validDirectory(start) ? path.normalize(start) : '' }, signal, true);
        if (!result.ok || result.path === null) return result;
        const directory = input.mode === 'directory';
        if (!(directory ? validDirectory(result.path) : projectPath(result.path))) return fail('Choose a local Windows path.');
        const defaultName = directory ? await suggestProjectName(result.path).catch(() => undefined) : undefined;
        return { ...result, ...(defaultName ? { defaultName } : {}) };
      } finally { this.browsing = false; }
    }
    if (agent.status !== 'idle') return fail('Wait for this conversation to finish before changing its Unreal project.');
    if (state.locked) return fail('Another Unreal project action is already in progress for this conversation.');
    if (input.action === 'disconnect') {
      this.reset(state);
      return this.view(state);
    }
    state.locked = true;
    try {
      const create = input.action === 'create';
      // The destination is chosen by the owner through the native picker or its editable field.
      const workspace = create ? input.directory ?? this.ctx.workingDirectory.get(agent.session) : undefined;
      const target = create ? newProjectPath(workspace, input.name) : path.normalize(input.path);
      // Serialize host launch requests so one worker does not start a duplicate editor.
      if (this.preparing) return fail('Another Unreal editor is being prepared. Try again in a few seconds.');
      this.preparing = true;
      let result;
      try {
        result = await worker({ action: 'prepare', path: target, ...(input.action === 'connect' ? { pid: input.pid } : {}),
          ...(input.engineId ? { engineId: input.engineId } : {}), create,
          ...(create ? { workspace: path.normalize(workspace) } : {}) }, signal);
      } finally { this.preparing = false; }
      signal.throwIfAborted();
      if (!result.ok && !['manual_start_required', 'restart_required'].includes(result.status)) return result;
      if (this.ctx.agents.get(agent.id) !== agent || this.ctx.agentPresets.presetForSession(agent.session) !== 'unreal' || agent.status !== 'idle') {
        return fail('The conversation changed while preparing the project. No tool target was changed.');
      }
      this.reset(state);
      const project = result.project;
      state.pending = { path: project.path, pid: project.pid, name: project.name, port: result.port,
        candidates: [...new Set([result.port, ...(project.ports ?? [])].filter(validPort))].slice(0, 12),
        status: result.status === 'ready' ? 'starting' : result.status, error: result.error,
        canSuggestManual: result.status === 'ready', expires: Date.now() + waitLimit };
    } finally { state.locked = false; }
    this.schedule(agent, state);
    return this.view(state);
  }

  reset(state) {
    clearTimeout(state.timer);
    state.timer = null;
    const old = state.binding;
    const client = state.client;
    state.binding = state.pending = state.client = null;
    if (old && client) {
      const signal = AbortSignal.timeout(4000);
      void verifyTarget(old, signal).then(result => {
        if (result.ok) return client.close(signal);
      }).catch(() => {});
    }
  }

  lost(agent, state, target, result) {
    this.reset(state);
    state.pending = { ...target, candidates: [target.port], expires: Date.now() + waitLimit,
      status: result.status === 'identity_mismatch' ? 'failed' : 'starting', error: result.error };
    this.schedule(agent, state);
  }

  schedule(agent, state) {
    if (state.tracked || state.timer || state.locked || !state.pending || !['starting', 'manual_start_required'].includes(state.pending.status)) return;
    state.tracked = true;
    const intent = state.pending;
    void (async () => {
      if (Date.now() > intent.expires) {
        intent.status = 'failed';
        intent.error = 'Unreal MCP did not become ready. If Unreal is still starting, wait for its window and select the project again.';
        return;
      }
      const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(24_000)]);
      let invalid = 0;
      let diagnostic;
      for (const port of [...intent.candidates]) {
        if (state.pending !== intent || this.ctx.agents.get(agent.id) !== agent) return;
        let verified;
        try { verified = await worker({ action: 'verify', path: intent.path, pid: intent.pid, port }, signal); }
        catch (error) { diagnostic = message(error); break; }
        for (const candidate of verified.project?.ports ?? []) {
          if (validPort(candidate) && !intent.candidates.includes(candidate) && intent.candidates.length < 12) intent.candidates.push(candidate);
        }
        if (!verified.ok) {
          diagnostic = verified.error;
          if (verified.status === 'identity_mismatch') break;
          continue;
        }
        const client = new UnrealMcp(port);
        const attempt = AbortSignal.any([signal, AbortSignal.timeout(1800)]);
        try {
          await client.connect(attempt);
          if (state.pending !== intent || this.ctx.agents.get(agent.id) !== agent || this.ctx.agentPresets.presetForSession(agent.session) !== 'unreal') {
            await client.close(attempt).catch(() => {});
            return;
          }
          state.client = client;
          state.binding = { path: intent.path, pid: intent.pid, name: intent.name, port };
          state.checkedAt = Date.now();
          state.pending = null;
          return;
        } catch (error) {
          ++invalid;
          diagnostic = message(error);
          void client.close(attempt).catch(() => {});
        }
      }
      if (invalid && intent.canSuggestManual && state.pending === intent) {
        // A listener owned by UE can still be Remote Control or another plugin.
        const prepared = await worker({ action: 'prepare', path: intent.path, pid: intent.pid, skipPorts: intent.candidates }, signal);
        if (state.pending !== intent) return;
        if (prepared.status === 'manual_start_required' && validPort(prepared.port)) {
          intent.port = prepared.port;
          intent.candidates = [prepared.port];
          intent.status = prepared.status;
          intent.error = prepared.error;
        } else if (prepared.status === 'restart_required') {
          intent.status = prepared.status;
          intent.error = prepared.error;
        } else if (diagnostic) { intent.error = diagnostic; }
        intent.canSuggestManual = false;
      }
    })().catch(error => {
      if (state.pending === intent && !this.lifetime.signal.aborted) intent.error = message(error);
    }).finally(() => {
      state.tracked = false;
      if (this.lifetime.signal.aborted || this.ctx.agents.get(agent.id) !== agent || !state.pending || !['starting', 'manual_start_required'].includes(state.pending.status)) return;
      state.timer = setTimeout(() => {
        state.timer = null;
        if (!this.lifetime.signal.aborted) this.schedule(agent, state);
      }, 2000);
      state.timer.unref?.();
    });
  }

  visible(agent) { return !!agent && !!this.state.get(agent)?.binding; }

  async callTool(agent, method, args, signal) {
    const state = agent && this.state.get(agent);
    const target = state?.binding;
    const client = state?.client;
    if (!target || !client) throw new Error('Select and connect an Unreal project in the conversation toolbar first.');
    signal = AbortSignal.any([signal, this.lifetime.signal]);
    const verified = await worker({ action: 'verify', path: target.path, pid: target.pid, port: target.port }, signal);
    if (state.binding !== target) throw new Error('The selected Unreal project changed. Reinspect it before using tools again.');
    if (!verified.ok) {
      this.lost(agent, state, target, verified);
      throw new Error(verified.error);
    }
    try { return await client.request('tools/call', { name: method, arguments: args }, signal); }
    catch (error) {
      // Never replay an edit after a failure: it may already have run in Unreal.
      if (state.binding === target && /returned HTTP (400|404)\b/.test(message(error))) {
        this.lost(agent, state, target, { error: 'The Unreal MCP session expired; reconnecting.' });
      }
      throw error;
    }
  }
}

// Native decorator initializers without a transpiler; mirrors the installed source-mode Remote API.
let markAction;
Remote(UnrealProjects.prototype.action, { kind: 'method', name: 'action', static: false, private: false, addInitializer: fn => { markAction = fn; } });

export const inject = ['agents', 'agentPresets', 'workingDirectory', 'tools'];
export function apply(ctx) { new UnrealProjects(ctx); }
