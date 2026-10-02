# ADA lab — macOS probe

Runs the lab's probe and detector pages on a GitHub-hosted macOS runner, headed and
headless, with Google Chrome and Playwright's Chromium. Set the repository secret
`CENSUS_BASE` to the lab census URL (`https://<host>/census/c/<key>`) before pushing.
Results appear in the Actions log and as the `mac-probe-results` artifact.
