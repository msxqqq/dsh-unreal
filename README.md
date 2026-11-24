# DSH Unreal

在 Windows 上，通过 DeepSeek Harness 的 **Unreal 模式** 选择并操作指定的 Unreal Editor 工程。不需要另装 MCP 转发服务：插件连接 Unreal Editor 自带的 MCP 服务。

## 兼容性

- DeepSeek Harness Desktop **0.2.2-rc.5**。
- Unreal Engine **5.8**，已安装并启用编译完成的 `ModelContextProtocol` 插件，且开启 **Tool Search**。连接已打开的编辑器时，MCP 路径必须是默认的 `/mcp`。UE 5.9 更改了工具发现协议，**本版不支持**。
- Unreal Editor 和 DSH Host 必须在同一台 Windows 电脑上。项目选择与启动由本机 DSH 所有者操作。

## 安装和使用

1. 取得此仓库的完整源码。在 DSH 的「设置 → 插件 → 添加插件」安装本地仓库目录。若 DSH 要求重启，请重启后新建会话并选择 **Unreal 模式**。
2. 点输入栏「工作区内修改」旁的 **Unreal 工程**。连接后，按钮后缀会显示工程名。同一会话切回来时，会先沿用上次确认的状态，再向后台核对。
3. 选择运行中的编辑器，或用 **浏览…** 选择已有 `.uproject`。要新建工程，可以指定保存目录，默认使用当前工作区，建议名称从「未命名工程_01」开始。确认路径后创建，不会覆盖已有工程。
4. DSH 启动编辑器时会尝试同时启动 MCP。若工程已经打开但未启动 MCP，在目标编辑器的 **Output Log** 命令栏执行界面提示的 `ModelContextProtocol.StartServer <端口>`。DSH 会继续检测并尝试连接，不会关闭编辑器或模拟按键。

已有工程需要自行启用 `ModelContextProtocol`；DSH 不会替你修改工程的插件配置。MCP 工具集由 Unreal 插件提供，例如 `EditorToolset`；仅启用 MCP 不保证具备特定编辑工具。启用第三方项目或引擎前，请自行确认它们可信。

**连接是会话级的。** DSH 会核对项目路径、进程、回环监听端口和 MCP 握手。断开只释放 DSH 的连接，不会关闭编辑器。重启 DSH 或打开新会话后需要重新选择。若端口被另一个进程占用，或工程配置覆盖了回环监听，插件可能拒绝连接或自动启动；请检查 Unreal 的输出日志和 HTTP Server 设置。

## 开发与检查

不需要构建步骤或安装 npm 依赖。以 Node.js 22 或较新版本运行：

```powershell
npm test
powershell -NoProfile -File windows-ue.test.ps1
```

自动测试覆盖路径与默认命名、MCP 握手和目标端口筛选，不需要开启 Unreal。发布验证还应在实际 DSH 和 UE 5.8 环境中检查：浏览取消、打开与新建工程、切换会话不闪断、工程退出或 MCP 停止后的状态反馈。

- `client.js`：工程选择器、原生浏览按钮和状态显示。
- `index.js` / `agent.js`：Host 操作和会话作用域内的 UE 工具。
- `windows-ue.ps1` / `windows-picker.ps1`：本机发现、进程准备和文件选择。
- `mcp.js`：Unreal MCP HTTP 客户端。
- `cordis.patch.yml`：DSH 插件与预设注册。
