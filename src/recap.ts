/** Local, bounded activity aggregates. No prompts, file paths or source text are persisted. */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface WeekRecap { week: string; turns: number; toolCalls: number; errors: number; approvals: number; questions: number; activeMs: number }
export interface RecapSnapshot { weeks: WeekRecap[] }
type Counts = Omit<WeekRecap, 'week'>
const fields = ['turns','toolCalls','errors','approvals','questions','activeMs'] as const
const WEEK = 7 * 86400000
export class RecapStore {
  readonly ready: Promise<void>
  private readonly weeks = new Map<string, WeekRecap>()
  private readonly lastActive = new Map<string, number>()
  private timer?: ReturnType<typeof setTimeout>
  private writing: Promise<void> = Promise.resolve()
  private closed = false
  private ownsLock = false
  private readOnly = false
  private readonly file: string
  constructor(private readonly directory: string, private readonly log: (message: string) => void, private readonly clock = Date.now) {
    this.file = join(directory, 'recap.json')
    this.ready = this.load()
  }
  record(sessionId: string, delta: Partial<Counts>, now: number, active = true): void {
    if (this.closed) return
    const week = weekKey(now)
    if (week < weekKey(this.clock() - 11 * WEEK) || week > weekKey(this.clock() + WEEK)) return
    const entry = this.weeks.get(week) ?? { week, turns:0, toolCalls:0, errors:0, approvals:0, questions:0, activeMs:0 }
    for (const field of fields) entry[field] += Math.max(0, delta[field] ?? 0)
    const previous = this.lastActive.get(sessionId)
    if (previous !== undefined) entry.activeMs += Math.max(0, Math.min(60000, now - previous))
    this.lastActive.delete(sessionId)
    if (active) this.lastActive.set(sessionId, now)
    if (this.lastActive.size > 2048) this.lastActive.delete(this.lastActive.keys().next().value!)
    this.weeks.set(week, entry)
    this.prune()
    if (!this.timer) {
      this.timer = setTimeout(() => { this.timer = undefined; this.enqueue() }, 1000)
      this.timer.unref()
    }
  }
  forget(sessionId: string): void { this.lastActive.delete(sessionId) }
  snapshot(): RecapSnapshot { this.prune(); return { weeks:[...this.weeks.values()].sort((a,b) => a.week.localeCompare(b.week)).map(w => ({...w})) } }
  async close(): Promise<void> {
    this.closed = true
    clearTimeout(this.timer)
    await this.ready
    if (this.weeks.size) this.enqueue()
    await this.writing
    if (this.ownsLock) {
      try { await rm(join(this.directory, 'writer.lock')) } catch (error) { this.log(`jingleNotch recap: lock cleanup failed: ${String(error)}`) }
    }
  }
  private prune(): void {
    const cutoff = weekKey(this.clock() - 11 * WEEK)
    for (const key of this.weeks.keys()) if (key < cutoff) this.weeks.delete(key)
    while (this.weeks.size > 12) this.weeks.delete([...this.weeks.keys()].sort()[0])
  }
  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8')
      if (raw.length > 65536) throw new Error('history exceeds 64 KiB')
      const data: unknown = JSON.parse(raw)
      if (typeof data !== 'object' || data === null || (data as {version?:unknown}).version !== 1 || !Array.isArray((data as RecapSnapshot).weeks)) throw new Error('invalid history schema')
      const weeks = (data as RecapSnapshot).weeks
      if (weeks.length > 12 || !weeks.every(w => typeof w === 'object' && w !== null && /^\d{4}-\d{2}-\d{2}$/u.test(w.week)
        && Object.keys(w).every(k => k === 'week' || fields.includes(k as keyof Counts))
        && fields.every(k => Number.isSafeInteger(w[k]) && w[k] >= 0))) throw new Error('invalid aggregate counters')
      for (const w of weeks) {
        const entry = this.weeks.get(w.week)
        if (entry) for (const field of fields) entry[field] += w[field]
        else this.weeks.set(w.week, { ...w })
      }
      this.prune()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.log(`jingleNotch recap: cannot load history: ${String(error)}`)
    }
  }
  private enqueue(): void { this.writing = this.writing.then(() => this.save()) }
  private async save(): Promise<void> {
    await this.ready
    if (this.readOnly) return
    const temporary = `${this.file}.${randomUUID()}.tmp`
    try {
      await mkdir(this.directory, { recursive:true, mode:0o700 })
      if (!this.ownsLock) {
        const lock = join(this.directory, 'writer.lock')
        try { await writeFile(lock, String(process.pid), { flag:'wx', mode:0o600 }); this.ownsLock = true }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          const owner = Number(await readFile(lock, 'utf8'))
          let alive = Number.isSafeInteger(owner) && owner > 0
          if (alive) { try { process.kill(owner, 0) } catch (e) { alive = (e as NodeJS.ErrnoException).code !== 'ESRCH' } }
          if (alive) { this.readOnly = true; throw new Error('another host owns this recap directory; configure a separate recap.directory') }
          await rm(lock)
          await writeFile(lock, String(process.pid), { flag:'wx', mode:0o600 }); this.ownsLock = true
        }
      }
      await writeFile(temporary, JSON.stringify({ version:1, ...this.snapshot() }), { mode:0o600, flag:'wx' })
      await rename(temporary, this.file)
    } catch (error) {
      this.log(`jingleNotch recap: cannot save history: ${String(error)}`)
      await rm(temporary, { force:true }).catch(e => this.log(`jingleNotch recap: temporary cleanup failed: ${String(e)}`))
    }
  }
}
function weekKey(now: number): string {
  const date = new Date(now)
  date.setUTCHours(0,0,0,0)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0,10)
}
