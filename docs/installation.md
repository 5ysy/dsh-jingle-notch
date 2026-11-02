# Install JingleNotch / 安装

[English README](../README.md) · [中文 README](../README.zh.md) · [Configuration / 配置](configuration.md)

## Requirements / 环境要求

- DeepSeek Harness: verified on Desktop/Web `0.2.1-rc.5` and source Web `0.2.2-alpha.2`. The native overlay is tested on macOS.
- Development and current Web/source Harness: Node >=24.9.0 and pnpm. Desktop includes its host Node runtime.
- Native overlay: a graphical desktop and an Electron executable. Resolution order is `overlay.electronPath` → local `electron` installation → `npx --yes electron`.
- First-use npx downloads need Node/npm on PATH and network access. Desktop's bundled host runtime alone does not provide a standalone Electron overlay executable. Configure a separate Electron executable if you want to avoid the npx fallback.
- Safe-area measurement uses macOS `/usr/bin/swift`; if unavailable, the overlay uses bounded menu-bar geometry. It follows the primary display.

## Install from npm / 从 npm 安装

Install the published package into the profile you use:

```sh
dsh plugin --profile web add dsh-jingle-notch
```

For macOS Desktop, open the app once, fully quit it, then run:

```sh
'/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh' \
  plugin --profile desktop add dsh-jingle-notch
```

Restart the owning Host and enter `/jingle overlay` in a session. Desktop and Web have separate plugin lists. npm installs the compiled package; building source is only required for local development.

更新已安装的 npm 插件时，先停止对应宿主，将上述命令中的包名改为 `dsh-jingle-notch@latest` 再运行，然后重新启动宿主。首次启动浮窗的 Electron 要求见下文。

## Build the local package / 构建本地包

Run from the plugin directory containing `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

The package and checkout directory are named `dsh-jingle-notch`. In this workspace the directory is `dev_plugins/dsh-jingle-notch`; use its absolute path in the commands below.

## Web

```sh
dsh plugin --profile web add /absolute/path/to/dsh-jingle-notch
dsh web
```

Restart an already-running `dsh web` after installation. `/jingle` prints status; `/jingle overlay` opens the notch panel. The companion dashboard is `/jingle` on the listener address printed by Harness.

## Official macOS Desktop / 官方桌面版

1. Launch Desktop once to initialize `$DSH_HOME/profiles/desktop`.
2. Fully quit the application. Closing its window may leave its Host running.
3. Install using that application's bundled CLI:

```sh
'/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh' \
  plugin --profile desktop add /absolute/path/to/dsh-jingle-notch
```

4. Reopen Desktop and enter `/jingle overlay` in a session.

If the app is installed elsewhere, use that app's `Contents/Resources/runtime/cli/bin/dsh`. Its **Manage dsh Command…** menu can register the bundled CLI as `dsh`. The npm/source CLI cannot manage the reserved `desktop` profile. Desktop and Web have independent plugin lists.

桌面版请使用其内置 CLI，完全退出后安装，再重新打开。`--profile web` 对应 Web 服务，`--profile desktop` 对应桌面应用。两端使用时分别安装。

## Electron and automatic launch / Electron 与自动启动

Edit the `jingle-notch` row in the profile's `cordis.patch.yml`:

```yaml
- id: jingle-notch
  config:
    overlay:
      enabled: true
      autoStart: true
      electronPath: '/absolute/path/to/Electron.app/Contents/MacOS/Electron'
      yOffset: 0
```

An empty `electronPath` uses auto-resolution. Select an actual Electron executable that can run arbitrary app scripts; the signed DeepSeek Harness application executable belongs to its own application. A local development option is `pnpm add -D electron@<version-you-select>` in your own environment, then use the installed binary's absolute path. This repository does not require Electron to run unit tests or build.

`autoStart` defaults to `false`. With it enabled, restarting the corresponding Host launches the overlay automatically. Leave `enabled: true` and use `/jingle overlay` for manual launch.

## Update a local installation / 更新本地安装

After installing a local link, run `pnpm build` in `dsh-jingle-notch` and restart its Host to load code changes. If the checkout moves, update the installed package entry to its new absolute path while the owning Host is stopped. Install a new tarball through the same profile CLI whenever its contents change.

Configuration uses `id: jingle-notch`; the service is `ctx.jingleNotch`. Preferences and recap history use independent `dsh-jingle-notch` directories. The plugin does not import other applications' settings or data.

本地链接更新后需重新构建并重启对应宿主。目录移动后，请在宿主停止时更新插件安装路径。配置 ID 为 `jingle-notch`，数据独立存储；请使用本页的安装命令。

## Install a local tarball / 安装本地发布包

Build and pack from the plugin directory:

```sh
pnpm build
pnpm pack --out /absolute/path/to/dsh-jingle-notch-0.1.0.tgz
```

Then use that archive as the install spec:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-jingle-notch-0.1.0.tgz
```

For Desktop, substitute the bundled CLI and `--profile desktop` while the app is quit. The tarball includes compiled Host/overlay code, original whale assets, both READMEs and the public documentation. Users installing it do not need this source checkout's `dev_docs` directory.

## Troubleshooting / 排查

| Symptom / 现象 | Check / 检查 |
| --- | --- |
| Desktop does not show the plugin | Verify installation into `desktop` using that application's bundled CLI; reopen the app |
| `/jingle` is unavailable | Check the plugin is installed/enabled in the active profile, rebuild local sources and restart |
| Overlay does not start | Inspect Host logs; verify `overlay.enabled`, Electron path and graphical desktop availability |
| First launch waits for a download | Configure a known Electron executable to avoid the npx fallback |
| Dashboard is unavailable | Confirm the profile composes the Web app and use its printed listener address; Desktop uses an ephemeral port |
| Cards cannot be answered in the companion | Open/poll the surface before the request begins; a request may already have settled or delegated to the native answerer |
| Two Hosts share recap history | Give each Host its own `recap.directory`, or disable recap on one Host |
| A local checkout has moved | Update the installed entry to its current absolute path, then restart the owning Host |
