# GSC Wizard

The `gsc-wizard` MCP server gives you the user's own Google Search Console, Bing Webmaster Tools, Yandex Webmaster, GA4 and Google Merchant Center data through GSC Wizard (https://www.gscwizard.com).

- Start with `list_sites` to find the property; never guess a site URL. Domain properties look like `sc-domain:example.com`.
- Prefer the summarising tools (`get_site_summary`, `get_ranking_changes`, `find_decaying_content`, `analyze_cannibalization`, `score_opportunities`, `detect_change_points`) over pulling raw rows with `query_search_analytics`; the analysis runs server-side.
- Search Console data lags 2 to 3 days, so the most recent days are incomplete. `ctr` is already a percentage (0-100); a lower `position` is better.
- Before any tool that submits, creates, updates or deletes something, list the exact items and ask the user to confirm.
- If a tool fails with an authentication or subscription error, tell the user to run `/mcp auth gsc-wizard` and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required.
- The bundled skills describe complete workflows; follow one when the request matches:
  - Diagnose and report: site-audit, weekly-report, traffic-drop, anomaly-check, ranking-changes, client-report, portfolio-overview
  - Content and queries: content-decay, cannibalization, quick-wins, ctr-optimization, page-deep-dive, query-deep-dive, long-tail-analysis, branded-split, country-device, content-groups
  - Technical and indexing: indexing-health, indexing-tracker, indexnow-submit, sitemap-audit, onpage-audit, core-web-vitals, site-migration, experiment-results, traffic-forecast, property-setup
  - GA4 and revenue: ga4-overview, ai-assistant-traffic
  - Bing and Yandex: bing-performance, bing-crawl-health, yandex-performance
  - Merchant Center: merchant-center-health, shopping-performance
