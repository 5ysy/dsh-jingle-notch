# JingleNotch namespace plan · 2026-11-02

1. Save a reversible baseline outside the project and review current source, tests, package contents and third-party license requirements.
2. Add failing checks for the single `/jingle` command and new HTTP routes. Rename the plugin and artwork working directories to `dsh-jingle-notch`.
3. Apply one namespace consistently: `JingleNotch` exported types, `jingleNotch` service/renderer bridge, `jingle-notch` row IDs and IPC prefix, `/jingle` HTTP paths, `jingle-notch-whale` asset scheme, `DSH_JINGLE_NOTCH_*` runtime variables, `JINGLE_NOTCH_*` test variables, and `dsh-jingle-notch` storage/application identity. Remove the command alias and all compatibility fallbacks.
4. Rewrite installation/configuration/development documents around the new identity, update all tests and fixtures, preserve required MIT copyright/permission in a separate packaged notice, and record current state. Preserve prior engineering evidence in the external baseline.
5. Verify types, unit tests, build, actual Desktop/Web/source Host matrix, packed native overlay interactions, archive contents and public links. Attempt required workspace Python checks, review the baseline diff and scan production sources/package for retired identifiers and credentials. Leave live profiles untouched; installing the renamed plugin requires the new package entry.

The directory rename invalidates existing local links. The new namespace uses fresh preferences/recap storage with no automatic import or compatibility alias. No dependency changes or remote publication are required.
