/**
 * Auto-allow matching for the approval gate: the "Always" behavior JingleNotch's
 * approval card offers, expressed as a configuration list instead of a click.
 * A pattern matches exactly, or by `*` prefix when it ends with one.
 */
import type { ApprovalRequestLike } from './types.ts'

/** Decide one approval request against the configured auto-allow list. */
export function isAutoAllowed(patterns: readonly string[], request: ApprovalRequestLike): boolean {
  return patterns.some((pattern) => matchPattern(pattern, request.toolName))
}

function matchPattern(pattern: string, toolName: string): boolean {
  if (pattern.endsWith('*')) return toolName.startsWith(pattern.slice(0, -1))
  return pattern === toolName
}

/** The cordis.yml snippet that would auto-allow one tool name, for UI copy actions. */
export function autoAllowSnippet(toolName: string): string {
  return `dsh:
  bundle:
    patch: ./cordis.patch.yml
# add to the jingle-notch row's config:
#   autoAllowTools:
#     - ${toolName}`
}
