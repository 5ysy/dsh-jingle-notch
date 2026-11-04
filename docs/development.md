# Development and release preparation / 开发与发布准备

[English README](../README.md) · [中文 README](../README.zh.md) · [Installation](installation.md)

## Identity / 命名

| Purpose | Value |
| --- | --- |
| Product / 插件名称 | `JingleNotch` |
| Positioning / 功能定位 | `AI Agent Approval Notifier` |
| Character / IP 名称 | `鲸铃 Jingle` |
| Repository name / 仓库名 | `dsh-jingle-notch` |
| npm package | `dsh-jingle-notch` |
| Configured repository target | `github.com/5ysy/dsh-jingle-notch` |

The public repository is [5ysy/dsh-jingle-notch](https://github.com/5ysy/dsh-jingle-notch). The npm distribution is [dsh-jingle-notch](https://www.npmjs.com/package/dsh-jingle-notch). Users install compiled code through the Harness profile CLI; source builds and release checks are documented below.

The checkout is `dev_plugins/dsh-jingle-notch`. The Host service is `ctx.jingleNotch`; bundle row IDs are `jingle-notch`, `jingle-notch-dashboard`, `jingle-notch-autostart` and `jingle-notch-commands`. The command and HTTP root are `/jingle`, IPC channels use `jingle-notch:`, whale resources use `jingle-notch-whale://art`, runtime variables use `DSH_JINGLE_NOTCH_*` and test variables use `JINGLE_NOTCH_*`. Preferences and recap history belong to `dsh-jingle-notch` directories. No compatibility aliases or data imports are provided.

Third-party copyright and permission notices ship in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Build and tests / 构建与测试

Use Node >=24.9.0 and pnpm. The package uses the host Cordis and Schemastery peer dependencies and installs a matching Electron runtime for the native overlay.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
npm pack --dry-run
```

The compiled package exposes the Host service, dashboard and commands. It ships the Electron main/preload code and four original/poster whale files. Test-only routes, fixtures, screenshots of personal work, credentials and developer data must stay out of release artifacts. The public screenshots in `docs/images` come from synthetic integration fixtures.

## Real Host matrix / 真实宿主兼容测试

Run from the plugin checkout. At least one of the Desktop/source variables is required:

```sh
JINGLE_NOTCH_DSH_DESKTOP_APP='/Applications/DeepSeek Harness.app' \
JINGLE_NOTCH_DSH_SOURCE='/absolute/path/to/deepseek-harness' \
JINGLE_NOTCH_ELECTRON='/absolute/path/to/Electron.app/Contents/MacOS/Electron' \
pnpm test:harness
```

- `JINGLE_NOTCH_DSH_DESKTOP_APP`: actual packaged Desktop Host and that application's released Web runtime.
- `JINGLE_NOTCH_DSH_SOURCE`: built source Web CLI. Build Harness first; tests require `apps/cli/lib/bin.js`.
- `JINGLE_NOTCH_ELECTRON`: optional. Runs the production overlay through plugin auto-start, checks Host Session rendering, sandbox isolation, native Quit and continued Host availability. Omit to check disabled-overlay handling.
- `JINGLE_NOTCH_TEST_PACKAGE`: optional package path/tarball to install instead of the current checkout, for archive installation checks.

Every target uses a temporary `DSH_HOME` and official Web profile template. Desktop starts through its actual bundled Host entry with ready/shutdown IPC. The matrix installs `dsh-jingle-notch`, exercises `/jingle`, real agent/session/tool/diff events, approval service/audit, full plan and multi-select question answers, invalid/duplicate replies, dashboard CSP/Origin checks and clean teardown. It makes no model calls. The emitted evidence directory contains redacted logs and `results.json`.

Tests hold a simulated native answerer pending while driving HTTP answers; a human/model-driven conversation and all possible future Harness releases remain outside those assertions. The declared `dsh.compatibility.dshReleases` entries must match the concrete tested versions. The host's own installation gate uses `engines.dsh`/peer dependencies.

## Native interaction check / 原生交互测试

```sh
JINGLE_NOTCH_ELECTRON='/absolute/path/to/Electron.app/Contents/MacOS/Electron' \
pnpm test:electron
```

This exercises production main/preload/renderer against synthetic Cordis sessions: eight sessions, changing animation pixels, reduced motion, decode recovery, four visible session pills and scrolling, native hover/resize, request expansion/selection, settings, drafts, composition guards, full plans, multiple answers, approvals and Quit. It also verifies dashboard script execution under CSP and retained focus.

Useful variables: `JINGLE_NOTCH_SMOKE_SCREENSHOT` chooses the screenshot stem; `JINGLE_NOTCH_SMOKE_PACKAGE` points at an extracted package for overlay/artwork verification. Test automation uses the `JINGLE_NOTCH_*` namespace. For a manual input-source check, use `node tests/electron-smoke.mjs --ime` with a configured Electron executable.

## Archive verification / 打包验证

```sh
pnpm pack --out /absolute/path/to/dsh-jingle-notch-0.1.1.tgz
```

Inspect the archive and install it into disposable Desktop/Web profiles through the matrix with `JINGLE_NOTCH_TEST_PACKAGE`. Verify the manifest name, repository, icon, exact compatibility entries, bundle module references, exports, both READMEs, linked public documentation and local image paths. Test production assets from the extracted tarball with `JINGLE_NOTCH_SMOKE_PACKAGE` before release.

## Community listing / 社区目录

The [dsh-market application](https://github.com/dsh-market/dsh-market) reads its catalog from [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin). Its README directs plugin authors to that catalog for listing PRs. Once the public repository and package exist, follow the catalog's current contribution requirements and use this package's description, icon, README previews and verified compatibility data. This local change does not claim an existing listing or market endorsement.

Documentation references checked on 2026-11-02: [dsh-pet README](https://github.com/PC2005-cloud/dsh-pet), [dsh-market README](https://github.com/dsh-market/dsh-market/blob/main/README.zh.md), and the [official Harness plugin publication guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md). Each project's features and art remain its own; JingleNotch uses the author's supplied 鲸铃 Jingle assets.

## npm release / npm 发布

Authenticate with `npm login --auth-type=web`, then run the type checks, tests, build and archive verification above. Publish the exact verified tarball:

```sh
npm publish /absolute/path/to/dsh-jingle-notch-0.1.1.tgz --access public
npm view dsh-jingle-notch@0.1.1 version dist.integrity
```

Validate registry installation in disposable profiles through `JINGLE_NOTCH_TEST_PACKAGE=dsh-jingle-notch@0.1.1`. Keep authentication material outside the repository and archive. Tag the reviewed commit as `v0.1.1` and attach that same archive to its GitHub release.
