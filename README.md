# DSH Unreal

[English](README.en.md)

在 Windows 上，从 DeepSeek Harness 连接、打开或新建 Unreal 工程。插件使用 Unreal Editor 自带的 MCP 服务，不需要另装转发服务。

## 环境要求

- DeepSeek Harness Desktop **0.2.2-rc.5**，与 Unreal Editor 运行在同一台电脑上。
- Unreal Engine **5.8 或 5.9**。已有工程需启用 `ModelContextProtocol` 插件。支持两版原生的 **Tool Search**，也支持关闭后直接发现和调用工具。已运行的编辑器若使用自定义 MCP 路径，可在「MCP 连接选项」中填写（默认 `/mcp`）。

## 安装和使用

### 安装

正式发布后，在 DSH 的「设置 → 插件 → 添加插件」粘贴 GitHub Release 的 `.tgz` 下载地址：

```text
https://github.com/msxqqq/dsh-unreal/releases/download/v0.1.0/dsh-unreal-0.1.0.tgz
```

此地址需在 Release `v0.1.0` 上传安装包后才可用。也可以下载 `.tgz` 后选择本地文件，或克隆源码后选择包含 `package.json` 的本地目录。不要把 GitHub 仓库网页或自动生成的 Source code 压缩包当成安装包。

### 使用

1. 新建会话，选择 **Unreal 模式**。点击「工作区内修改」旁的 **Unreal 工程**，连接正在运行的工程、浏览打开 `.uproject`，或在指定目录新建空白工程。
2. 由 DSH 打开的编辑器会尝试自动启动 MCP。已打开的编辑器若未启动 MCP，请在 Unreal 的 **Output Log** 命令栏运行界面提示的 `ModelContextProtocol.StartServer <端口>`，然后等待 DSH 自动连接。

连接成功后，按钮会显示工程名。连接按会话隔离；断开连接不会关闭编辑器。
