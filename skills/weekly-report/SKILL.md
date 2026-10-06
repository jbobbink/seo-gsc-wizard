---
name: weekly-report
description: Produce a weekly SEO performance digest for a Search Console property using the GSC Wizard MCP tools; compares a lag-adjusted 7-day window against the prior week, surfaces headline metrics, top query and page movers in both directions, ranking changes, trend breaks, Google algorithm update overlap, and logged site changes, then delivers a concise digest with watch items and recommendations. Use when the user asks for a weekly report, a weekly SEO update, "how did we do this week", a week-over-week summary, or a recurring performance digest for a site.
---

# Weekly SEO Report

Produce a concise weekly SEO performance digest for one Search Console property, using the GSC Wizard MCP tools. `$ARGUMENTS` may contain a property (a GSC site URL or a recognizable site name) and/or a focus hint (a market, a site section, a topic); use it to resolve the property and to slant the analysis.

## Steps

1. **Resolve the property.** If the user (or `$ARGUMENTS`) named a property, use it. Otherwise call `list_sites` first. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. If several plausible matches exist, ask the user which one before continuing.

2. **Compute the date windows.** GSC data lags about 2 to 3 days, so offset the report week back by 3 days:
   - Current week: `today - 9` through `today - 3` (7 days inclusive).
   - Prior week: `today - 16` through `today - 10`.
   Use these exact windows in every dated call so all sections line up. If the user asks for a specific range, honor it, but keep the newest 2 days out of any window and say why. When presenting results, state the actual dates covered; do not imply the digest runs through today.

3. **Headline metrics.** Call `get_site_summary` with `days: 7`. This tool applies the same 3-day lag offset internally and returns a same-length prior-period comparison, so its window matches step 2. Report clicks, impressions, CTR, and average position with week-over-week change. `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. Position: lower is better; a change toward a lower number is an improvement.

4. **Top query and page movers.** `query_top_queries` and `query_top_pages` take a single date range with no comparison parameter, so call each tool twice: once with the current week's `startDate`/`endDate` and once with the prior week's (use `limit: 50`). Join rows by query (or page), compute click and position deltas, and keep the largest gainers and largest decliners in each dimension.

5. **Ranking movement.** Call `get_ranking_changes` with `startDate`/`endDate` set to the current week, `comparisonStartDate`/`comparisonEndDate` set to the prior week, and `dimension: "query"`. If step 4 showed the movement is page-driven, call it again with `dimension: "page"`. Highlight notable entries from all four buckets: new, lost, improved, declined.

6. **Trend break check.** Call `detect_change_points` with `metric: "clicks"` and `days: 90`. If any detected change point falls inside or within a few days before the report week, the week's move is a sustained level shift rather than noise; note the before/after averages the tool reports.

7. **Algorithm update overlap.** Call `list_algo_updates` with `startDate` about 21 days before the current week's start (rollouts span days to weeks). Flag any update whose begin-to-end span overlaps the report week or the days just before it, and connect it to the movers where plausible.

8. **Logged site changes.** Call `list_annotations` with the property's `siteUrl`, `startDate` set to the prior week's start, and `endDate` set to the current week's end. Correlate deploys, content changes, and other logged events with the gains and losses.

## Output

Present the digest in this order, using compact markdown tables for multi-row data and prose only for interpretation:

1. **Headline**: one or two sentences with the week's dates and the four core metrics week over week.
2. **What improved**: top gaining queries and pages (clicks this week, last week, delta, position where relevant), plus notable new and improved entries from step 5.
3. **What declined**: the mirror table for decliners, plus lost queries.
4. **Probable causes**: tie declines and gains to change points, algorithm updates, and annotations. Be explicit when the cause is uncertain; do not force a narrative.
5. **Watch items**: fragile positions, queries hovering near a threshold, an unconfirmed trend break, an algorithm rollout still in progress.
6. End with a short prioritized list of 3 to 5 concrete recommendations.

If a dip is visible at the newest edge of any series, say that GSC data lags about 2 to 3 days and the most recent days may still fill in; never treat the last 2 days as complete.

## Follow-up

After delivering the digest, offer two shareable options and run one only if the user asks:
- `generate_seo_report` for a full styled HTML report covering the whole analysis suite.
- `create_shared_report` to save the digest's key mover table as a client-portal report. Warn the user that the returned URL opens for nobody, not even them, until access is granted: creating the report is step 1 of 3, followed by `create_report_client` with the recipient's email and `manage_report_access` to grant that client the report.

## Errors

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and suggest close matches rather than guessing.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
