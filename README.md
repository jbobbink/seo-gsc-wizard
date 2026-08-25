# GSC Wizard for Claude Code

Bring your Google Search Console, Bing Webmaster and GA4 data into Claude Code. This plugin connects Claude to the [GSC Wizard](https://www.gscwizard.com) MCP server (100+ SEO analytics tools) and bundles guided skills for the workflows SEO professionals run most.

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

Claude also invokes these skills automatically when your request matches, so "why is my site losing traffic?" works without remembering a command name.

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

## Example prompts

- "Audit sc-domain:example.com and tell me what to fix first"
- "Which of my pages are decaying and what should I do about them?"
- "Do I have cannibalization issues on my money keywords?"
- "Give me this week's SEO report"
- "Why aren't my new product pages indexed?"

## Privacy and security

The plugin talks to `https://mcp.gscwizard.com` over OAuth 2.1; no API keys or credentials live in this repository or on your machine beyond the tokens Claude Code manages. The server reads your Search Console, Bing and GA4 data through the accounts you connected to GSC Wizard, scoped to your user. See the [privacy policy](https://www.gscwizard.com/privacy.html).

## Development

```
git clone https://github.com/jbobbink/seo-gsc-wizard
claude --plugin-dir ./seo-gsc-wizard
```

Prefer the raw MCP server without the skills? `claude mcp add --transport http gsc-wizard https://mcp.gscwizard.com/mcp`

## License

MIT
