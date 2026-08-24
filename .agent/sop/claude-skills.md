# Claude Code Skills in this Repo

`.claude/skills/` holds Claude Code skills available to any Claude Code session
working in this repo. A skill is a folder with a `SKILL.md` (YAML frontmatter +
Markdown instructions), optionally with `references/`, `scripts/`, `assets/`.

## Installed skills

### `playwright-cli`
Browser automation (navigate, click, fill forms, screenshots, network mocking,
tracing, video recording) via the `playwright-cli` command-line tool. Useful
for JS-heavy pages the ScrapeGraph API can't handle directly, for manually
verifying scrape targets, or for prototyping selectors before wiring up a
`scrape`/`extract` call. This is the community `microsoft/playwright-cli`
skill (sourced here from VoltAgent's `examples/with-workspace` bundle, which
vendors it as a workspace-skill example). Requires the `playwright-cli` npm
tool installed and on `PATH` — see `playwright-cli install-browser`.

### `data-analysis`
Lightweight instructions for summarizing CSV output (e.g. results exported
from a scrape/crawl job) — load, inspect headers, summarize stats/outliers,
report insights.

## Adding a new skill

1. Create `.claude/skills/<name>/SKILL.md` with `name` + `description`
   frontmatter (add `allowed-tools` to scope which tools/commands it may use).
2. Put any supporting files under `references/`, `scripts/`, or `assets/`.
3. Note it in this file so the index stays accurate.
