/**
 * Desktop application menu template (pure).
 *
 * Built into a real Electron Menu in main.ts. Kept pure so the packaged-gate
 * on Developer Tools can be unit-tested without spawning Electron.
 */
import type { MenuItemConstructorOptions } from "electron";
import { DESKTOP_APP_FULL_NAME } from "./host-dialogs";

/** Env var set by `scripts/run-desktop.cjs --open-devtools` (desktop-dev). */
export const DESKTOP_OPEN_DEVTOOLS_ENV = "GROK_DESKTOP_OPEN_DEVTOOLS";

/** CLI flag mirrored into the env above; also accepted on the main process argv. */
export const DESKTOP_OPEN_DEVTOOLS_FLAG = "--open-devtools";

/** Packaged/signed builds must not expose a DevTools door. */
export function desktopDevToolsAllowed(isPackaged: boolean): boolean {
  return !isPackaged;
}

export function shouldOpenDevToolsAtStartup(opts: {
  isPackaged: boolean;
  env?: NodeJS.ProcessEnv;
  argv?: string[];
}): boolean {
  if (!desktopDevToolsAllowed(opts.isPackaged)) return false;
  const env = opts.env ?? {};
  const flag = env[DESKTOP_OPEN_DEVTOOLS_ENV];
  if (flag === "1" || /^true$/i.test(flag ?? "")) return true;
  const argv = opts.argv ?? [];
  return argv.includes(DESKTOP_OPEN_DEVTOOLS_FLAG);
}

export interface DesktopAppMenuActions {
  addProjectFolder?: () => void;
  removeProjectFolder?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  resetZoom?: () => void;
}

export const DESKTOP_DEVTOOLS_ACCELERATOR = "CmdOrCtrl+Shift+I";

export function isDesktopDevToolsShortcut(input: {
  type?: string;
  key?: string;
  control?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}): boolean {
  if (input.type !== "keyDown") return false;
  const key = String(input.key || "");
  if (key === "F12") return true;
  if ((key === "I" || key === "i") && input.shift && (input.control || input.meta) && !input.alt) {
    return true;
  }
  return false;
}

export function secondInstanceShouldOpenDevTools(opts: {
  isPackaged: boolean;
  commandLine?: string[];
  env?: NodeJS.ProcessEnv;
}): boolean {
  if (!desktopDevToolsAllowed(opts.isPackaged)) return false;
  const argv = opts.commandLine ?? [];
  if (argv.includes(DESKTOP_OPEN_DEVTOOLS_FLAG)) return true;
  return shouldOpenDevToolsAtStartup({
    isPackaged: opts.isPackaged,
    env: opts.env,
    argv,
  });
}

export function desktopAppMenuTemplate(opts: {
  isPackaged: boolean;
  platform?: NodeJS.Platform;
  actions?: DesktopAppMenuActions;
  openPublicRepo?: () => void;
}): MenuItemConstructorOptions[] {
  const isMac = (opts.platform ?? process.platform) === "darwin";
  const openRepo =
    opts.openPublicRepo ??
    (() => {
      /* wired by main */
    });
  const actions = opts.actions;
  const allowDevTools = desktopDevToolsAllowed(opts.isPackaged);

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: "reload", label: "重新加载" },
    { role: "forceReload", label: "强制重新加载" },
    ...(allowDevTools
      ? [
          {
            role: "toggleDevTools" as const,
            label: "切换开发者工具",
            accelerator: DESKTOP_DEVTOOLS_ACCELERATOR,
          },
        ]
      : []),
    { type: "separator" },
    {
      label: "实际大小",
      click: () => {
        try {
          actions?.resetZoom?.();
        } catch {
          /* best-effort */
        }
      },
    },
    {
      label: "放大",
      click: () => {
        try {
          actions?.zoomIn?.();
        } catch {
          /* best-effort */
        }
      },
    },
    {
      label: "缩小",
      click: () => {
        try {
          actions?.zoomOut?.();
        } catch {
          /* best-effort */
        }
      },
    },
    { type: "separator" },
    { role: "togglefullscreen", label: "全屏" },
  ];

  return [
    ...(isMac
      ? [
          {
            label: DESKTOP_APP_FULL_NAME,
            submenu: [
              { role: "about" as const, label: `关于 ${DESKTOP_APP_FULL_NAME}` },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "文件",
      submenu: [
        {
          label: "添加项目文件夹…",
          click: () => {
            try {
              actions?.addProjectFolder?.();
            } catch {
              /* best-effort */
            }
          },
        },
        {
          label: "关闭项目文件夹",
          click: () => {
            try {
              actions?.removeProjectFolder?.();
            } catch {
              /* best-effort */
            }
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "查看",
      submenu: viewSubmenu,
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "GitHub 仓库",
          click: () => {
            openRepo();
          },
        },
        {
          label: `关于 ${DESKTOP_APP_FULL_NAME}`,
          click: () => {
            openRepo();
          },
        },
      ],
    },
  ];
}
