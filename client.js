window.__ModuleLoader__.load({
  id: '@local/dsh-unreal-mcp-preset',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useId, useRef, useState } = React;
    const ns = 'unreal.projects';
    const dictionaries = {
      en: {
        title: 'Unreal Projects', connected: 'Connected', disconnected: 'Not connected',
        toolbarVisible: 'Unreal Projects · {name}',
        working: 'Working…', checking: 'Checking connection…', toolbarChecking: 'Checking…', refresh: 'Refresh', close: 'Close',
        running: 'Running editors', noneRunning: 'No running Unreal editors with a project were found.',
        loading: 'Looking for Unreal Editor instances and installations…',
        connect: 'Connect', connectTo: 'Connect to {name} (PID {pid})', disconnect: 'Disconnect',
        pid: 'PID {pid}', port: 'Port {port}', ports: 'Ports: {ports}',
        starting: 'Waiting for Unreal Editor and its MCP server…',
        manual_start_required: 'The MCP server needs to be started in Unreal Editor.',
        manualCommand: 'Run this command in the Unreal Editor Output Log command box. Harness will keep checking for the connection.',
        manualNoPort: 'Check the Model Context Protocol settings in Unreal Editor. Harness will keep checking for the connection.',
        restart_required: 'This editor cannot connect as it is running now. Save your work and close it, then try opening the project with an Unreal Engine installation that supports the MCP plugin. Harness will not restart the editor for you.',
        failed: 'Could not connect to Unreal Editor.',
        unavailable: 'Project service unavailable',
        unavailableHelp: 'Use the local Harness desktop session and try Refresh.',
        actionFailed: 'The Unreal project action failed.',
        switchHelp: 'Disconnect this session before choosing a different project. Disconnecting does not close Unreal Editor.',
        engine: 'Unreal Engine installation', engineAuto: 'Automatic', noEngines: 'No compatible Unreal Engine installation was detected. You can still connect to a running editor.',
        browse: 'Browse…', browseProject: 'Browse for a .uproject file', browseDirectory: 'Browse for a project folder',
        browsing: 'Waiting for the Windows file picker…', browseFailed: 'Could not use the Windows file picker.',
        openTitle: 'Open an existing project', openHelp: 'Enter the full path or browse for a .uproject file. This will not restart any running editor.',
        path: 'Project path', open: 'Open project', invalidPath: 'Enter a local Windows drive path ending in .uproject, such as C:\\Projects\\Game.uproject.',
        createTitle: 'Create a project', createHelp: 'Creates a blank project inside the chosen folder, opens it in Unreal Editor, and tries to connect to its MCP server.',
        directory: 'Parent folder', invalidDirectory: 'Enter an absolute local Windows drive path, such as C:\\Projects. Network paths are not supported.',
        createLocation: 'Will create: {path}', defaultName: 'UntitledProject_01',
        name: 'Project name', create: 'Create project', invalidName: 'Use 1–20 characters: start with a letter, then use only letters, decimal digits, and underscores. Use only characters in the Unicode Basic Multilingual Plane.',
        reservedName: 'That project name is reserved. Choose a different name.',
        cancelConnection: 'Cancel connection', launchInProgress: 'Close this dialog to continue working while Harness checks the connection.',
        toolbar: 'Unreal Projects: {state}', toolbarProject: 'Unreal Projects: {state} — {name}',
      },
      zh: {
        title: 'Unreal 工程', connected: '已连接', disconnected: '未连接',
        toolbarVisible: 'Unreal 工程 · {name}',
        working: '正在处理…', checking: '正在检查连接…', toolbarChecking: '确认中…', refresh: '刷新', close: '关闭',
        running: '正在运行的编辑器', noneRunning: '没有找到已打开工程的 Unreal 编辑器。',
        loading: '正在查找 Unreal 编辑器和引擎安装…',
        connect: '连接', connectTo: '连接到 {name}（PID {pid}）', disconnect: '断开连接',
        pid: '进程 ID：{pid}', port: '端口：{port}', ports: '端口：{ports}',
        starting: '正在等待 Unreal 编辑器及其 MCP 服务启动…',
        manual_start_required: '需要在 Unreal 编辑器中手动启动 MCP 服务。',
        manualCommand: '请在 Unreal 编辑器的 Output Log（输出日志）命令栏运行此命令。Harness 会继续检查连接。',
        manualNoPort: '请检查 Unreal 编辑器中的 Model Context Protocol 设置。Harness 会继续检查连接。',
        restart_required: '当前运行的编辑器无法连接。请保存工作并关闭该编辑器，再尝试使用支持 MCP 插件的 Unreal 引擎打开工程。Harness 不会自动重启编辑器。',
        failed: '无法连接到 Unreal 编辑器。',
        unavailable: '无法访问工程服务',
        unavailableHelp: '请使用本机 Harness 桌面会话，然后点击刷新重试。',
        actionFailed: 'Unreal 工程操作失败。',
        switchHelp: '要选择其他工程，请先断开此会话的连接。断开连接不会关闭 Unreal 编辑器。',
        engine: 'Unreal 引擎版本', engineAuto: '自动选择', noEngines: '未检测到兼容的 Unreal 引擎。你仍然可以连接正在运行的编辑器。',
        browse: '浏览…', browseProject: '浏览并选择 .uproject 文件', browseDirectory: '浏览并选择工程文件夹',
        browsing: '正在等待 Windows 选择窗口…', browseFailed: '无法使用 Windows 选择窗口。',
        openTitle: '打开已有工程', openHelp: '输入 .uproject 文件的完整路径，或点击「浏览…」选择。不会重启正在运行的编辑器。',
        path: '工程路径', open: '打开工程', invalidPath: '请输入以 .uproject 结尾的本机 Windows 路径，例如 C:\\Projects\\Game.uproject。',
        createTitle: '创建工程', createHelp: '在所选文件夹中创建空白工程，用 Unreal 编辑器打开并尝试连接 MCP 服务。',
        directory: '上级文件夹', invalidDirectory: '请输入本机 Windows 盘符开头的绝对路径，例如 C:\\Projects。不支持网络路径。',
        createLocation: '将创建：{path}', defaultName: '未命名工程_01',
        name: '工程名称', create: '创建工程', invalidName: '名称须为 1–20 个字符，以汉字或其他字母开头，其余字符只能是汉字、字母、十进制数字或下划线。仅支持 Unicode 基本多文种平面内的字符。',
        reservedName: '这是保留名称，请使用其他工程名称。',
        cancelConnection: '取消连接', launchInProgress: '可以关闭此窗口继续工作，Harness 会在后台检查连接。',
        toolbar: 'Unreal 工程：{state}', toolbarProject: 'Unreal 工程：{state} — {name}',
      },
    };

    const styles = `
      .dsh-unreal-tool, .dsh-unreal-modal button {
        box-sizing: border-box; font: inherit; color: inherit; cursor: pointer;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px;
        background: transparent; white-space: nowrap;
      }
      .dsh-unreal-tool {
        display: inline-flex; align-items: center; gap: 5px; min-height: 26px;
        max-width: 100%; padding: 0 7px; border-color: transparent;
        color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.25;
      }
      .dsh-unreal-tool-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .dsh-unreal-tool:hover, .dsh-unreal-modal button:enabled:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dsh-unreal-tool:focus-visible, .dsh-unreal-modal :focus-visible {
        outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px;
      }
      .dsh-unreal-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; corner-shape: round; background: var(--dsw-alias-state-idle-primary); }
      .dsh-unreal-dot[data-state='connected'] { background: var(--dsw-alias-state-success-primary); }
      .dsh-unreal-dot[data-state='starting'], .dsh-unreal-dot[data-state='working'] { background: var(--dsw-alias-state-business-primary); }
      .dsh-unreal-dot[data-state='manual_start_required'], .dsh-unreal-dot[data-state='restart_required'] { background: var(--dsw-alias-state-warn-primary); }
      .dsh-unreal-dot[data-state='failed'], .dsh-unreal-dot[data-state='unavailable'] { background: var(--dsw-alias-state-error-primary); }
      .dsh-unreal-modal {
        box-sizing: border-box; width: min(560px, calc(100vw - 24px)); max-height: calc(100dvh - 24px);
        margin: auto; padding: 0; overflow: auto; border-radius: 14px;
        border: 1px solid var(--dsw-alias-border-l2);
        color: var(--dsw-alias-label-primary); background: var(--dsw-alias-button-elevated-fill, Canvas);
        font: inherit; font-size: 13px; line-height: 1.5; user-select: text;
        box-shadow: 0 12px 36px var(--dsw-alias-bg-mask-2);
      }
      .dsh-unreal-modal::backdrop { background: var(--dsw-alias-bg-mask-3); }
      .dsh-unreal-modal h2, .dsh-unreal-modal h3, .dsh-unreal-modal p { margin: 0; }
      .dsh-unreal-modal h2 { font-size: 16px; }
      .dsh-unreal-modal h3, .dsh-unreal-modal summary { font-weight: 600; font-size: 13px; }
      .dsh-unreal-modal summary { cursor: pointer; }
      .dsh-unreal-modal button { min-height: 30px; padding: 3px 9px; }
      .dsh-unreal-modal button:disabled { opacity: .55; cursor: default; }
      .dsh-unreal-modal button.dsh-unreal-primary:enabled {
        color: var(--dsw-alias-label-primary-inverted);
        background: var(--dsw-alias-button-primary-fill); border-color: transparent;
      }
      .dsh-unreal-modal button.dsh-unreal-primary:enabled:hover { background: var(--dsw-alias-button-primary-hover); }
      .dsh-unreal-modal input, .dsh-unreal-modal select {
        box-sizing: border-box; display: block; width: 100%; padding: 5px 8px; margin-top: 4px;
        background: var(--dsw-alias-button-elevated-fill, Canvas); color: var(--dsw-alias-label-primary);
        border: 1px solid var(--dsw-alias-border-l3); border-radius: 6px; font: inherit;
      }
      @media (pointer: coarse) { .dsh-unreal-modal input, .dsh-unreal-modal select { font-size: 16px; } }
      .dsh-unreal-modal .dsh-unreal-bar, .dsh-unreal-modal li, .dsh-unreal-modal .dsh-unreal-status {
        display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
      }
      .dsh-unreal-modal .dsh-unreal-bar { padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
      .dsh-unreal-modal article, .dsh-unreal-modal form { display: grid; gap: 12px; }
      .dsh-unreal-modal article { padding: 14px 16px 16px; }
      .dsh-unreal-modal form { margin-top: 8px; }
      .dsh-unreal-modal form button { justify-self: start; }
      .dsh-unreal-modal .dsh-unreal-path-field { display: flex; align-items: end; gap: 8px; }
      .dsh-unreal-path-field label { flex: 1; min-width: 0; }
      .dsh-unreal-path-field button { flex: 0 0 auto; }
      .dsh-unreal-modal details { padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l2); }
      .dsh-unreal-modal ul { display: grid; gap: 6px; margin: 6px 0 0; padding: 0; list-style: none; }
      .dsh-unreal-modal li, .dsh-unreal-modal .dsh-unreal-status {
        padding: 8px; border-radius: 8px; background: var(--dsw-alias-card-fill);
      }
      .dsh-unreal-modal .dsh-unreal-meta { color: var(--dsw-alias-label-secondary); }
      .dsh-unreal-modal .dsh-unreal-detail { flex: 1 1 215px; min-width: 0; }
      .dsh-unreal-modal .dsh-unreal-problem { color: var(--dsw-alias-state-error-primary); }
      .dsh-unreal-modal .dsh-unreal-meta, .dsh-unreal-modal code, .dsh-unreal-modal strong,
      .dsh-unreal-modal .dsh-unreal-problem { overflow-wrap: anywhere; white-space: normal; }
      .dsh-unreal-modal code { user-select: all; }
    `;

    function errorText(value) {
      const message = typeof value === 'string' ? value : value?.message;
      return typeof message === 'string' ? message.replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 400) : '';
    }

    async function request(connection, sessionId, action, fields, signal) {
      // The Host owns authentication, path validation, process selection, and all launching.
      try {
        const result = await connection.rpc.call('/api', 'unrealProjects/action', {
          args: { input: { sessionId, action, ...fields } },
        }, AbortSignal.any([signal, AbortSignal.timeout(action === 'browse' ? 5 * 60 * 1000 : 25_000)]));
        if (result?.ok && typeof result.value?.ok === 'boolean') return result.value;
      } catch {
        // The caller checks its own signal before displaying a result.
      }
      return { ok: false, unavailable: true };
    }

    const waiting = (pending) => pending?.status === 'starting' || pending?.status === 'manual_start_required';

    function useProjects(connection, sessionId, statusCache, generation) {
      // A Session outlet can unmount during navigation without disconnecting its editor.
      const [projectState, setProjectState] = useState(() => statusCache.get(sessionId) ?? null);
      const [discovery, setDiscovery] = useState(null);
      const [problem, setProblem] = useState(null);
      const [statusLoaded, setStatusLoaded] = useState(false);
      const [operation, setOperation] = useState('');
      const binding = projectState?.binding ?? null;
      const pending = projectState?.pending ?? null;
      const [pollCount, setPollCount] = useState(0);
      const statusRequest = useRef(null);
      const activeAction = useRef(null);

      function accept(value) {
        if (!Object.hasOwn(value, 'binding') || !Object.hasOwn(value, 'pending')) return false;
        const snapshot = { binding: value.binding, pending: value.pending };
        statusCache.delete(sessionId);
        statusCache.set(sessionId, snapshot);
        if (statusCache.size > 128) statusCache.delete(statusCache.keys().next().value);
        setProjectState(snapshot);
        return true;
      }

      useEffect(() => () => activeAction.current?.controller.abort(), []);
      useEffect(() => {
        const monitoring = waiting(pending) || Boolean(binding) || !projectState || problem?.fromStatus === true;
        if (!generation || operation || (statusLoaded && !monitoring)) return;
        const controller = new AbortController();
        statusRequest.current = controller;
        const timer = setTimeout(async () => {
          const value = await request(connection, sessionId, 'status', {}, controller.signal);
          if (controller.signal.aborted || connection.generation.getSnapshot() !== generation) return;
          if (value.ok && accept(value)) {
            setProblem(current => current?.fromStatus ? null : current);
          } else {
            setProblem(current => current && !current.fromStatus ? current : { ...value, fromStatus: true });
          }
          setStatusLoaded(true);
          setPollCount((count) => count + 1);
        }, !statusLoaded ? 0 : waiting(pending) ? 2000 : 5000);
        return () => {
          clearTimeout(timer);
          controller.abort();
          if (statusRequest.current === controller) statusRequest.current = null;
        };
      }, [connection, sessionId, statusCache, generation, operation, statusLoaded, pending?.status, binding?.path, pollCount]);

      async function run(action, fields = {}) {
        if (!generation || activeAction.current) return;
        const controller = new AbortController();
        activeAction.current = { action, controller };
        statusRequest.current?.abort();
        setOperation(action);
        setProblem(null);
        try {
          const value = await request(connection, sessionId, action, fields, controller.signal);
          if (controller.signal.aborted || connection.generation.getSnapshot() !== generation) return;
          if (value.ok) {
            if (action !== 'browse') {
              const hasStatus = accept(value);
              if (action === 'discover') setDiscovery(value);
              setStatusLoaded(action !== 'discover' && hasStatus);
            }
          } else {
            setProblem({ ...value, action });
            // A mutation can leave recoverable state even if the call failed. Read it without retrying the mutation.
            if (action !== 'discover' && action !== 'browse') setStatusLoaded(false);
          }
          if (value.ok) return value;
        } finally {
          if (activeAction.current?.controller === controller) activeAction.current = null;
          if (!controller.signal.aborted) setOperation('');
        }
      }
      function cancelBrowse() {
        if (activeAction.current?.action !== 'browse') return;
        activeAction.current.controller.abort();
        activeAction.current = null;
        setOperation('');
      }
      return { binding, pending, statusKnown: projectState !== null, discovery, problem, operation, run, cancelBrowse };
    }

    function validLocalDirectory(value) {
      if (value.length > 2048 || !/^[A-Za-z]:[\\/]/.test(value)) return false;
      const rest = value.slice(2);
      return !/[:"<>|?*\x00-\x1f\x7f]/.test(rest) && rest.split(/[\\/]/).every(part =>
        !part || (!/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i.test(part.split('.')[0].trimEnd())));
    }

    function validLocalProject(value) {
      return validLocalDirectory(value) && /\.uproject$/i.test(value);
    }

    function projectNameError(name) {
      if (name.length > 20 || /[\uD800-\uDFFF]/.test(name) || !/^[\p{L}][\p{L}\p{Nd}_]{0,19}$/u.test(name)) return 'invalidName';
      if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|win64|windows|linux|mac|android|ios)$/i.test(name)) return 'reservedName';
      return '';
    }

    function createPath(directory, name) {
      return [directory.replace(/[\\/]+/g, '\\').replace(/\\$/, ''), name, `${name}.uproject`].join('\\');
    }

    function isPort(value) { return Number.isInteger(value) && value > 0 && value <= 65535; }
    function projectName(project) { return project.name || project.path?.split(/[\\/]/).pop() || ''; }

    function Projects({ connection, sessionId, statusCache, generation, t }) {
      const dialog = useRef(null);
      const close = useRef(null);
      const titleId = useId();
      const [dialogOpen, setDialogOpen] = useState(false);
      const [path, setPath] = useState('');
      const [directoryOverride, setDirectoryOverride] = useState(null);
      const [browsedDefault, setBrowsedDefault] = useState(null);
      const [nameOverride, setNameOverride] = useState(null);
      const [openEngine, setOpenEngine] = useState('');
      const [createEngine, setCreateEngine] = useState('');
      const pathErrorId = `${titleId}-path-error`;
      const directoryErrorId = `${titleId}-directory-error`;
      const nameErrorId = `${titleId}-name-error`;
      const [invalid, setInvalid] = useState('');
      const { binding, pending, statusKnown, discovery, problem, operation, run, cancelBrowse } = useProjects(connection, sessionId, statusCache, generation);
      const projects = Array.isArray(discovery?.projects) ? discovery.projects : [];
      const engines = Array.isArray(discovery?.engines) ? discovery.engines : [];
      const workspace = typeof discovery?.workspace === 'string' ? discovery.workspace : '';
      const directory = directoryOverride ?? (validLocalDirectory(workspace) ? workspace : '');
      // null means follow suggestions; even an empty value the user typed is an override.
      const defaultName = browsedDefault ?? (directory === workspace ? discovery?.defaultName : null);
      const name = nameOverride ?? (typeof defaultName === 'string' && !projectNameError(defaultName) ? defaultName : t('defaultName'));
      const currentProject = pending || binding;
      const pendingKey = ['starting', 'manual_start_required', 'restart_required', 'failed'].includes(pending?.status)
        ? pending.status : pending ? 'failed' : '';
      const browsing = operation === 'browse';
      const browseProblem = problem?.action === 'browse';
      const connectionProblem = !browseProblem && problem;
      const unavailable = Boolean(connectionProblem?.unavailable);
      const state = unavailable ? 'unavailable' : operation && operation !== 'discover' && !browsing ? 'working'
        : pendingKey || (binding ? 'connected' : connectionProblem ? 'failed' : statusKnown ? 'disconnected' : 'checking');
      const toolbarLabel = currentProject
        ? t('toolbarProject', { state: t(state), name: projectName(currentProject) })
        : t('toolbar', { state: t(state) });
      const suffix = binding && !unavailable ? projectName(binding)
        : unavailable ? t('unavailable') : statusKnown ? t('disconnected') : t('toolbarChecking');
      const toolbarText = t('toolbarVisible', { name: suffix });
      const busy = Boolean(operation);
      const switching = waiting(pending);
      const detail = errorText(problem?.error) || errorText(pending?.error);
      const currentMeta = currentProject && projectMeta(currentProject,
        isPort(currentProject.port) ? t('port', { port: currentProject.port }) : '');
      const nameError = invalid === 'invalidName' || invalid === 'reservedName';
      const editingDisabled = busy || switching || Boolean(binding);
      const launchDisabled = editingDisabled || !engines.length || unavailable;
      const createPreview = validLocalDirectory(directory.trim()) && !projectNameError(name)
        ? createPath(directory.trim(), name) : '';

      function show(event) {
        event.stopPropagation();
        if (dialog.current && !dialog.current.open) {
          dialog.current.showModal();
          close.current?.focus();
          setDialogOpen(true);
          setInvalid('');
          void run('discover');
        }
      }
      function chosen(id) { return id && engines.some((engine) => engine.id === id) ? { engineId: id } : {}; }
      function launch(event, action) {
        event.preventDefault();
        if (launchDisabled) return;
        if (action === 'open') {
          const value = path.trim();
          if (!validLocalProject(value)) return setInvalid('invalidPath');
          setInvalid('');
          void run('open', { path: value, ...chosen(openEngine) });
        } else {
          const folder = directory.trim();
          if (!validLocalDirectory(folder)) return setInvalid('invalidDirectory');
          const error = projectNameError(name);
          if (error) return setInvalid(error);
          setInvalid('');
          void run('create', { directory: folder, name, ...chosen(createEngine) });
        }
      }
      function updateDirectory(value) {
        setDirectoryOverride(value);
        setBrowsedDefault(null);
      }
      async function browse(mode, currentPath, input) {
        const value = currentPath.trim();
        const isValid = mode === 'project' ? validLocalProject : validLocalDirectory;
        const result = await run('browse', { mode, ...(isValid(value) ? { path: value } : {}) });
        requestAnimationFrame(() => {
          if (dialog.current?.open && input?.isConnected && !input.disabled &&
              [document.body, dialog.current].includes(document.activeElement)) input.focus();
        });
        if (typeof result?.path !== 'string') return;
        setInvalid('');
        if (mode === 'project') setPath(result.path);
        else {
          setDirectoryOverride(result.path);
          setBrowsedDefault(result.defaultName ?? null);
        }
      }
      function pathField(mode, labelKey, value, update, errorKey, errorId) {
        const hasError = invalid === errorKey;
        return h(React.Fragment, null,
          h('div', { className: 'dsh-unreal-path-field' },
            h('label', null, t(labelKey), h('input', { value, required: true, spellCheck: false, autoComplete: 'off',
              disabled: editingDisabled, 'aria-invalid': hasError || undefined,
              'aria-describedby': hasError ? errorId : undefined,
              onChange: (event) => { update(event.target.value); setInvalid(''); } })),
            h('button', { type: 'button', disabled: editingDisabled,
              'aria-label': t(mode === 'project' ? 'browseProject' : 'browseDirectory'),
              onClick: (event) => void browse(mode, value, event.currentTarget.parentElement.querySelector('input')) }, t('browse'))),
          hasError && h('p', { id: errorId, className: 'dsh-unreal-problem', role: 'alert' }, t(errorKey)));
      }
      function enginePicker(assignment, update) {
        return h('label', null, t('engine'), h('select', {
          value: chosen(assignment).engineId || '', onChange: (event) => update(event.target.value), disabled: launchDisabled,
        }, h('option', { value: '' }, t('engineAuto')),
        engines.map((engine) => h('option', { key: engine.id, value: engine.id }, engine.name))));
      }
      function meta(text) { return h('p', { className: 'dsh-unreal-meta' }, text); }
      function projectMeta(project, ports) {
        return [project.pid ? t('pid', { pid: project.pid }) : '', ports].filter(Boolean).join(' · ');
      }

      return h(React.Fragment, null,
        h('button', { type: 'button', className: 'dsh-unreal-tool', 'aria-haspopup': 'dialog',
          'aria-expanded': dialogOpen, 'aria-label': toolbarText,
          'aria-describedby': `${titleId}-toolbar-status`, title: toolbarLabel, onClick: show },
        h('span', { 'aria-hidden': true, className: 'dsh-unreal-dot', 'data-state': state }),
        h('span', { className: 'dsh-unreal-tool-label' }, toolbarText)),
        h('span', { id: `${titleId}-toolbar-status`, hidden: true }, toolbarLabel),
        h('dialog', { ref: dialog, className: 'dsh-unreal-modal', 'aria-labelledby': titleId,
          onClose: () => { cancelBrowse(); setDialogOpen(false); }, onKeyDown: (event) => event.stopPropagation(),
          onClick: (event) => event.stopPropagation() },
        h('header', { className: 'dsh-unreal-bar' }, h('h2', { id: titleId }, t('title')),
          h('div', { className: 'dsh-unreal-bar-actions' },
            h('button', { type: 'button', disabled: busy, onClick: () => { setInvalid(''); void run('discover'); } }, t('refresh')),
            ' ', h('button', { type: 'button', ref: close, onClick: () => dialog.current?.close() }, t('close')))),
        h('article', null,
          h('div', { className: 'dsh-unreal-status' },
            h('div', { className: 'dsh-unreal-detail', role: 'status' },
              h('strong', null, t(state)),
              currentProject && h('p', null, projectName(currentProject)),
              currentProject?.path && meta(currentProject.path),
              currentMeta && meta(currentMeta)),
            (binding || pending) && h('button', { type: 'button', disabled: busy,
              onClick: () => { setInvalid(''); void run('disconnect'); } }, t(binding ? 'disconnect' : 'cancelConnection'))),
          pendingKey === 'manual_start_required' && h('div', null,
            meta(t(isPort(pending.port) ? 'manualCommand' : 'manualNoPort')),
            isPort(pending.port) && h('code', null, `ModelContextProtocol.StartServer ${pending.port}`)),
          switching && meta(t('launchInProgress')),
          binding && !switching && meta(t('switchHelp')),
          browsing && h('p', { className: 'dsh-unreal-meta', role: 'status' }, t('browsing')),
          problem && h('p', { className: 'dsh-unreal-problem', role: 'alert' },
            t(browseProblem ? 'browseFailed' : unavailable ? 'unavailableHelp' : 'actionFailed'), detail ? ` ${detail}` : ''),
          !problem && detail && h('p', { className: 'dsh-unreal-problem', role: 'alert' }, detail),
          h('section', null, h('h3', null, t('running')),
            busy && operation === 'discover' ? h('p', { role: 'status', className: 'dsh-unreal-meta' }, t('loading')) : null,
            projects.length ? h('ul', null, projects.map((project) => {
              const connected = binding?.pid === project.pid && binding?.path === project.path;
              const ports = Array.isArray(project.ports) ? project.ports.filter(isPort) : [];
              return h('li', { key: `${project.pid}:${project.path}` },
                h('div', { className: 'dsh-unreal-detail' }, h('strong', null, projectName(project)),
                  meta(project.path), meta(projectMeta(project, ports.length ? t('ports', { ports: ports.join(', ') }) : ''))),
                h('button', { type: 'button', disabled: busy || connected || switching || Boolean(binding) || unavailable,
                  'aria-label': connected ? undefined : t('connectTo', { name: projectName(project), pid: project.pid }),
                  onClick: () => { setInvalid(''); void run('connect', { path: project.path, pid: project.pid }); } },
                t(connected ? 'connected' : 'connect')));
            })) : discovery && !busy ? meta(t('noneRunning')) : null),
          discovery && !engines.length && meta(t('noEngines')),
          discovery && h('details', null, h('summary', null, t('openTitle')),
            h('form', { noValidate: true, onSubmit: (event) => launch(event, 'open') }, meta(t('openHelp')),
              pathField('project', 'path', path, setPath, 'invalidPath', pathErrorId),
              enginePicker(openEngine, setOpenEngine),
              h('button', { type: 'submit', className: 'dsh-unreal-primary', disabled: launchDisabled }, t('open')))),
          discovery && h('details', null, h('summary', null, t('createTitle')),
            h('form', { noValidate: true, onSubmit: (event) => launch(event, 'create') },
              meta(t('createHelp')),
              pathField('directory', 'directory', directory, updateDirectory, 'invalidDirectory', directoryErrorId),
              h('label', null, t('name'), h('input', { value: name, maxLength: 20, required: true, spellCheck: false, autoComplete: 'off',
                disabled: editingDisabled, 'aria-invalid': nameError || undefined,
                'aria-describedby': nameError ? nameErrorId : undefined,
                onChange: (event) => { setNameOverride(event.target.value); setInvalid(''); } })),
              nameError && h('p', { id: nameErrorId, className: 'dsh-unreal-problem', role: 'alert' }, t(invalid)),
              createPreview && meta(t('createLocation', { path: createPreview })),
              enginePicker(createEngine, setCreateEngine),
              h('button', { type: 'submit', className: 'dsh-unreal-primary', disabled: launchDisabled }, t('create')))))));
    }

    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(ns, dictionaries));
        ctx.effect(() => {
          const style = document.createElement('style');
          style.textContent = styles;
          document.head.appendChild(style);
          return () => style.remove();
        });
        const t = ctx.locale.bind(ns);
        const subscribe = (listener) => ctx.locale.subscribe(listener);
        const getLocale = () => ctx.locale.getSnapshot();
        const connection = ctx.connection;
        const subscribeGeneration = (listener) => connection.generation.subscribe(listener);
        const getGeneration = () => connection.generation.getSnapshot();
        const cacheByGeneration = new WeakMap();
        const offlineCache = new Map(); // no requests or writes until a generation is ready
        function UnrealProjectsSlot(props) {
          const visible = props.useSessions((state) => state.byId[props.sessionId]?.projectionValues?.agentPreset === 'unreal');
          React.useSyncExternalStore(subscribe, getLocale, getLocale);
          const generation = React.useSyncExternalStore(subscribeGeneration, getGeneration, getGeneration);
          if (!visible || !props.sessionId) return null;
          let statusCache = generation ? cacheByGeneration.get(generation) : offlineCache;
          if (!statusCache) {
            statusCache = new Map();
            cacheByGeneration.set(generation, statusCache);
          }
          return h(Projects, {
            key: `${generation?.id ?? 'offline'}:${props.sessionId}`,
            sessionId: props.sessionId, connection, generation, statusCache, t,
          });
        }
        const name = 'conversation.input.left';
        ctx.slots.inject(name, () => ctx.slots.register({ name, id: 'unreal-projects', order: 5 }, UnrealProjectsSlot));
      },
    };
  },
});
