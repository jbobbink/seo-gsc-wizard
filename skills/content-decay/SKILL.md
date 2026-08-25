---
description: Find, triage, and build recovery plans for decaying content in Google Search Console using the GSC Wizard MCP tools (get_decay_overview, find_decaying_content, per-page drill-downs, optional traffic forecast). Use when the user asks about decaying content, pages losing traffic, content refresh candidates, which pages are dying, declining organic clicks, or wants a content refresh or recovery plan.
---

# Content Decay Triage

Identify which content is losing search traffic, diagnose why per page, and produce a concrete recovery plan. `$ARGUMENTS` may contain a property (e.g. `sc-domain:example.com`) and/or a focus hint such as a URL path, a topic, or a custom date range; honor it if present.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it as `siteUrl` (GSC formats: `sc-domain:example.com` or `https://www.example.com/`). Otherwise call `list_sites` and pick the match; if several sites plausibly match, ask the user which one before proceeding.

2. **Aggregate trend: `get_decay_overview`.** Call it with `dimension: "page"`, `metric: "clicks"`, and the default granularity (`month`) and window (last 16 complete months) unless the user specified a range.
   - Read the per-period TOTALS to describe the site-wide trajectory: steadily declining, seasonal dip, cliff after a specific month, or flat.
   - If a sharp cliff is visible, note the month; you may optionally call `detect_change_points` to pin down the exact date and cross-reference `list_algo_updates` for a coinciding Google update.
   - Check the response `dataSource`; if history looks short, mention whether data came from the warehouse or the live API.

3. **Ranked decliners: `find_decaying_content`.** Call with `dimension: "page"`.
   - Period semantics: `startDate`/`endDate` is the RECENT period; `comparisonStartDate`/`comparisonEndDate` is the earlier BASELINE.
   - Defaults (last 28 days vs the previous period) are fine unless the user asked for something else, but for slow decay a wider gap is more revealing, e.g. recent 28 days vs the same-length window 6-12 months earlier, guided by where the overview showed the peak.
   - Results are bucketed by click loss: severe (> 50%), moderate (20-50%), mild (< 20%).
   - Present the top decliners as a compact markdown table: page, baseline clicks, recent clicks, change %, severity, position change.

4. **Drill into the worst 5-10 pages.** Pick by absolute clicks lost, not percentage alone (a 60% drop on 5 clicks matters less than a 25% drop on 5,000). For each page:
   - `get_page_performance` with the full `pageUrl` and a window covering both periods: read the shape of the decline (gradual erosion vs step change) and which metric moved first (position, impressions, or CTR).
   - `query_search_analytics` twice, filtered to the page, to find which queries drove the loss:
     - `dimensions: ["query"]`, `filters: [{ dimension: "page", operator: "equals", expression: "<pageUrl>" }]`
     - one call for the recent period, one for the baseline period; diff the two result sets per query.
   - Classify the loss pattern:
     - position slipped on the same queries: content freshness or competition;
     - impressions collapsed: demand drop, deindexing, or cannibalization;
     - CTR fell at stable position: SERP feature or title/snippet problem;
     - or the page lost a single dominant query.

5. **Optional: quantify the cost with `forecast_traffic`.** If the user wants to know what continued decay costs, call it for the property with `metric: "clicks"`; if the user supplies a conversion rate or average order value, pass them as `cvr` (decimal, e.g. 0.025) and `aov` to derive revenue. Contrast the projected trajectory with the baseline-period run rate. Frame it as an estimate.

6. **Output a recovery plan.** Per triaged page, recommend exactly one primary action with a one-line justification tied to the diagnosis:
   - **Refresh**: position slipping on still-valuable queries; update content, add current data, improve depth.
   - **Consolidate**: several decaying pages split the same query set; merge into the strongest URL and redirect.
   - **Retarget**: the page ranks for queries with drifting intent; rewrite for what the queries now mean.
   - **Improve internal links**: gradual position erosion with thin internal linking; add contextual links from strong pages.
   - **Retire**: demand is gone (impressions collapsed across all queries); prune or redirect, reclaim crawl budget.

   End with a short prioritized list of concrete recommendations (highest clicks-at-stake first).

## Conventions

- Default date logic: last 28 days vs the previous period unless the user says otherwise; decay-specific defaults above take precedence where noted.
- GSC data lags about 2 to 3 days. Never treat the most recent 2 days as complete; if a dip appears at the right edge of a chart or range, say explicitly that it is likely the reporting lag, not real decay.
- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A move toward a lower number is an improvement; call position increases "slipped" or "lost rank".
- Present multi-row results as compact markdown tables; keep prose for interpretation, and keep tables to the columns that matter (page/query, clicks before/after, change %, position before/after).
- Do not fabricate rows the tools did not return. If `find_decaying_content` returns nothing above the threshold, say the property shows no meaningful decay and stop after step 3.
- If a tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required.
