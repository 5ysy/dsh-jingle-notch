/**
 * Decision channel between the `approval/request` answerer and surface UIs
 * (the notch overlay, the dashboard page). A UI claims a pending decision
 * through {@link OverlayApprovals.answer}; the answerer races that promise
 * against `next()`, so whichever human surface answers first wins and the
 * others release cleanly — the same coexistence dsh's own web answerer has
 * with its remote participants.
 */

/** Decisions a surface UI can submit for a pending approval. */
export type OverlayDecision = 'allowed-once' | 'rejected' | 'always'

interface PendingEntry {
  /** Outcome submitted through {@link OverlayApprovals.answer}, if any. */
  resolve: (decision: Exclude<OverlayDecision, 'always'>) => void
  cleanup: () => void
}

/** Pending overlay decisions keyed by the approval's surface id. */
export class OverlayApprovals {
  private readonly pending = new Map<string, PendingEntry>()

  /** Number of approvals currently waiting on a surface UI. */
  get size(): number {
    return this.pending.size
  }

  /**
   * Wait for a surface UI to answer this approval id. The returned promise
   * settles with the submitted decision, or `'cancelled'` when the request's
   * abort signal fires first — the withdrawal outcome dsh itself assigns.
   * @param id - decision id of the pending approval.
   * @param signal - the request's abort signal, when the asker supplies one.
   */
  wait(id: string, signal: AbortSignal | undefined): Promise<'allowed-once' | 'rejected' | 'cancelled'> {
    return new Promise((resolve) => {
      let entry: PendingEntry | undefined
      const settle = (decision: 'allowed-once' | 'rejected' | 'cancelled') => {
        if (entry === undefined) return
        this.pending.delete(id)
        signal?.removeEventListener('abort', onAbort)
        entry = undefined
        resolve(decision)
      }
      const onAbort = (): void => settle('cancelled')
      this.pending.get(id)?.cleanup()
      if (signal?.aborted) {
        resolve('cancelled')
        return
      }
      entry = {
        resolve: (decision) => settle(decision),
        cleanup: () => settle('cancelled'),
      }
      this.pending.set(id, entry)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  /**
   * Submit a surface decision for one pending approval.
   * @returns whether a pending approval with this id was still waiting.
   */
  answer(id: string, decision: OverlayDecision): boolean {
    const entry = this.pending.get(id)
    if (entry === undefined) return false
    entry.resolve(decision === 'always' ? 'allowed-once' : decision)
    return true
  }

  /** Drop one pending entry without a submitted decision, as when another answerer claimed it. */
  cancel(id: string): void {
    this.pending.get(id)?.cleanup()
  }

  /** Drop every pending entry; the owner calls this on unload. */
  dispose(): void {
    this.cancelAll()
  }

  /** Cancel all surface waits when the overlay process disappears. */
  cancelAll(): void {
    for (const entry of [...this.pending.values()]) entry.cleanup()
    this.pending.clear()
  }
}
