/**
 * Desktop update helpers — personal zh-CN fork disables official auto-update.
 */
export const DESKTOP_INSTALLER_SUFFIXES = [
  "-mac-arm64.dmg",
  "-mac-x64.dmg",
  "-mac-arm64.zip",
  "-mac-x64.zip",
  "-win-x64.exe",
  "-linux-x86_64.AppImage",
] as const;

export type Semver = { major: number; minor: number; patch: number };

export function parseSemver(raw: string | null | undefined): Semver | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function isNewerVersion(
  candidate: string | null | undefined,
  current: string | null | undefined,
): boolean {
  const c = parseSemver(candidate);
  const cur = parseSemver(current);
  if (!c || !cur) return false;
  return compareSemver(c, cur) > 0;
}

export function isDesktopInstallerAsset(name: string | null | undefined): boolean {
  const n = String(name || "");
  if (!n) return false;
  for (const suffix of DESKTOP_INSTALLER_SUFFIXES) {
    if (n.endsWith(suffix)) return true;
  }
  return false;
}

export interface GithubReleaseLike {
  tag_name?: string;
  name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name?: string }[] | null;
}

export interface DesktopReleaseNotice {
  version: string;
  url: string;
}

export function pickLatestDesktopRelease(
  releases: readonly GithubReleaseLike[] | null | undefined,
): DesktopReleaseNotice | null {
  if (!Array.isArray(releases) || releases.length === 0) return null;
  let best: { version: string; url: string; semver: Semver } | null = null;
  for (const r of releases) {
    if (!r || r.draft) continue;
    const assets = Array.isArray(r.assets) ? r.assets : [];
    if (!assets.some((a: { name?: string }) => isDesktopInstallerAsset(a?.name))) continue;
    const tag = r.tag_name || r.name || "";
    const semver = parseSemver(tag);
    if (!semver) continue;
    const version = `${semver.major}.${semver.minor}.${semver.patch}`;
    const url =
      (typeof r.html_url === "string" && r.html_url) ||
      `https://github.com/phuryn/grok-build-vscode/releases/tag/${encodeURIComponent(tag)}`;
    if (!best || compareSemver(semver, best.semver) > 0) {
      best = { version, url, semver };
    }
  }
  return best ? { version: best.version, url: best.url } : null;
}

export function noticeIfUpdateAvailable(
  currentVersion: string | null | undefined,
  releases: readonly GithubReleaseLike[] | null | undefined,
): DesktopReleaseNotice | null {
  const latest = pickLatestDesktopRelease(releases);
  if (!latest) return null;
  if (!isNewerVersion(latest.version, currentVersion)) return null;
  return latest;
}

export function desktopUpdatePageUrl(currentVersion: string | null | undefined): string {
  const v = String(currentVersion || "").trim();
  const base = "https://afkpilot.com/desktop-update";
  return v ? `${base}?from=${encodeURIComponent(v)}` : base;
}

export const DESKTOP_RELEASES_API_URL =
  "https://api.github.com/repos/phuryn/grok-build-vscode/releases?per_page=100";
export const DESKTOP_UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const DESKTOP_UPDATE_FEED_ORIGIN = "https://afkpilot.com/update";

export function desktopUpdateFeedBase(
  platform: NodeJS.Platform | string | null | undefined,
): string | null {
  if (platform === "win32") return `${DESKTOP_UPDATE_FEED_ORIGIN}/win/`;
  if (platform === "darwin") return `${DESKTOP_UPDATE_FEED_ORIGIN}/mac/`;
  if (platform === "linux") return `${DESKTOP_UPDATE_FEED_ORIGIN}/linux/`;
  return null;
}

export function desktopUpdateFeedConfig(
  platform: NodeJS.Platform | string | null | undefined,
): { provider: "generic"; url: string } | null {
  const url = desktopUpdateFeedBase(platform);
  if (!url) return null;
  return { provider: "generic", url };
}

export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "failed";

export type AppUpdateEvent =
  | { type: "check-started" }
  | { type: "update-available"; version: string }
  | { type: "update-not-available" }
  | { type: "download-started" }
  | { type: "update-downloaded"; version: string }
  | { type: "error" };

export interface AppUpdateState {
  phase: AppUpdatePhase;
  version: string | null;
}

export function initialAppUpdateState(): AppUpdateState {
  return { phase: "idle", version: null };
}

export function reduceAppUpdate(state: AppUpdateState, event: AppUpdateEvent): AppUpdateState {
  if (state.phase === "ready" && event.type !== "update-downloaded") return state;
  switch (event.type) {
    case "check-started":
      return { phase: "checking", version: state.version };
    case "update-available":
      return { phase: "available", version: event.version || state.version };
    case "update-not-available":
      return { phase: "idle", version: null };
    case "download-started":
      return { phase: "downloading", version: state.version };
    case "update-downloaded":
      return { phase: "ready", version: event.version || state.version };
    case "error":
      return { phase: "failed", version: state.version };
  }
}

export type RailUpdateKind = "hidden" | "notice" | "restart";

export function railUpdateKind(state: AppUpdateState): RailUpdateKind {
  if (state.phase === "ready") return "restart";
  if (state.phase === "failed") return "notice";
  return "hidden";
}

export function shouldRunNoticeFallback(state: AppUpdateState): boolean {
  return state.phase === "failed";
}

export function shouldSkipUpdateCheck(state: AppUpdateState): boolean {
  return state.phase === "ready" || state.phase === "downloading";
}

export function desktopAutoUpdateEnabled(opts: {
  platform: NodeJS.Platform | string | null | undefined;
  packaged: boolean;
  forceDev?: boolean;
}): boolean {
  void opts;
  return false;
}

export function latestMacYmlHasBothArches(yml: string | null | undefined): boolean {
  const s = String(yml || "");
  return /mac-arm64\.zip\s*$/m.test(s) && /mac-x64\.zip\s*$/m.test(s);
}

export function latestWinYmlHasInstaller(yml: string | null | undefined): boolean {
  return /win-x64\.exe\s*$/m.test(String(yml || ""));
}

export function latestLinuxYmlHasAppImage(yml: string | null | undefined): boolean {
  return /linux-x86_64\.AppImage\s*$/m.test(String(yml || ""));
}

export interface DesktopAutoUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  forceDevUpdateConfig?: boolean;
  logger: unknown;
  setFeedURL(opts: { provider: "generic"; url: string }): void;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

export interface DesktopUpdateUi {
  postNotice(version: string, url: string): void;
  postReady(version: string): void;
  log(line: string): void;
  fetchNotice(): Promise<DesktopReleaseNotice | null>;
}

export interface DesktopUpdateSession {
  check(): Promise<void>;
  install(): void;
  getState(): AppUpdateState;
}

function versionFromUpdaterInfo(info: unknown): string {
  if (info && typeof info === "object" && "version" in info) {
    const v = (info as { version?: unknown }).version;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function updaterLogLine(message: unknown): string {
  if (message == null) return "";
  if (typeof message === "string") return message;
  if (message instanceof Error) return message.stack || message.message;
  try {
    return String(message);
  } catch {
    return "unknown";
  }
}

export function attachDesktopAutoUpdate(opts: {
  updater: DesktopAutoUpdater | (() => DesktopAutoUpdater);
  platform: NodeJS.Platform | string;
  currentVersion: string;
  packaged: boolean;
  forceDev?: boolean;
  ui: DesktopUpdateUi;
}): DesktopUpdateSession {
  let state = initialAppUpdateState();
  let configured = false;
  const enabled = desktopAutoUpdateEnabled(opts);
  let resolvedUpdater: DesktopAutoUpdater | undefined;
  const updater = (): DesktopAutoUpdater => {
    if (!resolvedUpdater) {
      resolvedUpdater =
        typeof opts.updater === "function"
          ? (opts.updater as () => DesktopAutoUpdater)()
          : opts.updater;
    }
    return resolvedUpdater;
  };

  const apply = (event: AppUpdateEvent): AppUpdateState => {
    state = reduceAppUpdate(state, event);
    return state;
  };

  const fallbackNotice = async (): Promise<void> => {
    const isReady = () => state.phase === "ready";
    if (isReady()) return;
    try {
      const notice = await opts.ui.fetchNotice();
      if (isReady()) return;
      if (notice) opts.ui.postNotice(notice.version, desktopUpdatePageUrl(opts.currentVersion));
    } catch (e) {
      opts.ui.log(`[update] notice fallback failed: ${updaterLogLine(e)}`);
    }
  };

  const configure = (): boolean => {
    if (configured) return true;
    const feed = desktopUpdateFeedConfig(opts.platform);
    if (!feed) return false;
    updater().autoDownload = true;
    updater().autoInstallOnAppQuit = true;
    updater().allowPrerelease = false;
    const forceDevUnpackaged = !!opts.forceDev && !opts.packaged;
    if (forceDevUnpackaged) updater().forceDevUpdateConfig = true;
    updater().logger = {
      info: (m: unknown) => opts.ui.log(`[update] ${updaterLogLine(m)}`),
      warn: (m: unknown) => opts.ui.log(`[update] ${updaterLogLine(m)}`),
      error: (m: unknown) => opts.ui.log(`[update] ${updaterLogLine(m)}`),
      debug: (m: unknown) => opts.ui.log(`[update] ${updaterLogLine(m)}`),
    };
    if (!forceDevUnpackaged) updater().setFeedURL(feed);
    updater().on("checking-for-update", () => apply({ type: "check-started" }));
    updater().on("update-available", (info: unknown) => {
      apply({ type: "update-available", version: versionFromUpdaterInfo(info) });
      apply({ type: "download-started" });
    });
    updater().on("update-not-available", () => apply({ type: "update-not-available" }));
    updater().on("update-downloaded", (info: unknown) => {
      const next = apply({ type: "update-downloaded", version: versionFromUpdaterInfo(info) });
      if (next.phase === "ready" && next.version) opts.ui.postReady(next.version);
    });
    updater().on("error", (err: unknown) => {
      opts.ui.log(`[update] ${updaterLogLine(err)}`);
      apply({ type: "error" });
      void fallbackNotice();
    });
    configured = true;
    return true;
  };

  return {
    getState: () => state,
    install() {
      if (state.phase !== "ready") return;
      try {
        updater().quitAndInstall(true, true);
      } catch (e) {
        opts.ui.log(`[update] quitAndInstall failed: ${updaterLogLine(e)}`);
        void fallbackNotice();
      }
    },
    async check() {
      if (shouldSkipUpdateCheck(state)) return;
      if (!enabled) {
        await fallbackNotice();
        return;
      }
      if (!configure()) {
        await fallbackNotice();
        return;
      }
      try {
        const result = await updater().checkForUpdates();
        if (!result) await fallbackNotice();
      } catch (e) {
        opts.ui.log(`[update] check failed: ${updaterLogLine(e)}`);
        apply({ type: "error" });
        await fallbackNotice();
      }
    },
  };
}
