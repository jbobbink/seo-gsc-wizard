# GSC Wizard

The `gsc-wizard` MCP server gives you the user's own Google Search Console, Bing Webmaster Tools and GA4 data through GSC Wizard (https://www.gscwizard.com).

- Start with `list_sites` to find the property; never guess a site URL. Domain properties look like `sc-domain:example.com`.
- Prefer the summarising tools (`get_site_summary`, `get_ranking_changes`, `find_decaying_content`, `analyze_cannibalization`, `score_opportunities`) over pulling raw rows with `query_search_analytics`; the analysis runs server-side.
- Search Console data lags 2 to 3 days, so the most recent days are incomplete.
- If a tool fails with an authentication or subscription error, tell the user to run `/mcp auth gsc-wizard` and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required.
- The bundled skills (site-audit, content-decay, cannibalization, quick-wins, indexing-health, weekly-report) describe complete workflows; follow one when the request matches.
