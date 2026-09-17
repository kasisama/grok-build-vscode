# 个人中文桌面版

本 fork 仅给自己用：Desktop 界面改成简体中文，并关闭官方自动更新，避免英文安装包覆盖。

不翻译专有名词：Grok、Codex、Claude Code、ACP、AFK Pilot、CLI 命令。

## 在 Windows 上打包

```powershell
cd grok-build-vscode
npm install
npm run compile
npm run dist:win
```

安装包在 `dist-desktop\Grok-Build-Desktop-4.8.0-win-x64.exe`。

未签名，SmartScreen 选「更多信息 → 仍要运行」。

开发调试（不打包）：

```powershell
npm run desktop
```
