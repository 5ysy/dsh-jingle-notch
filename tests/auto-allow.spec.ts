import { describe, expect, it } from 'vitest'
import { autoAllowSnippet, isAutoAllowed } from '../src/auto-allow.ts'

describe('isAutoAllowed', () => {
  it('matches exact tool names', () => {
    expect(isAutoAllowed(['bash'], { toolName: 'bash' })).toBe(true)
    expect(isAutoAllowed(['bash'], { toolName: 'bashx' })).toBe(false)
  })

  it('matches trailing-* prefixes', () => {
    expect(isAutoAllowed(['web_*'], { toolName: 'web_search' })).toBe(true)
    expect(isAutoAllowed(['web_*'], { toolName: 'fs_read' })).toBe(false)
  })

  it('is empty-safe', () => {
    expect(isAutoAllowed([], { toolName: 'bash' })).toBe(false)
  })
})

describe('autoAllowSnippet', () => {
  it('renders the config snippet for one tool', () => {
    expect(autoAllowSnippet('bash')).toContain('- bash')
    expect(autoAllowSnippet('bash')).toContain("# add to the jingle-notch row's config:")
  })
})
