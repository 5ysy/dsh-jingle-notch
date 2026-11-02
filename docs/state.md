# JingleNotch implementation state

Updated: 2026-11-02. Checkout: `dev_plugins/dsh-jingle-notch`. Version 0.1.0 is public on npm and GitHub Releases; main, registry integrity and actual registry installation are verified. Release work is complete.

## Identity and runtime contracts

- Product: JingleNotch; repository/npm: dsh-jingle-notch; character: 鲸铃 Jingle; positioning: AI Agent Approval Notifier.
- Service/types: `ctx.jingleNotch`, `JingleNotchService`, `JingleNotchConfig`, `JingleNotchSnapshot`.
- Bundle rows: `jingle-notch`, `jingle-notch-dashboard`, `jingle-notch-commands`.
- Command: `/jingle`, `/jingle overlay`, `/jingle overlay stop`; HTTP: `/jingle` and `/jingle/api/*`.
- Native bridge: `window.jingleNotch`; shared renderer: `window.JingleNotchSurface`; IPC: `jingle-notch:*`; assets: `jingle-notch-whale://art`.
- Runtime environment: `DSH_JINGLE_NOTCH_*`; test environment: `JINGLE_NOTCH_*`.
- macOS preferences: `~/Library/Application Support/dsh-jingle-notch/overlay-preferences.json`; recap default: `~/.local/share/dsh-jingle-notch`.
- No command alias, compatibility row, route redirect, environment fallback or data import. Directory moves require updating existing local package links.
- Artwork originals: `dev_docs/dsh-jingle-notch`; supplied animations and checksums remain unchanged. MIT copyright/permission for third-party references is retained in the packaged notice.

## Decisions and baseline

- Scope includes source, built artifacts, unit/native/Host fixtures, metadata and all public docs. No dependency or lockfile change is intended.
- Existing user profiles, stored sessions/preferences and running applications are not modified. Verification uses isolated temporary profiles and synthetic sessions with no model calls.
- Baseline and historical engineering evidence: `/var/folders/s1/qy1f70fs1897ny9jlylx_b6c0000gn/T/jingle-notch-namespace-baseline-20261102.0af86t_l/plugin`.
- The public repository is `5ysy/dsh-jingle-notch`. npm name check on 2026-11-02 returned 404 before publication. The user authorized public GitHub and npm publication; CLI authentication is complete.

## Verification

- Regression checks first failed on the unwanted second command, missing `/jingle` HTTP endpoint and incorrect row name in the generated configuration hint. All pass after the namespace update.
- Final `pnpm typecheck`, `pnpm test` (18 files, 116 tests) and `pnpm build` pass. No dependencies were added; the lockfile is byte-identical to the baseline.
- Installed the tarball through actual official CLI commands in three disposable profiles: packaged macOS Desktop `0.2.1-rc.5`, released Web `0.2.1-rc.5`, source Web `0.2.2-alpha.2` at `ce7073d`. All pass installation/bundle gates, new service/commands/routes, real agent/session/tool/diff events, approval service/audit, duplicate rejection, complete plans and multi-select answers, incomplete-answer rejection, CSP/Origin fences, native overlay launch/isolation/quit and continued Host availability. No model request or human-driven chat was exercised.
- Detailed extracted-package Electron smoke passes: animation frame changes, reduced motion and decode recovery, eight sessions/four visible pills with scrolling, stable colors/sorting, native hover/resize/settings, new-request expansion and selection, composition/draft retention, complete plan and structured answer/approval delivery, dashboard CSP/focus, clean Quit and Host survival. The preferences assertion reads `dsh-jingle-notch/overlay-preferences.json` in the isolated app-data root. Final screenshot was visually inspected.
- The final archive contains 25 files and 38 valid local documentation/image links, including the full third-party MIT notice. Tests, internal state documents and development assets are excluded. Retired identifiers are absent from project text, generated output and packed text. The final archive differs from the native/Host-tested archive only in the reviewed sound-module documentation comment; executable code and every other packed file are byte-identical.
- Required root `uv run pytest` failed collection with 21 unrelated Python SDK import errors. `uv run ruff .` could not start because Ruff is unavailable. No Python source or dependency was changed. Only the test-generated upstream bytecode was removed.
- Reviewed source/doc/test diffs, package allowlisting, unchanged trust boundaries, whitespace and common credential patterns. The nested Harness checkout remains clean. The plugin and artwork directories remain untracked by the parent repository; existing prompt edits were preserved.

## Evidence

- Host matrix: `/var/folders/s1/qy1f70fs1897ny9jlylx_b6c0000gn/T/dsh-jingle-notch-host-matrix-ZFlwS4/results.json`; command log `/tmp/jingle-notch-namespace-hosts.log`.
- Native check: `/tmp/jingle-notch-namespace-native.log`; screenshot `/tmp/jingle-notch-namespace.png` and associated overview/working/frame captures.
- Final archive: `/tmp/dsh-jingle-notch-namespace-0.1.0.tgz`; package audit and SHA-256: `/tmp/jingle-notch-namespace-package-evidence.json`; pack log `/tmp/jingle-notch-namespace-pack.log`.
- Regression failures: `/tmp/jingle-notch-namespace-red.log`, `/tmp/jingle-notch-namespace-snippet-red.log`; review diff `/tmp/jingle-notch-namespace-review.diff`.
- Required Python checks: `/tmp/jingle-notch-namespace-pytest.log`, `/tmp/jingle-notch-namespace-ruff.log`.

## Public release · 2026-11-02

- Both READMEs now lead with npm installation for Desktop/Web and include plugin features, synthetic previews, npm/license badges, compatibility, commands and contribution links. Installation/development guides match registry distribution. Source build instructions belong to development documentation.
- Runtime source, dependencies and lockfile are unchanged in this release preparation. No credentials were added. Reviewed dashboard origin/admission checks, JSON validation/body limits, escaped or text-only rendering, sandbox/CSP, fixed IPC and sender checks, preference validation and package contents.
- Fresh verification: `pnpm typecheck`, `pnpm test` (18 files / 116 tests), `pnpm build` all pass. Packed official Desktop 0.2.1-rc.5, released Web 0.2.1-rc.5 and source Web 0.2.2-alpha.2 pass installation, approval/question service, duplicate/invalid response rejection, origin/CSP, real session/tool/diff events and native lifecycle checks in disposable profiles. No model calls or user profile changes.
- Extracted-package native smoke passes animation/reduced motion/decode recovery, eight sessions/four visible pills, scrolling, settings, draft/composition retention, full plans/multi-select answers, approval submission, sandbox isolation, Quit and continued Host availability. Screenshot visually inspected.
- Release tarball contains 25 allowlisted files and 32 valid local documentation links. SHA-256: `71889799f1a9b718a488d25103fdc4c0a740e045b43430a2fa822f0bfdde195d`. Credential-pattern scan found no embedded credentials.
- Required workspace `uv run pytest` reports 21 upstream Python SDK collection errors from unavailable `deepseek_harness` / `deepseek_harness_runtime` modules. `uv run ruff .` cannot launch because Ruff is unavailable. No Python implementation changes are part of the release.
- Evidence: `/tmp/jingle-notch-release-20261102/{host-matrix.log,native.log,audit.json}`; Host results: `/var/folders/s1/qy1f70fs1897ny9jlylx_b6c0000gn/T/dsh-jingle-notch-host-matrix-QmDLev/results.json`.
- GitHub: public main pushed successfully using the authorized 5ysy account. Runtime, tests and documentation are separate Conventional Commits. Repository description, homepage and discovery topics are configured. Local origin uses a username-qualified HTTPS URL to avoid the machine-wide HTTPS-to-SSH rewrite selecting another GitHub identity.
- npm: the owner enabled 2FA and authorized the publish operation. Public registry now exposes dsh-jingle-notch@0.1.0 with latest=0.1.0. Its SHA-1 and SHA-512 integrity match the uploaded archive; a fresh `npm pack dsh-jingle-notch@0.1.0` download is byte-identical (SHA-256 above). npm displays README.zh.md and its installation/features sections match the committed file.
- Published-registry installation passes the same complete Desktop/Web/source matrix with `JINGLE_NOTCH_TEST_PACKAGE=dsh-jingle-notch@0.1.0`, including native overlay and Host survival. Evidence: `/tmp/jingle-notch-release-20261102/registry-host-matrix.log`; results: `/var/folders/s1/qy1f70fs1897ny9jlylx_b6c0000gn/T/dsh-jingle-notch-host-matrix-wc6yUT/results.json`.
- Production dependency audit reports no runtime dependencies to audit; Cordis/Schemastery are host peer dependencies. The source/security checks and Host admission/isolation tests provide the relevant plugin evidence.
- Release artifact: public GitHub v0.1.0 (non-draft, non-prerelease) uses the same verified archive; the uploaded asset SHA-256 digest matches the npm tarball. Annotated tag v0.1.0 points to release-verification commit ef3fc88. URLs: https://github.com/5ysy/dsh-jingle-notch/releases/tag/v0.1.0 and https://www.npmjs.com/package/dsh-jingle-notch. No release steps remain pending.

## Contributor attribution · 2026-11-02

- Updated the project MIT copyright holder from `JingleNotch contributors` to `5ysy` at the owner's request. Third-party copyright notices retain their original attribution. No runtime, dependency or version changes.
- Verified the exact LICENSE attribution, retained third-party attribution and `git diff --check`. Required workspace Python checks were attempted again: pytest still encounters upstream SDK import errors during collection, and Ruff is unavailable. Logs: `/tmp/jingle-notch-attribution-pytest.log` and `/tmp/jingle-notch-attribution-ruff.log`.

## GitHub contribution attribution · 2026-11-02

- Root cause: all seven initial commits and the annotated release tag inherited the machine-wide 9yly Git identity, so GitHub associated them with that account. LICENSE attribution alone does not change commit attribution.
- Configured this repository's author and committer as `5ysy <279584877+5ysy@users.noreply.github.com>` using the public GitHub account ID. Rewrote those seven commits and the annotated v0.1.0 tag to that identity, preserving each commit's file tree, message and timestamps. Future commits use the repository-local identity.
- Verified every rewritten commit tree against its original and retained an external bundle plus SHA mapping in `/tmp/jingle-notch-github-attribution-20261102`. Synchronization uses atomic updates with explicit force-with-lease expectations for main and v0.1.0.
- Required workspace Python commands were attempted: pytest still reports 21 upstream SDK collection errors, and Ruff is unavailable. Source content is identical throughout the history rewrite; only this state record changes after it.
