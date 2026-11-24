# DSH Unreal

[简体中文](README.md)

Connect to, open, or create Unreal projects from DeepSeek Harness on Windows. The plugin uses Unreal Editor’s built-in MCP server; no separate relay is needed.

## Requirements

- DeepSeek Harness Desktop **0.2.2-rc.5** and Unreal Editor on the same PC.
- Unreal Engine **5.8 or 5.9**. Enable `ModelContextProtocol` in existing projects. Both versions support native **Tool Search**, or direct tool discovery and calls with Tool Search off. For running editors using a custom MCP path, use **MCP connection options** (default: `/mcp`).

## Install and use

### Install

Once published, paste this GitHub Release `.tgz` URL into **Settings → Plugins → Add plugin** in DSH:

```text
https://github.com/msxqqq/dsh-unreal/releases/download/v0.1.0/dsh-unreal-0.1.0.tgz
```

The URL works after the package is uploaded to Release `v0.1.0`. Alternatively, select a downloaded `.tgz`, or clone the source and select the local folder containing `package.json`. The GitHub repository page and the auto-generated Source code archives are not install packages.

### Use

1. Start a new conversation in **Unreal mode**. Open **Unreal Projects** next to the workspace permission control to connect to a running project, browse for a `.uproject` file, or create a blank project in a folder you choose.
2. DSH attempts to start MCP when it launches Unreal Editor. If an already-running editor has not started MCP, run the displayed `ModelContextProtocol.StartServer <port>` command in Unreal’s **Output Log** command box and wait for DSH to connect.

The button shows the project name once connected. Each conversation has its own connection. Disconnecting does not close Unreal Editor.
