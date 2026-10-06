# GSC Wizard for AI Agents & Assistants

Bring your Google Search Console, Bing Webmaster and GA4 data into Claude Code, OpenClaw, Cursor, Gemini CLI and other MCP clients. This repository connects your agent to the [GSC Wizard](https://www.gscwizard.com) MCP server (100+ SEO analytics tools) and bundles guided skills for the workflows SEO professionals run most.

The server does the statistics itself (anomaly detection, change points, decay, cannibalization) and returns finished results, so the model explains a result instead of computing trends over whatever raw rows fit in its context window. The skills also require every figure to name the tool and date range it came from.

## What you get

- **100+ MCP tools**: search analytics (queries, pages, countries, devices), ranking changes, anomaly and change-point detection, content decay, keyword cannibalization, CTR-curve analysis, opportunity scoring, topic clusters, content groups, URL inspection and indexing tracking, sitemaps, Core Web Vitals, Bing Webmaster stats, GA4 reports (including LLM referral traffic), traffic forecasting, migration comparisons, annotations, shared reports and more.
- **Guided skills** that orchestrate those tools end to end:

| Skill | What it does |
| :---- | :----------- |
| `/seo-gsc-wizard:site-audit` | Comprehensive SEO health audit with a prioritized action plan |
| `/seo-gsc-wizard:content-decay` | Find decaying content and build a recovery plan per page |
| `/seo-gsc-wizard:cannibalization` | Detect competing pages and pick a canonical winner per query cluster |
| `/seo-gsc-wizard:quick-wins` | Striking-distance keywords, CTR gaps and poaching opportunities, ranked by impact |
| `/seo-gsc-wizard:weekly-report` | Weekly performance digest with movers, probable causes and watch items |
| `/seo-gsc-wizard:indexing-health` | Indexing and crawl health check across GSC, sitemaps and Bing |

Claude also invokes these skills automatically when your request matches, so "why is my site losing traffic?" works without remembering a command name. The command names above are Claude Code's; in other agents each skill goes by its folder name (`site-audit`, `weekly-report`, ...). Every skill is a plain `SKILL.md` you can read before running it; there are no scripts in the skill folders.

## Requirements

- A [GSC Wizard](https://www.gscwizard.com) account with an active plan or free trial
- Your Google account connected to GSC Wizard (Search Console access; GA4 optional)

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

**2. Add the server** to `~/.openclaw/openclaw.json`:

```json5
{
  mcp: {
    servers: {
      "gsc-wizard": {
        url: "https://mcp.gscwizard.com/mcp",
        transport: "streamable-http",
        headers: { Authorization: "Bearer <read-only key>" }
      }
    }
  }
}
```

Then check the connection:

```
openclaw mcp doctor gsc-wizard --probe
```

Two settings that many guides get wrong:

- The key is `mcp.servers`, not `mcpServers`. `mcpServers` is the Claude Desktop format.
- Set `transport` explicitly. Without it OpenClaw uses SSE, and this server only speaks Streamable HTTP, so the connection fails silently.

Once the probe passes, move the key out of the literal header into OpenClaw's secrets mechanism, and never commit the file.

**3. Schedule a skill** (optional). For example, a weekly report posted to Slack every Monday:

```
openclaw automations create "10 8 * * 1" \
  "Run the weekly-report skill for sc-domain:example.com." \
  --name "SEO weekly report" --tz "Europe/Amsterdam" \
  --session isolated \
  --announce --channel slack --to "channel:C0123456789"
```

Use `--session isolated` rather than Heartbeat: Heartbeat runs every 30 minutes by default and Search Console data does not change that often. `HEARTBEAT.md` is no longer read, so do not build on it. For a daily check, schedule `indexing-health` on weekdays, or write a short skill that only replies when something needs a human; an agent that posts a wall of green every morning gets muted.

**With a read-only key:** all six skills run. The optional extras that write are refused: IndexNow resubmission in `indexing-health` and saving the digest as a shared report in `weekly-report`. `indexing-health` inspects URLs one by one with `inspect_url` when the batch inspection tool is refused. If you want those extras, create a separate read & write key for an attended agent rather than widening the scheduled one.

**Security:** keep browser and `web_fetch` tools away from the agent that holds the key, and read any SEO skill before you install it, from this repository or from ClawHub.

## Example prompts

- "Audit sc-domain:example.com and tell me what to fix first"
- "Which of my pages are decaying and what should I do about them?"
- "Do I have cannibalization issues on my money keywords?"
- "Give me this week's SEO report"
- "Why aren't my new product pages indexed?"

## Privacy and security

The plugin talks to `https://mcp.gscwizard.com` over OAuth 2.1; no API keys or credentials live in this repository. Claude Code, Cursor and Gemini CLI store and refresh the OAuth tokens themselves; with OpenClaw you hold a GSC Wizard API key, which you can revoke at any time under Account → API keys. The server reads your Search Console, Bing and GA4 data through the accounts you connected to GSC Wizard, scoped to your user; nothing is collected from your local agent setup. See the [privacy policy](https://www.gscwizard.com/privacy.html).

## Development

```
git clone https://github.com/jbobbink/seo-gsc-wizard
claude --plugin-dir ./seo-gsc-wizard
```

Prefer the raw MCP server without the skills? `claude mcp add --transport http gsc-wizard https://mcp.gscwizard.com/mcp`

## License

MIT
