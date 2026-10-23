# GSC Wizard for AI Agents & Assistants

Bring your Google Search Console, Bing Webmaster, GA4, Merchant Center and Yandex Webmaster data into Claude Code, OpenClaw, Cursor, Gemini CLI and other MCP clients. This repository connects your agent to the [GSC Wizard](https://www.gscwizard.com) MCP server (130+ SEO analytics tools) and bundles 34 guided skills for the workflows SEO professionals run most.

The server does the statistics itself (anomaly detection, change points, decay, cannibalization, forecasts, migration health) and returns finished results, so the model explains a result instead of computing trends over whatever raw rows fit in its context window. Every skill also requires every figure it reports to name the tool and date range it came from.

## What you get

- **130+ MCP tools**: search analytics (queries, pages, countries, devices), ranking changes, anomaly and change-point detection, content decay, keyword cannibalization, CTR-curve analysis, opportunity scoring, topic clusters, content groups, URL inspection and indexing tracking, sitemaps, IndexNow, Core Web Vitals, SEO experiments, migration comparisons, traffic forecasting, Bing Webmaster stats, Yandex Webmaster stats, GA4 reports (including traffic referred by AI assistants), Merchant Center listings, pricing and feed audits, annotations, shared client reports and more.
- **34 guided skills** that orchestrate those tools end to end. Each one resolves the property, picks lag-safe date windows, calls the right tools with the right arguments, interprets the result and ends with a prioritized list of actions.

### Diagnose and report

| Skill | What it does |
| :---- | :----------- |
| `/seo-gsc-wizard:site-audit` | Comprehensive SEO health audit with a prioritized action plan |
| `/seo-gsc-wizard:weekly-report` | Weekly performance digest with movers, probable causes and watch items |
| `/seo-gsc-wizard:traffic-drop` | Date a traffic drop, test the causes in order and name the most probable one |
| `/seo-gsc-wizard:anomaly-check` | Quiet scheduled check that replies in one line unless something needs a human |
| `/seo-gsc-wizard:ranking-changes` | Winners and losers between any two periods, by query and by page |
| `/seo-gsc-wizard:client-report` | Generate a styled report and share it through the client portal |
| `/seo-gsc-wizard:portfolio-overview` | Every property on the account at once, with tags and the sites that need attention |

### Content and queries

| Skill | What it does |
| :---- | :----------- |
| `/seo-gsc-wizard:content-decay` | Find decaying content and build a recovery plan per page |
| `/seo-gsc-wizard:cannibalization` | Detect competing pages and pick a canonical winner per query cluster |
| `/seo-gsc-wizard:quick-wins` | Striking-distance keywords, CTR gaps and poaching opportunities, ranked by impact |
| `/seo-gsc-wizard:ctr-optimization` | Pages whose CTR underperforms at a stable position, with a title rewrite brief each |
| `/seo-gsc-wizard:page-deep-dive` | Everything about one URL: queries, indexing, on-page, vitals and GA4 engagement |
| `/seo-gsc-wizard:query-deep-dive` | Everything about one keyword: pages, markets, devices, Bing demand and GA4 value |
| `/seo-gsc-wizard:long-tail-analysis` | Head, middle and long tail segments plus the share of traffic no row carries |
| `/seo-gsc-wizard:branded-split` | Branded versus non-branded performance and the keywords that define the split |
| `/seo-gsc-wizard:country-device` | Market and device performance, with the gaps worth fixing |
| `/seo-gsc-wizard:content-groups` | Define URL-based content groups and measure each one |

### Technical and indexing

| Skill | What it does |
| :---- | :----------- |
| `/seo-gsc-wizard:indexing-health` | Indexing and crawl health check across GSC, sitemaps and Bing |
| `/seo-gsc-wizard:indexing-tracker` | Track a set of URLs until they are indexed, with on-demand re-checks |
| `/seo-gsc-wizard:indexnow-submit` | Set up an IndexNow key and submit URLs, with the submission history |
| `/seo-gsc-wizard:sitemap-audit` | Sitemap errors, URLs with no impressions and (re)submission |
| `/seo-gsc-wizard:onpage-audit` | Live technical on-page audit of a set of pages, issues grouped by severity |
| `/seo-gsc-wizard:core-web-vitals` | Field Core Web Vitals with regressions, tied to the pages that carry the clicks |
| `/seo-gsc-wizard:site-migration` | Before/after migration health, redirect mappings and the URLs that did not recover |
| `/seo-gsc-wizard:experiment-results` | Read out an SEO split test with significance and confounders |
| `/seo-gsc-wizard:traffic-forecast` | Seasonal forecast of clicks or impressions with year-over-year context |
| `/seo-gsc-wizard:property-setup` | Onboard a new property: register, brand keywords, sitemaps, filters, dashboard |

### GA4 and revenue

| Skill | What it does |
| :---- | :----------- |
| `/seo-gsc-wizard:ga4-overview` | GA4 traffic, conversions, error pages and custom dimensions for the linked property |
| `/seo-gsc-wizard:ai-assistant-traffic` | Traffic referred by AI assistants and the AI-shaped queries in Search Console |

### Bing and Yandex

| Skill | What it does |
| :---- | :----------- |
| `/seo-gsc-wizard:bing-performance` | Bing traffic, queries, pages and keyword demand next to the Google numbers |
| `/seo-gsc-wizard:bing-crawl-health` | Bing crawl stats, crawl issues, feeds, inbound links and URL submission quota |
| `/seo-gsc-wizard:yandex-performance` | Yandex quality index, pages in search, queries and indexing history |

### Merchant Center

| Skill | What it does |
| :---- | :----------- |
| `/seo-gsc-wizard:merchant-center-health` | Account issues, feed processing and the products that are not eligible |
| `/seo-gsc-wizard:shopping-performance` | Free-listing performance, price position, best sellers and competitor visibility |

Claude also invokes these skills automatically when your request matches, so "why is my site losing traffic?" works without remembering a command name. The command names above are Claude Code's; in other agents each skill goes by its folder name (`site-audit`, `weekly-report`, ...). Every skill is a plain `SKILL.md` you can read before running it; there are no scripts in the skill folders.

## Requirements

- A [GSC Wizard](https://www.gscwizard.com) account with an active plan or free trial
- Your Google account connected to GSC Wizard (Search Console access; GA4, Bing, Yandex and Merchant Center are optional connections made in the app)

## Installation

From the community marketplace:

```
/plugin marketplace add anthropics/claude-plugins-community
/plugin install seo-gsc-wizard@claude-community
```

Or directly from this repository:

```
/plugin marketplace add jbobbink/seo-gsc-wizard
/plugin install seo-gsc-wizard@seo-gsc-wizard
```

On first use, Claude Code opens your browser to authorize the connection (OAuth 2.1). Approve access with your GSC Wizard account and you are done; tokens are stored and refreshed by Claude Code. If the connection ever needs re-authorizing, run `/mcp` and select `gsc-wizard`.

## Other editors and agents

The same repository works as a plugin or extension elsewhere; all of them connect to `https://mcp.gscwizard.com/mcp` and sign in through the browser.

- **Cursor:** install from the Cursor marketplace, or point Cursor at this repository (manifest in `.cursor-plugin/`, server in `mcp.json`).
- **Gemini CLI:** `gemini extensions install https://github.com/jbobbink/seo-gsc-wizard`, then `/mcp auth gsc-wizard` if the browser does not open on first use.
- **Cline and other MCP clients:** add the remote server URL above; see [llms-install.md](llms-install.md).

## OpenClaw

The skills use the same `SKILL.md` format as OpenClaw, so they install by copying them into your workspace:

```
git clone https://github.com/jbobbink/seo-gsc-wizard
cp -r seo-gsc-wizard/skills/* ~/.openclaw/workspace/skills/
```

**1. Create a read-only API key.** In GSC Wizard, go to [Account → API keys](https://tool.gscwizard.com/account/api-keys), create a key and leave the scope on **Read only**. The key is shown once, so copy it straight away. A read-only key is refused by every tool that changes something before that tool runs, so even a prompt-injected agent cannot submit, delete or edit anything.

**2. Add the server.** Register `https://mcp.gscwizard.com/mcp` under `mcp.servers` in `~/.openclaw/openclaw.json` with the `streamable-http` transport and the key you just created, then check the connection:

```
openclaw mcp doctor gsc-wizard --probe
```

The exact `openclaw.json` entry, the two settings most guides get wrong (the key is `mcp.servers`, not `mcpServers`, and `transport` has to be set because without it OpenClaw uses SSE while this server only speaks Streamable HTTP), and how to keep the key in OpenClaw's secrets store instead of the config file are on the [OpenClaw setup page](https://www.gscwizard.com/openclaw-continuous-seo-analysis.html).

**3. Schedule a skill** (optional). For example, a weekly report posted to Slack every Monday:

```
openclaw automations create "10 8 * * 1" \
  "Run the weekly-report skill for sc-domain:example.com." \
  --name "SEO weekly report" --tz "Europe/Amsterdam" \
  --session isolated \
  --announce --channel slack --to "channel:C0123456789"
```

Use `--session isolated` rather than Heartbeat: Heartbeat runs every 30 minutes by default and Search Console data does not change that often. `HEARTBEAT.md` is no longer read, so do not build on it. For a daily check, schedule `anomaly-check` on weekdays: it replies with one line when nothing happened and only expands when a spike, a drop or a sustained level shift needs a human. An agent that posts a wall of green every morning gets muted.

**With a read-only key:** every skill runs. The steps that write are refused and the skill says so and continues: IndexNow and sitemap submission, tracker changes, content group edits, branded keywords, annotations, shared reports and redirect mappings. `indexing-health` inspects URLs one by one with `inspect_url` when the batch inspection tool is refused. If you want the write steps, create a separate read & write key for an attended agent rather than widening the scheduled one.

**Security:** keep browser and `web_fetch` tools away from the agent that holds the key, and read any SEO skill before you install it, from this repository or from ClawHub.

## Example prompts

- "Audit sc-domain:example.com and tell me what to fix first"
- "Why did my clicks drop in the second week of September?"
- "Which of my pages are decaying and what should I do about them?"
- "Do I have cannibalization issues on my money keywords?"
- "Give me this week's SEO report"
- "Why aren't my new product pages indexed?"
- "Which titles should I rewrite for a better click-through rate?"
- "How did the migration to the new domain go?"
- "Are my products eligible for free listings, and how are they priced against the market?"

## How the skills are built

Each skill is one `SKILL.md`: a description with the phrasings that trigger it, numbered steps that name the tool and the arguments to call it with, interpretation rules, the output format and a fixed grounding rule. The conventions every skill shares:

- Resolve the property with `list_sites` before anything else; never guess a site URL.
- Keep the newest 2 to 3 days out of every window, because Search Console data lags.
- `ctr` is already a percentage (0-100) and a lower `position` is better.
- Prefer the server-side analysis tools over pulling raw rows.
- Before any tool that writes, list the exact items and ask for confirmation.
- Every figure names the tool and the date range it came from.

Every skill is checked against the server's real tool registry before a release: tool names, argument names, the fixed paragraphs, provider-neutral wording and this table.

## Privacy and security

The plugin talks to `https://mcp.gscwizard.com` over OAuth 2.1; no API keys or credentials live in this repository. Claude Code, Cursor and Gemini CLI store and refresh the OAuth tokens themselves; with OpenClaw you hold a GSC Wizard API key, which you can revoke at any time under Account → API keys. The server reads your Search Console, Bing, Yandex, GA4 and Merchant Center data through the accounts you connected to GSC Wizard, scoped to your user; nothing is collected from your local agent setup. See the [privacy policy](https://www.gscwizard.com/privacy.html).

## Development

```
git clone https://github.com/jbobbink/seo-gsc-wizard
claude --plugin-dir ./seo-gsc-wizard
```

Prefer the raw MCP server without the skills? `claude mcp add --transport http gsc-wizard https://mcp.gscwizard.com/mcp`

## License

MIT
