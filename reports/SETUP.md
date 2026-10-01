# Setup before the first cloud session (Ziggy's hands)

1. Create the GitHub repo (public, MIT) and push: `git remote add origin <url> && git push -u origin main`.
2. No keys and no secrets are needed. The cloud environment needs network only for package registries (the test
   runner and the headless browser), so the default access is enough.
3. Start the session with the kickoff prompt below. It runs G0 (the design) and stops at STOP-0 for your approval.

## Kickoff prompt
> Read CLAUDE.md, then SPEC.md, GATES.md and LOG.md. Work the gates in order, starting at G0, using the loop in CLAUDE.md, and log every round in LOG.md. Stop at STOP-0 and write reports/STOP-0.md as GATES.md describes; open a PR to main linking it; then stop.

## After each STOP
Answer in the report file (a commit) or in a PR comment, then start the next session with:
> Read CLAUDE.md and the latest report in reports/ with my answers, then continue from the next gate.
