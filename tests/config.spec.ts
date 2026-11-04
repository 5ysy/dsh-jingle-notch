import { expect, it } from 'vitest'
import { JingleNotchConfigSchema } from '../src/config.ts'

it('defaults the overlay to start with an enabled plugin', () => {
  expect(JingleNotchConfigSchema({} as never).overlay.autoStart).toBe(true)
})
