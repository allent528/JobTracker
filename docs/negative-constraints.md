# Negative constraints

Hard "never do X" rules from the owner. Claude loads this file every session (it's imported by `.claude/CLAUDE.md`). Add one line per rule, with the date and the reason.

- Never commit secrets, `.env` files or build output, and never bypass the pre-commit hook with `--no-verify`.
- Never edit a database migration that has already been applied. Write a new one.
- Never push to, force-push, or rewrite `main`.
