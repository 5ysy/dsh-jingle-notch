// Exercise published Desktop/Web and built source Web without touching user profiles.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'

const plugin = process.env.JINGLE_NOTCH_TEST_PACKAGE ?? fileURLToPath(new URL('../', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/harness-probe.mjs', import.meta.url))
const prepare = fileURLToPath(new URL('./fixtures/harness-profile.mjs', import.meta.url))
const overlayFixture = fileURLToPath(new URL('./fixtures/harness-overlay.cjs', import.meta.url))
const root = mkdtempSync(join(tmpdir(), 'dsh-jingle-notch-host-matrix-'))
const desktop = process.env.JINGLE_NOTCH_DSH_DESKTOP_APP
const source = process.env.JINGLE_NOTCH_DSH_SOURCE
const electron = process.env.JINGLE_NOTCH_ELECTRON
if (electron) assert.ok(existsSync(electron), 'JINGLE_NOTCH_ELECTRON executable is missing')
if (!desktop && !source) throw new Error('Set JINGLE_NOTCH_DSH_DESKTOP_APP and/or JINGLE_NOTCH_DSH_SOURCE; see README.')
const targets = []
if (desktop) {
  const app = resolve(desktop)
  const resources = join(app, 'Contents/Resources')
  const runtime = join(resources, 'app.asar/dsh')
  const node = join(app, 'Contents/MacOS/DeepSeek Harness')
  const cli = join(resources, 'runtime/cli/bin/dsh')
  assert.ok(existsSync(node) && existsSync(cli), 'Desktop application runtime is missing')
  for (const profile of ['desktop', 'web']) targets.push({
    name: `released-${profile}`, profile, node, runtime, cli,
    modules: join(runtime, 'node_modules'), nodeArgs: ['--expose-internals'],
    primary: join(resources, 'runtime/primary-runtime'),
    nodeEnv: { ELECTRON_RUN_AS_NODE: '1' },
  })
}
if (source) {
  const runtime = join(resolve(source), 'apps/cli')
  assert.ok(existsSync(join(runtime, 'lib/bin.js')), 'Build the Harness source before running this check')
  targets.push({ name: 'source-web', profile: 'web', node: process.execPath, runtime,
    cli: join(runtime, 'lib/bin.js'), modules: join(runtime, 'node_modules'), nodeArgs: [], nodeEnv: {} })
}
const redact = value => String(value).replace(/([?&]token=)[^\s&]+/gu, '$1<redacted>')
async function command(binary, args, environment, cwd) {
  const child = spawn(binary, args, { env: environment, cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', value => { output += value })
  child.stderr.on('data', value => { output += value })
  const timer = setTimeout(() => child.kill('SIGTERM'), 120_000)
  try {
    const [code] = await once(child, 'exit')
    assert.equal(code, 0, redact(output.slice(-6000)))
    return output
  } finally { clearTimeout(timer) }
}
async function request(origin, path, body, headers = {}) {
  const response = await fetch(origin + path, {
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
    headers: { 'content-type': 'application/json', ...headers }, signal: AbortSignal.timeout(15_000),
  })
  return { response, text: await response.text() }
}
async function json(origin, path, body) {
  const { response, text } = await request(origin, path, body)
  assert.equal(response.status, 200, `${path}: ${text}`)
  return JSON.parse(text)
}
async function until(read, accept) {
  for (let i = 0; i < 100; i++) {
    const value = await read()
    if (accept(value)) return value
    await pause(50)
  }
  throw new Error('Host state did not settle within five seconds')
}
const results = []
console.log(`Isolated evidence: ${root}`)
for (const target of targets) {
  const cwd = join(root, target.name)
  mkdirSync(cwd)
  const overlayDirectory = join(cwd, 'overlay')
  const wrapper = join(cwd, 'electron-test-wrapper')
  if (electron) {
    mkdirSync(overlayDirectory)
    writeFileSync(wrapper, '#!/bin/sh\nexec "$JINGLE_NOTCH_ELECTRON" "$JINGLE_NOTCH_TEST_OVERLAY_FIXTURE" "$@"\n', { mode: 0o700 })
  }
  const home = join(cwd, 'home')
  const environment = { ...process.env, ...target.nodeEnv, DSH_HOME: home,
    DSH_AGENTS_HOME: join(cwd, '.agents'), DSH_TELEMETRY_DISABLED: '1',
    JINGLE_NOTCH_TEST_MODULES: target.modules, DEEPSEEK_API_KEY: 'keyless-compatibility-fixture',
    JINGLE_NOTCH_TEST_ELECTRON: electron ? wrapper : '', JINGLE_NOTCH_TEST_OVERLAY_FIXTURE: overlayFixture,
    JINGLE_NOTCH_TEST_OVERLAY_DIRECTORY: overlayDirectory }
  // Avoid inheriting an Electron mode flag when testing source Node.
  if (!target.nodeEnv.ELECTRON_RUN_AS_NODE) delete environment.ELECTRON_RUN_AS_NODE
  await command(target.node, [...target.nodeArgs, prepare, target.modules, home, target.profile, fixture], environment, cwd)
  const cliCommand = target.nodeEnv.ELECTRON_RUN_AS_NODE ? target.cli : target.node
  const cliArgs = target.nodeEnv.ELECTRON_RUN_AS_NODE ? [] : [target.cli]
  const version = (await command(cliCommand, [...cliArgs, '--version'], environment, cwd)).trim()
  const installed = await command(cliCommand, [...cliArgs, 'plugin', '--profile', target.profile, 'add', plugin], environment, cwd)
  writeFileSync(join(cwd, 'install.log'), redact(installed))
  const profileDir = join(home, 'profiles', target.profile)
  const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
  assert.ok(manifest.dsh.profile.bundles.includes('dsh-jingle-notch'))
  const args = target.profile === 'desktop'
    ? [...target.nodeArgs, join(target.modules, '@deepseek-ai/dsh-desktop-host/lib/index.js'), target.runtime, profileDir, target.primary]
    : [...cliArgs, '--profile', 'web', '--no-open', '--host', '127.0.0.1', '--port', '0']
  const child = spawn(target.profile === 'desktop' ? target.node : cliCommand, args, {
    cwd: profileDir, env: environment,
    stdio: ['ignore', 'pipe', 'pipe', ...(target.profile === 'desktop' ? ['ipc'] : [])],
  })
  let output = '', ready, fatal, closed = false
  child.stdout.on('data', value => { output += value })
  child.stderr.on('data', value => { output += value })
  child.on('message', message => {
    if (message.type === 'ready') ready = message.url
    if (message.type === 'fatal') fatal = message.diagnostic ?? message.message
    if (message.type === 'shutdown-complete') closed = true
  })
  const exited = once(child, 'exit')
  try {
    for (let i = 0; i < 450; i++) {
      if (fatal) throw new Error(redact(fatal))
      assert.equal(child.exitCode, null, redact(output.slice(-6000)))
      ready ??= output.match(/dsh web: (http:\/\/[^\s]+)/u)?.[1]
      if (ready) break
      await pause(100)
    }
    assert.ok(ready, `Host startup timeout: ${redact(output.slice(-6000))}`)
    const origin = new URL(ready).origin
    const page = await request(origin, '/jingle')
    assert.equal(page.response.status, 200)
    assert.match(page.response.headers.get('content-security-policy'), /default-src 'none'/u)
    assert.match(page.text, /JingleNotch/u)
    const crossSite = await request(origin, '/jingle/api/state', undefined, { origin: 'https://example.invalid' })
    assert.equal(crossSite.response.status, 403)
    const setup = await json(origin, '/__jingle-notch-host-test/setup', {})
    assert.ok(setup.bundles.includes('@deepseek-ai/dsh-web-app'))
    await json(origin, '/jingle/api/state')
    await json(origin, '/__jingle-notch-host-test/approval', {})
    const approval = await until(() => json(origin, '/jingle/api/state'), state => state.approvals.length > 0)
    const id = approval.approvals[0].id
    await json(origin, `/jingle/api/approvals/${encodeURIComponent(id)}`, { decision: 'allowed-once' })
    await until(() => json(origin, '/__jingle-notch-host-test/result', {}), result => result.outcomes.approval)
    assert.equal((await request(origin, `/jingle/api/approvals/${encodeURIComponent(id)}`, { decision: 'always' })).response.status, 404)
    await json(origin, '/__jingle-notch-host-test/question', {})
    const state = await until(() => json(origin, '/jingle/api/state'), value => value.questions.length > 0)
    assert.match(state.questions[0].questions[0].detail, /END OF PLAN/u)
    const questionPath = '/jingle/api/questions/jingle-notch-host-compat/compat-plan'
    assert.equal((await request(origin, questionPath, { answers: [] })).response.status, 404)
    await json(origin, questionPath, { answers: [
      { id: 'plan', selected: ['Approve "exact" plan'] }, { id: 'checks', selected: ['Types', 'Tests'] },
    ] })
    await until(() => json(origin, '/__jingle-notch-host-test/result', {}), result => result.outcomes.question)
    const evidence = await json(origin, '/__jingle-notch-host-test/finish', {})
    if (electron) {
      await json(origin, '/__jingle-notch-host-test/overlay', {})
      const resultFile = join(overlayDirectory, 'result.json')
      for (let i = 0; i < 300 && !existsSync(resultFile); i++) await pause(100)
      assert.ok(existsSync(resultFile), 'Production overlay did not exit through its Quit button')
      assert.deepEqual(JSON.parse(readFileSync(resultFile, 'utf8')), { ok: true, exited: true })
      await json(origin, '/jingle/api/state')
    } else {
      const overlay = await request(origin, '/jingle/api/overlay', {})
      assert.equal(overlay.response.status, 409)
    }
    results.push({ target: target.name, version, ok: evidence.ok, checks: [
      'official-plugin-install', 'profile-bundle-gate', 'dashboard-csp', 'cross-origin-rejection',
      'real-agent-session-events', 'tool-result-diffs', 'slash-commands', 'approval-service-audit',
      'duplicate-approval-rejection', 'question-service-plan-and-multiselect', 'incomplete-answer-rejection',
      'finished-session', electron ? 'native-overlay-launch-state-isolation-quit-host-survives' : 'overlay-disabled-config',
    ] })
    console.log(`${target.name} ${version}: passed`)
  } catch (error) {
    console.error(redact(output.slice(-6000)))
    throw error
  } finally {
    if (child.exitCode === null) {
      if (child.connected) child.send({ type: 'shutdown' })
      else child.kill('SIGTERM')
    }
    let timer
    try {
      await Promise.race([exited, new Promise((_, reject) => {
        timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Host shutdown timeout')) }, 15_000)
      })])
    } finally {
      clearTimeout(timer)
      writeFileSync(join(cwd, 'host.log'), redact(output))
    }
    assert.equal(child.exitCode, 0, 'Host did not shut down cleanly')
    if (target.profile === 'desktop') assert.equal(closed, true, 'Desktop IPC shutdown was not acknowledged')
  }
}
writeFileSync(join(root, 'results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results, null, 2))
