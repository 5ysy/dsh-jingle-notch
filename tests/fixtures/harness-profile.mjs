// Initialize disposable profiles with the same official template Desktop uses.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const [modules, home, profile, probe] = process.argv.slice(2)
const require = createRequire(join(modules, '@deepseek-ai/dsh/package.json'))
const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
const boot = await load('dsh-app-boot')
const { initProfile } = boot
// rc.5 exports templates from app-boot; current source owns a separate package.
const { PROFILE_TEMPLATES } = boot.PROFILE_TEMPLATES ? boot : await load('dsh-official-bundles')
const directory = join(home, 'profiles', profile)
initProfile(directory, PROFILE_TEMPLATES.web.bundles)
writeFileSync(join(directory, 'cordis.patch.yml'), `
- id: jingle-notch
  config:
    notifications: { enabled: false }
    sounds: { enabled: false }
    recap: { enabled: false }
    overlay:
      enabled: ${Boolean(process.env.JINGLE_NOTCH_TEST_ELECTRON)}
      autoStart: false
      electronPath: ${JSON.stringify(process.env.JINGLE_NOTCH_TEST_ELECTRON ?? '')}
- insert:
    - id: jingle-notch-host-probe
      name: ${JSON.stringify(pathToFileURL(probe).href)}
      inject: [jingleNotch, commands, sessions, webServer, agents, approval, userQuestions]
`)
