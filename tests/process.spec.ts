import { expect, it } from 'vitest'
import { psQuote } from '../src/process-utils.ts'
it('quotes PowerShell input literally, including substitutions and apostrophes',()=>{
 expect(psQuote("a'$(whoami)`n\"b")).toBe("'a''$(whoami)`n\"b'")
})
