/** Schemastery schema and resolved type for the jingleNotch engine plugin. */
import z from '@deepseek-ai/schemastery'

export interface JingleNotchConfig {
  notifications: {
    enabled: boolean
    onApproval: boolean
    onQuestion: boolean
    onTurnEnd: boolean
  }
  sounds: {
    enabled: boolean
    onApproval: boolean
    onQuestion: boolean
    onFinish: boolean
    file?: string
  }
  /**
   * Tool names approved without asking — jingleNotch's "Always" button as config.
   * Exact names, or a prefix pattern ending in `*`.
   */
  autoAllowTools: string[]
  recap?: { enabled: boolean; directory?: string }
  /** Notch overlay (Electron pill strip) options. */
  overlay: {
    /** Whether enabling the plugin may spawn the native Electron overlay. */
    enabled: boolean
    /** Retained for profile compatibility; the overlay now starts whenever the plugin is enabled. */
    autoStart: boolean
    /** Explicit Electron binary; empty resolves the plugin's local Electron, then `npx`. */
    electronPath: string
    /** Pixels from the top edge of the display to pin the strip. */
    yOffset: number
  }
  /** Milliseconds a finished or failed pill stays highlighted before idling. */
  finishedHoldMs: number
  /** Entries kept per session ticker. */
  tickerSize: number
}

export const JingleNotchConfigSchema: z<JingleNotchConfig> = z.object({
  notifications: z
    .object({
      enabled: z.boolean().default(true).description('Master switch for desktop notifications.'),
      onApproval: z.boolean().default(true).description('Notify when an approval request waits.'),
      onQuestion: z.boolean().default(true).description('Notify when the agent asks a question.'),
      onTurnEnd: z.boolean().default(false).description('Notify when a turn completes or fails.'),
    })
    .default({
      enabled: true,
      onApproval: true,
      onQuestion: true,
      onTurnEnd: false,
    }),
  sounds: z
    .object({
      enabled: z.boolean().default(true).description('Master switch for chimes.'),
      onApproval: z.boolean().default(true).description('Chime when an approval request waits.'),
      onQuestion: z.boolean().default(true).description('Chime when the agent asks a question.'),
      onFinish: z.boolean().default(true).description('Chime when a turn completes.'),
      file: z.string().description('Play this audio file instead of the platform system sounds.').default(''),
    })
    .default({
      enabled: true,
      onApproval: true,
      onQuestion: true,
      onFinish: true,
      file: '',
    }),
  recap: z.object({ enabled:z.boolean().default(true), directory:z.string().default('') }).default({enabled:true,directory:''}),
  autoAllowTools: z.array(z.string()).default([]).description('Tool names (or prefix* patterns) approved without asking.'),
  overlay: z
    .object({
      enabled: z.boolean().default(true).description('Allow the notch overlay to launch.'),
      autoStart: z.boolean().default(true).description('Deprecated compatibility setting; the overlay starts when the plugin is enabled.'),
      electronPath: z.string().default('').description('Electron binary; empty resolves the plugin local Electron, then npx.'),
      yOffset: z.number().step(1).min(-200).max(200).default(0).description('Pixels from the top edge of the display to pin the strip.'),
    })
    .default({
      enabled: true,
      autoStart: true,
      electronPath: '',
      yOffset: 0,
    }),
  finishedHoldMs: z.number().step(1).min(0).max(86_400_000).default(5000).description('How long a finished or failed pill stays highlighted.'),
  tickerSize: z.number().step(1).min(1).max(500).default(30).description('Entries kept per session activity ticker.'),
})
