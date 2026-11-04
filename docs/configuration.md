# Configuration / 配置

[English README](../README.md) · [中文 README](../README.zh.md) · [Installation / 安装](installation.md)

## Profile file / 配置文件

Use `$DSH_HOME/profiles/<profile>/cordis.patch.yml`; `DSH_HOME` defaults to `~/.dsh`. The built-in profile names are `web` and application-owned `desktop`. Configure the `jingle-notch` row by ID. It provides the `jingleNotch` service.

```yaml
- id: jingle-notch
  config:
    overlay:
      enabled: true
      electronPath: ''
      yOffset: 0
    notifications:
      enabled: true
      onApproval: true
      onQuestion: true
      onTurnEnd: false
    sounds:
      enabled: true
      onApproval: true
      onQuestion: true
      onFinish: true
      file: ''
    autoAllowTools: []
    recap:
      enabled: true
      directory: ''
    tickerSize: 30
    finishedHoldMs: 5000
```

The example shows the defaults. The overlay launches automatically when the plugin row is enabled. Restart the corresponding Host after editing. A configuration patch needs no `name` field; if supplied, use `name: dsh-jingle-notch`. A patch replaces that row's config object; omitted settings are filled from the plugin schema defaults.

默认配置如上。启用插件后浮窗会随 Host 自动启动。修改后重启对应宿主。配置 ID 为 `jingle-notch`；配置补丁可以省略 `name`。

## Options / 选项

| Key | Default | Effect |
| --- | --- | --- |
| `overlay.enabled` | `true` | Allow the enabled plugin to launch Electron |
| `overlay.autoStart` | `true` | Deprecated compatibility setting; startup follows the plugin switch |
| `overlay.electronPath` | `''` | Explicit executable; empty uses the plugin's local Electron then npx |
| `overlay.yOffset` | `0` | Integer pixels from the display top; range -200…200 |
| `notifications.enabled` | `true` | Master switch for system notifications |
| `notifications.onApproval` | `true` | Notify for pending tool approval |
| `notifications.onQuestion` | `true` | Notify for questions and plan review |
| `notifications.onTurnEnd` | `false` | Notify for turn completion/failure |
| `sounds.enabled` | `true` | Master switch for chimes |
| `sounds.onApproval` / `onQuestion` / `onFinish` | `true` | Select the events that play sounds |
| `sounds.file` | `''` | Custom audio path; empty uses platform sounds |
| `autoAllowTools` | `[]` | Exact tool names or trailing-`*` prefixes to approve automatically |
| `recap.enabled` | `true` | Store numeric activity aggregates for twelve weeks |
| `recap.directory` | `''` | Empty uses `~/.local/share/dsh-jingle-notch` |
| `tickerSize` | `30` | Activity entries retained per session; 1…500 |
| `finishedHoldMs` | `5000` | Completion/error highlight duration; 0…86,400,000 ms |

## Notch behavior / 浮窗设置

Open the sliders button in the expanded overlay. Its controls persist locally:

- Open on hover.
- Auto-close after 5/10/15/30/60 seconds, or never.
- Hide when inactive after 1/3/5 minutes, or never.
- Expand for new requests; enabled by default.

悬停预览离开后有短暂缓冲；点击打开的面板使用设置中的关闭计时，鼠标停留在面板上也会计时。设置页和正在编辑的回复会保持展开。新的可回答请求会自动选中所属 session。系统开启减少动态效果时，角色使用静态首帧。

The overlay follows the primary display and reserves its physical notch center. Overview width is 615 logical pixels; the right-hand session list shows four complete pills and scrolls internally. Details/forms can grow taller with bounded scrolling. Preferences are strictly validated and written atomically.

## Approvals and questions / 审批与问答

An actively polling dashboard/overlay receives requests alongside the native Harness answerer. The first completed answer wins. A later surface submission is rejected. With no active companion, requests delegate immediately. After six seconds without polling, pending companion waits withdraw while the already-running native answerer continues.

- **Allow once** authorizes the current request.
- **Deny** rejects it.
- **Always in this session** grants future requests for the same tool in that session only after accepting the current request. It does not persist a global policy.
- `autoAllowTools` grants real matching tool operations before an interactive answer. Keep the empty default for per-request review.
- Questions support exact option labels, multiple selections, custom text, explicit skip and complete batch submission. Plans retain full detail and the offered approval label.
- Timed questions can remain visible after a turn ends; a late answer is queued through Harness's user-question service. A discarded reply can be submitted again.

浮窗随启用的插件自动启动，后台浏览器标签可能限制轮询频率，原生浮窗会持续轮询。权限判断与最终执行仍由 Harness 的宿主服务负责；原请求的 AbortSignal 和 agent 生命周期由 Harness 管理。

## Storage and privacy / 存储与隐私

| Data | Location / retention |
| --- | --- |
| Recap history | `~/.local/share/dsh-jingle-notch` by default; twelve weeks of numeric UTC-week aggregates |
| macOS overlay preferences | `~/Library/Application Support/dsh-jingle-notch/overlay-preferences.json` |
| Activity and file previews | Bounded in-memory state for the running Host |

Both directories belong to JingleNotch. Other application data is not imported. Recap stores no prompts, paths, source code, credentials or session identifiers. Multiple Hosts must use separate recap directories; a directory supports one writer. Disabling recap stops reads/writes and leaves existing files available for manual removal.

File previews keep the latest 20 files per session and at most 32 KiB per preview. Large-file counts are marked as estimates or omitted previews. Distinct-file statistics cap at 2,048 paths. Repeated edits accumulate added/removed lines; activity minutes accumulate per session with a one-minute cap per adjacent-event interval.

System notification text may contain tool names, approval reasons or a question. Disable `notifications.enabled` to suppress it. The plugin does not add a telemetry service or an additional model request. Character images load from packaged resources. The plugin installs a matching Electron runtime so Desktop can launch the overlay as a separate application; Web/source Hosts may use the npx fallback to download a runtime. Remote dashboard access uses the Harness connection service's admission checks. Loopback access checks Host/Origin; local processes able to reach the listener remain within the local trust boundary.

浮窗通过固定 preload IPC 操作审批与问答，renderer 无 Node 访问，启用 sandbox/contextIsolation/CSP。仪表盘只提供当前宿主的状态与操作；本地状态和通知中可能出现工作内容，请根据使用环境选择开关。
