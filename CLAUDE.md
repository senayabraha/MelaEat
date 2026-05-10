# Project Conventions

## Git workflow

**Push directly to `main`. Do not create feature branches or pull requests.**

When making code changes (locally, in remote Claude Code sessions, or via Codex):

1. Commit on `main`:
   ```
   git add <files>
   git commit -m "<message>"
   git push
   ```
2. Do **not** run `git checkout -b`, do **not** open a PR, do **not** use `gh pr create`.
3. If a tool or agent defaults to creating a branch, override it and commit on `main`.

The user has authorized direct pushes to `main` for this repository as a standing instruction — no need to ask for confirmation before pushing.
