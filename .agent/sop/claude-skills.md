# Claude Code Skills in this Repo

`.claude/skills/` holds Claude Code skills available to any Claude Code session
working in this repo. A skill is a folder with a `SKILL.md` (YAML frontmatter +
Markdown instructions), optionally with `references/`, `scripts/`, `assets/`.
It does not add new *capabilities* by itself — Claude can already run shell
commands — it just auto-injects a reliable how-to when a request matches the
skill's `description`, instead of Claude improvising the syntax.

## Installed skills

### `playwright-cli`
Browser automation (navigate, click, fill forms, screenshots, network mocking,
tracing, video recording) via the official Microsoft `playwright-cli` CLI
(npm package `@playwright/cli`). Useful for JS-heavy pages the ScrapeGraph API
can't handle directly, or for prototyping selectors before wiring up a
`scrape`/`extract` call.

The tool itself has been installed globally (`npm install -g @playwright/cli`)
and the skill was refreshed to the version matching it via
`playwright-cli install --skills`. It is **not** just documentation — the
binary is present and runnable (`playwright-cli --help`).

**Known limitation in network-restricted sandboxes** (e.g. this Claude Code
web/cloud environment): `playwright-cli install-browser` tries to download a
Chrome for Testing build from `cdn.playwright.dev`, which this session's
egress policy blocks (403). A pre-installed Chromium exists at
`/opt/pw-browsers/chromium` (used by Playwright's own Python/Node libs here),
but pointing `playwright-cli` at it via a `.playwright/cli.config.json`
(`browser.launchOptions.executablePath` + `chromiumSandbox: false` since the
container runs as root) still fails to reach any external site — outbound
browser traffic isn't routed through this session's HTTPS proxy, and the
proxy's policy denies arbitrary hosts (`example.com`, `google.com`, etc.)
anyway. That's an environment/network-policy limitation, not a problem with
the skill or the tool: on a normal machine (a developer's laptop, a CI runner
with open internet) `playwright-cli install-browser` and normal browsing work
as documented. Do not work around the policy denial (no disabling TLS
verification, no forcing traffic around the proxy) — if browser automation is
needed from *this* kind of sandboxed session, ask for the target host to be
allow-listed, or run it somewhere with normal internet access.

### `data-analysis`
Lightweight instructions for summarizing CSV output (e.g. results exported
from a scrape/crawl job) — load, inspect headers, summarize stats/outliers,
report insights. Works everywhere, no external tool required.

## Adding a new skill

1. Create `.claude/skills/<name>/SKILL.md` with `name` + `description`
   frontmatter (add `allowed-tools` to scope which tools/commands it may use).
2. Put any supporting files under `references/`, `scripts/`, or `assets/`.
3. Note it in this file so the index stays accurate.
