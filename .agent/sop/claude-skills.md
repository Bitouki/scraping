# Claude Code Skills in this Repo

`.claude/skills/` holds Claude Code skills available to any Claude Code session
working in this repo. A skill is a folder with a `SKILL.md` (YAML frontmatter +
Markdown instructions), optionally with `references/`, `scripts/`, `assets/`.
It does not add new *capabilities* by itself — Claude can already run shell
commands — it just auto-injects a reliable how-to when a request matches the
skill's `description`, instead of Claude improvising the syntax.

## Installed skills

### `data-analysis`
Lightweight instructions for summarizing CSV output (e.g. results exported
from a scrape/crawl job) — load, inspect headers, summarize stats/outliers,
report insights. Works everywhere, no external tool required.

## Considered and rejected: `playwright-cli`

A `playwright-cli` skill (browser automation via the `@playwright/cli` npm
tool) was tried and removed. It added no real capability: Claude could
already drive a browser by writing a Playwright script directly, and in
network-restricted Claude Code sandboxes the browser can't reach external
sites anyway (egress policy blocks the install download and any outbound
navigation), so the CLI wrapper was inert here. Revisit only if this repo's
Claude Code sessions regularly run somewhere with normal internet access
(a developer's machine, an open CI runner) and repeated multi-step browser
sessions (not one-off scripts) become common enough to be worth the
convenience.

## Adding a new skill

1. Create `.claude/skills/<name>/SKILL.md` with `name` + `description`
   frontmatter (add `allowed-tools` to scope which tools/commands it may use).
2. Put any supporting files under `references/`, `scripts/`, or `assets/`.
3. Note it in this file so the index stays accurate.
