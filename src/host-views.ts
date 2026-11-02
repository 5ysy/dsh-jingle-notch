/**
 * Structural views of the host services this package's surface rows consume
 * (`ctx.webServer` from `@deepseek-ai/dsh-host-webserver`, `ctx.commands`
 * from `@deepseek-ai/dsh-commands`), declared through module augmentation so
 * the package typechecks standalone. The built bundle carries no type
 * information, so the host runtime never sees these spellings.
 */
import type { Context } from '@deepseek-ai/cordis'

/** One named HTTP route on the host webserver. */
export interface WebRouteLike {
  kind: 'exact' | 'prefix'
  /** Absolute pathname, no trailing slash. */
  path: string
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void | Promise<void>
}

/** The webserver face the dashboard uses: named-route registration and origin. */
export interface WebServerLike {
  register(route: WebRouteLike): () => void
  /** Root URL local clients reach the bound listener by, for example `http://127.0.0.1:3080`. */
  getOrigin(): string
}

/** Browser/API admission provided by dsh's connection service. */
export interface ConnectionLike {
  admit(request: import('node:http').IncomingMessage): { peer: unknown } | { rejection: number }
}

/** Invocation handed to a slash-command handler. */
export interface CommandInvocationLike {
  agent?: unknown
  /** Everything after the command name; this command's grammar owns it. */
  rawInput?: string
}

/** Result shape the command adapters render. */
export interface CommandResultLike {
  kind: 'success' | 'error'
  text?: string
}

/** The command-registry face the status command uses. */
export interface CommandRegistryLike {
  register(definition: {
    name: string
    description: string
    input?: { hint?: string }
    handler: (invocation: CommandInvocationLike) => CommandResultLike
  }): () => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** HTTP server of the web GUI host (absent in headless compositions). */
    webServer: WebServerLike
    /** Interactive slash-command registry (absent in UI-less compositions). */
    commands: CommandRegistryLike
    /** Authenticates non-loopback dashboard requests. */
    connection: ConnectionLike
  }
}
