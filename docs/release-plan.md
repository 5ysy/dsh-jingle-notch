# Public release plan · 2026-11-02

1. Review the plugin manifest, runtime entry points, tests, public assets, license notices and existing installation contracts. Confirm the empty GitHub destination and npm package availability.
2. Rewrite both READMEs for public discovery: product identity, actual plugin features, synthetic screenshots, npm installation for Desktop/Web, supported hosts and links to focused configuration/development guides. Keep source builds in the development guide.
3. Update installation and development documentation to match npm distribution. Preserve the existing runtime, dependencies, package name and version unless verification identifies a release blocker.
4. Run type checking, unit tests, build, package-content/link/credential review and packed Desktop/Web/native smoke checks. Attempt the workspace-required Python commands and record their applicability.
5. Commit the reviewed plugin repository with a Conventional Commit, push main to 5ysy/dsh-jingle-notch, publish the exact verified npm tarball, and verify registry metadata and real registry installation. Record release evidence in docs/state.md and publish a tagged GitHub release.

The user explicitly authorized GitHub publication and npm publication. Authentication challenges may require the account owner's input. Other workspace repositories and existing user profiles remain outside the release scope.
